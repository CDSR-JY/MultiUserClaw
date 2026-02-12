'use client';

import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Server,
  Cpu,
  Radio,
  Key,
  Loader2,
} from 'lucide-react';
import { getStatus } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { SystemStatus } from '@/types';

export default function StatusPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getStatus();
      setStatus(data);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="w-5 h-5" />
              <div>
                <p className="font-medium">Cannot connect to nanobot backend</p>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Make sure the backend is running: <code className="bg-muted px-1 rounded">nanobot web</code>
                </p>
              </div>
            </div>
            <Button onClick={loadStatus} variant="outline" size="sm" className="mt-4">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!status) return null;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">System Status</h1>
        <Button onClick={loadStatus} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* System Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="w-4 h-4" />
            System
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <InfoRow
            label="Config"
            value={status.config_path}
            ok={status.config_exists}
          />
          <InfoRow
            label="Workspace"
            value={status.workspace}
            ok={status.workspace_exists}
          />
        </CardContent>
      </Card>

      {/* Model Config */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Cpu className="w-4 h-4" />
            Agent Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <InfoRow label="Model" value={status.model} />
          <InfoRow label="Max Tokens" value={String(status.max_tokens)} />
          <InfoRow label="Temperature" value={String(status.temperature)} />
          <InfoRow
            label="Max Tool Iterations"
            value={String(status.max_tool_iterations)}
          />
        </CardContent>
      </Card>

      {/* Providers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="w-4 h-4" />
            Providers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {status.providers.map((p) => (
              <div
                key={p.name}
                className="flex items-center gap-2 text-sm"
              >
                {p.has_key ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-muted-foreground/40" />
                )}
                <span className={p.has_key ? '' : 'text-muted-foreground'}>
                  {p.name}
                </span>
                {p.detail && (
                  <span className="text-xs text-muted-foreground truncate">
                    {p.detail}
                  </span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Channels */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Radio className="w-4 h-4" />
            Channels
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {status.channels.map((ch) => (
              <div key={ch.name} className="flex items-center gap-2 text-sm">
                <Badge
                  variant={ch.enabled ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {ch.enabled ? 'ON' : 'OFF'}
                </Badge>
                <span className="capitalize">{ch.name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Cron Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertCircle className="w-4 h-4" />
            Scheduler
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <InfoRow
            label="Status"
            value={status.cron.enabled ? 'Running' : 'Stopped'}
            ok={status.cron.enabled}
          />
          <InfoRow label="Jobs" value={String(status.cron.jobs)} />
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <code className="bg-muted px-2 py-0.5 rounded text-xs max-w-[400px] truncate">
          {value}
        </code>
        {ok !== undefined &&
          (ok ? (
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          ) : (
            <XCircle className="w-4 h-4 text-destructive" />
          ))}
      </div>
    </div>
  );
}
