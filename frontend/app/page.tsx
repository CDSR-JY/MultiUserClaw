'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Send,
  Plus,
  Trash2,
  Loader2,
  MessageSquare,
  User,
  Bot,
} from 'lucide-react';
import { useChatStore } from '@/lib/store';
import {
  listSessions,
  getSession,
  deleteSession,
  sendMessage,
  wsManager,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { ChatMessage } from '@/types';

export default function ChatPage() {
  const {
    sessionId,
    messages,
    isLoading,
    isThinking,
    sessions,
    setSessionId,
    setMessages,
    addMessage,
    setIsLoading,
    setSessions,
    clearMessages,
    setWsStatus,
    setIsThinking,
  } = useChatStore();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  // Connect WebSocket when sessionId changes
  useEffect(() => {
    // Extract the part after "web:" for the WS session_id
    const wsSessionId = sessionId.startsWith('web:')
      ? sessionId.slice(4)
      : sessionId;

    wsManager.connect(wsSessionId);
    loadSessionMessages(sessionId);
  }, [sessionId]);

  // Register WebSocket handlers
  useEffect(() => {
    const unsubStatus = wsManager.onStatusChange((status) => {
      setWsStatus(status);
      // On reconnect, reload session to catch up on messages that arrived while offline
      if (status === 'connected') {
        loadSessionMessages(useChatStore.getState().sessionId);
      }
    });

    const unsubMessage = wsManager.onMessage((data) => {
      if (data.type === 'status' && data.status === 'thinking') {
        setIsThinking(true);
      } else if (data.type === 'message' && data.role === 'assistant') {
        setIsThinking(false);
        setIsLoading(false);
        addMessage({
          role: 'assistant',
          content: data.content || '',
          timestamp: new Date().toISOString(),
        });
        loadSessions();
      }
    });

    return () => {
      unsubStatus();
      unsubMessage();
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const loadSessions = async () => {
    try {
      const list = await listSessions();
      setSessions(list);
    } catch {
      // Backend may not be running yet
    }
  };

  const loadSessionMessages = async (key: string) => {
    try {
      const detail = await getSession(key);
      setMessages(detail.messages);
    } catch {
      setMessages([]);
    }
  };

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput('');
    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    addMessage(userMsg);
    setIsLoading(true);
    setIsThinking(false);

    // Send via WebSocket if connected, otherwise fallback to HTTP POST
    const wsSessionId = sessionId.startsWith('web:')
      ? sessionId.slice(4)
      : sessionId;

    if (wsManager.getStatus() === 'connected') {
      wsManager.sendMessage(text);
    } else {
      try {
        await sendMessage(text, sessionId);
      } catch {
        setIsLoading(false);
        addMessage({
          role: 'assistant',
          content: 'Error: Failed to send message. Is the backend running?',
          timestamp: new Date().toISOString(),
        });
      }
    }
  }, [input, isLoading, sessionId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewSession = () => {
    const id = `web:${Date.now()}`;
    setSessionId(id);
    clearMessages();
  };

  const handleDeleteSession = async (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteSession(key);
      if (key === sessionId) {
        setSessionId('web:default');
        clearMessages();
      }
      loadSessions();
    } catch {
      // ignore
    }
  };

  const handleSelectSession = (key: string) => {
    setSessionId(key);
  };

  const formatSessionName = (key: string) => {
    if (key.startsWith('web:')) {
      const id = key.slice(4);
      if (id === 'default') return 'Default';
      const n = Number(id);
      if (!isNaN(n)) {
        return new Date(n).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
      return id;
    }
    return key;
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Sidebar */}
      <div className="w-64 border-r border-border flex flex-col bg-card">
        <div className="p-3">
          <Button
            onClick={handleNewSession}
            variant="outline"
            className="w-full justify-start gap-2"
            size="sm"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </Button>
        </div>
        <Separator />
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {sessions.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-4 text-center">
                No conversations yet
              </p>
            )}
            {sessions.map((s) => (
              <div
                key={s.key}
                onClick={() => handleSelectSession(s.key)}
                className={`group flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer text-sm ${
                  s.key === sessionId
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/50'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{formatSessionName(s.key)}</span>
                </div>
                <button
                  onClick={(e) => handleDeleteSession(s.key, e)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-destructive transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <ScrollArea className="flex-1 px-4">
          <div className="max-w-3xl mx-auto py-4 space-y-4">
            {messages.length === 0 && !isThinking && (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Bot className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">nanobot</p>
                <p className="text-sm">Send a message to start chatting</p>
              </div>
            )}

            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} />
            ))}

            {/* Thinking indicator */}
            {(isThinking || (isLoading && messages.length > 0 && messages[messages.length - 1]?.role === 'user')) && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Bot className="w-5 h-5" />
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input area */}
        <div className="border-t border-border p-4">
          <div className="max-w-3xl mx-auto flex gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
              rows={1}
              className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              style={{ minHeight: '40px', maxHeight: '200px' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
              }}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="h-10 w-10 flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  isStreaming,
}: {
  message: ChatMessage;
  isStreaming?: boolean;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot className="w-4 h-4 text-primary" />
        </div>
      )}
      <div
        className={`rounded-lg px-4 py-2 max-w-[80%] ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-card border border-border'
        }`}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <ReactMarkdown>{message.content}</ReactMarkdown>
            {isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-foreground/60 animate-pulse ml-0.5 align-middle" />
            )}
          </div>
        )}
      </div>
      {isUser && (
        <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5">
          <User className="w-4 h-4" />
        </div>
      )}
    </div>
  );
}
