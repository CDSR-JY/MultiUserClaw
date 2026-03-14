import { Router } from "express";
import type { BridgeGatewayClient } from "../gateway-client.js";
import { randomUUID } from "node:crypto";
import { asyncHandler, toOpenclawSessionKey, toNanobotSessionId, extractTextContent, stripInboundMetadata, cleanSessionTitle } from "../utils.js";

interface OpenclawSessionRow {
  key: string;
  updatedAt: number | null;
  [key: string]: unknown;
}

interface OpenclawSessionsListResult {
  sessions: OpenclawSessionRow[];
  [key: string]: unknown;
}

interface OpenclawChatHistoryResult {
  messages: Array<{
    role: string;
    content: unknown;
    timestamp?: number;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

/** Convert "agent:programmer:session-1773503840989" → "programmer 会话" */
function friendlySessionKey(key: string): string {
  const parts = key.split(":");
  // agent:<name>:session-<ts> or agent:<name>:<channel>:<id>
  if (parts.length >= 2 && parts[0] === "agent") {
    const agentName = parts[1]!;
    return `${agentName} 会话`;
  }
  return key;
}

export function sessionsRoutes(client: BridgeGatewayClient): Router {
  const router = Router();

  // GET /api/sessions — list sessions
  router.get("/sessions", asyncHandler(async (_req, res) => {
    try {
      const result = await client.request<OpenclawSessionsListResult>("sessions.list", {
        includeLastMessage: true,
        includeDerivedTitles: true,
      });

      const sessions = (result.sessions || []).map((s: OpenclawSessionRow) => {
        const rawTitle = String(s.derivedTitle || s.displayName || "");
        const cleaned = cleanSessionTitle(rawTitle);
        // If title was all metadata (cleaned to empty), try lastMessagePreview as fallback
        const lastPreview = typeof s.lastMessagePreview === "string"
          ? cleanSessionTitle(s.lastMessagePreview)
          : "";
        const key = toNanobotSessionId(s.key);
        return {
          key,
          created_at: s.updatedAt ? new Date(s.updatedAt).toISOString() : null,
          updated_at: s.updatedAt ? new Date(s.updatedAt).toISOString() : null,
          title: cleaned || lastPreview || friendlySessionKey(key),
        };
      });

      res.json(sessions);
    } catch (err) {
      res.status(500).json({ detail: (err as Error).message });
    }
  }));

  // GET /api/sessions/:key — get session detail with messages
  router.get("/sessions/:key(*)", asyncHandler(async (req, res) => {
    const key = toOpenclawSessionKey(req.params.key);

    try {
      const history = await client.request<OpenclawChatHistoryResult>("chat.history", {
        sessionKey: key,
        limit: 200,
      });

      // Filter: only user and assistant messages (skip tool, system)
      // Also filter intermediate assistant messages that have tool_calls or empty content
      const messages = (history.messages || [])
        .filter((m) => m.role === "user" || m.role === "assistant")
        .filter((m) => {
          if (m.role !== "assistant") return true;
          // Skip assistant messages that are just tool calls
          if (m.tool_calls) return false;
          // Skip assistant messages with empty content (intermediate agent loop artifacts)
          const text = extractTextContent(m.content);
          if (!text.trim()) return false;
          return true;
        })
        .map((m) => ({
          role: m.role,
          content: m.role === "user"
            ? stripInboundMetadata(extractTextContent(m.content))
            : extractTextContent(m.content),
          timestamp: m.timestamp ? new Date(m.timestamp).toISOString() : null,
        }));

      // Determine timestamps from messages
      const firstMsg = messages[0];
      const lastMsg = messages[messages.length - 1];

      res.json({
        key: toNanobotSessionId(key),
        messages,
        created_at: firstMsg?.timestamp || null,
        updated_at: lastMsg?.timestamp || null,
      });
    } catch (err) {
      res.status(500).json({ detail: (err as Error).message });
    }
  }));

  // POST /api/sessions/:key/messages — send a chat message
  router.post("/sessions/:key(*)/messages", asyncHandler(async (req, res) => {
    const key = toOpenclawSessionKey(req.params.key);
    const { message } = req.body;

    if (!message || typeof message !== "string") {
      res.status(400).json({ detail: "message is required" });
      return;
    }

    try {
      const params: Record<string, unknown> = {
        sessionKey: key,
        message,
        deliver: false,
        idempotencyKey: randomUUID(),
      };

      const result = await client.request<Record<string, unknown>>("chat.send", params);
      res.json({ ok: true, runId: result.runId || null });
    } catch (err) {
      res.status(500).json({ detail: (err as Error).message });
    }
  }));

  // DELETE /api/sessions/:key — delete session
  router.delete("/sessions/:key(*)", asyncHandler(async (req, res) => {
    const key = toOpenclawSessionKey(req.params.key);

    try {
      await client.request("sessions.delete", { key });
      res.json({ ok: true });
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("not found") || msg.includes("INVALID_REQUEST")) {
        res.status(404).json({ detail: "Session not found" });
      } else {
        res.status(500).json({ detail: msg });
      }
    }
  }));

  return router;
}
