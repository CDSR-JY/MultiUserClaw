// Nanobot API client

import type { ChatMessage, Session, SessionDetail, SystemStatus, CronJob } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:18080';

function getWsUrl(): string {
  // Derive WebSocket URL from API_URL
  const url = new URL(API_URL);
  const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${url.host}`;
}

async function fetchJSON<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

// ---- Chat ----

export async function sendMessage(
  message: string,
  sessionId: string = 'web:default'
): Promise<{ response?: string; status?: string; session_id: string }> {
  return fetchJSON('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message, session_id: sessionId }),
  });
}

export function streamMessage(
  message: string,
  sessionId: string,
  onChunk: (content: string) => void,
  onDone: () => void,
  onError: (error: string) => void
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${API_URL}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, session_id: sessionId }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        onError(`HTTP ${res.status}`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content') {
              onChunk(parsed.content);
            } else if (parsed.type === 'done') {
              onDone();
            } else if (parsed.type === 'error') {
              onError(parsed.error);
            }
          } catch {
            // skip parse errors
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        onError(err.message || 'Stream error');
      }
    }
  })();

  return () => controller.abort();
}

// ---- WebSocket Manager ----

export type WsStatus = 'disconnected' | 'connecting' | 'connected';

export type WsMessageHandler = (data: {
  type: string;
  role?: string;
  content?: string;
  status?: string;
}) => void;

export type WsStatusListener = (status: WsStatus) => void;

class WebSocketManager {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private messageHandlers: WsMessageHandler[] = [];
  private statusListeners: WsStatusListener[] = [];
  private status: WsStatus = 'disconnected';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private intentionalClose = false;

  connect(sessionId: string): void {
    // If already connected to the same session, skip
    if (this.sessionId === sessionId && this.ws?.readyState === globalThis.WebSocket?.OPEN) {
      return;
    }

    this.intentionalClose = false;
    this.sessionId = sessionId;
    this.reconnectDelay = 1000;
    this._connect();
  }

  disconnect(): void {
    this.intentionalClose = true;
    this._cleanup();
    this._setStatus('disconnected');
  }

  sendMessage(content: string): void {
    if (this.ws?.readyState === globalThis.WebSocket?.OPEN) {
      this.ws.send(JSON.stringify({ type: 'message', content }));
    }
  }

  onMessage(handler: WsMessageHandler): () => void {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter((h) => h !== handler);
    };
  }

  onStatusChange(listener: WsStatusListener): () => void {
    this.statusListeners.push(listener);
    // Immediately notify of current status
    listener(this.status);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  getStatus(): WsStatus {
    return this.status;
  }

  private _connect(): void {
    this._cleanup();

    if (!this.sessionId) return;

    this._setStatus('connecting');

    const wsUrl = getWsUrl();
    const ws = new globalThis.WebSocket(`${wsUrl}/ws/${this.sessionId}`);

    ws.onopen = () => {
      this.reconnectDelay = 1000;
      this._setStatus('connected');
      this._startPing();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'pong') return; // keepalive response
        for (const handler of this.messageHandlers) {
          handler(data);
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      this._stopPing();
      if (!this.intentionalClose) {
        this._setStatus('disconnected');
        this._scheduleReconnect();
      }
    };

    ws.onerror = () => {
      // onclose will fire after onerror
    };

    this.ws = ws;
  }

  private _cleanup(): void {
    this._stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      if (this.ws.readyState === globalThis.WebSocket?.OPEN ||
          this.ws.readyState === globalThis.WebSocket?.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
  }

  private _scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this._connect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
  }

  private _startPing(): void {
    this._stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === globalThis.WebSocket?.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  private _stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private _setStatus(status: WsStatus): void {
    if (this.status === status) return;
    this.status = status;
    for (const listener of this.statusListeners) {
      listener(status);
    }
  }
}

export const wsManager = new WebSocketManager();

// ---- Sessions ----

export async function listSessions(): Promise<Session[]> {
  return fetchJSON('/api/sessions');
}

export async function getSession(key: string): Promise<SessionDetail> {
  return fetchJSON(`/api/sessions/${encodeURIComponent(key)}`);
}

export async function deleteSession(key: string): Promise<void> {
  await fetchJSON(`/api/sessions/${encodeURIComponent(key)}`, { method: 'DELETE' });
}

// ---- Status ----

export async function getStatus(): Promise<SystemStatus> {
  return fetchJSON('/api/status');
}

// ---- Cron ----

export async function listCronJobs(includeDisabled: boolean = true): Promise<CronJob[]> {
  return fetchJSON(`/api/cron/jobs?include_disabled=${includeDisabled}`);
}

export async function addCronJob(params: {
  name: string;
  message: string;
  every_seconds?: number;
  cron_expr?: string;
  at_iso?: string;
}): Promise<CronJob> {
  return fetchJSON('/api/cron/jobs', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function removeCronJob(jobId: string): Promise<void> {
  await fetchJSON(`/api/cron/jobs/${jobId}`, { method: 'DELETE' });
}

export async function toggleCronJob(jobId: string, enabled: boolean): Promise<CronJob> {
  return fetchJSON(`/api/cron/jobs/${jobId}/toggle`, {
    method: 'PUT',
    body: JSON.stringify({ enabled }),
  });
}

export async function runCronJob(jobId: string): Promise<void> {
  await fetchJSON(`/api/cron/jobs/${jobId}/run`, { method: 'POST' });
}

export async function ping(): Promise<{ message: string }> {
  return fetchJSON('/api/ping');
}
