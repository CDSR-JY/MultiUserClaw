// Nanobot frontend types

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: string;
  quota_tier: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user_id: string;
  username: string;
  role: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface Session {
  key: string;
  created_at?: string;
  updated_at?: string;
  path?: string;
}

export interface SessionDetail {
  key: string;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

export interface ProviderStatus {
  name: string;
  has_key: boolean;
  detail?: string;
}

export interface ChannelStatus {
  name: string;
  enabled: boolean;
}

export interface SystemStatus {
  config_path: string;
  config_exists: boolean;
  workspace: string;
  workspace_exists: boolean;
  model: string;
  max_tokens: number;
  temperature: number;
  max_tool_iterations: number;
  providers: ProviderStatus[];
  channels: ChannelStatus[];
  cron: {
    enabled: boolean;
    jobs: number;
    next_wake_at_ms: number | null;
  };
}

export interface CronJob {
  id: string;
  name: string;
  enabled: boolean;
  schedule_kind: 'at' | 'every' | 'cron';
  schedule_display: string;
  schedule_expr: string | null;
  schedule_every_ms: number | null;
  message: string;
  deliver: boolean;
  channel: string | null;
  to: string | null;
  next_run_at_ms: number | null;
  last_run_at_ms: number | null;
  last_status: string | null;
  last_error: string | null;
  created_at_ms: number;
}
