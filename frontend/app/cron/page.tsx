'use client';

import React, { useEffect, useState } from 'react';
import {
  Clock,
  Plus,
  Trash2,
  Play,
  RefreshCw,
  Loader2,
  AlertCircle,
  X,
} from 'lucide-react';
import {
  listCronJobs,
  addCronJob,
  removeCronJob,
  toggleCronJob,
  runCronJob,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CronJob } from '@/types';

export default function CronPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const loadJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listCronJobs(true);
      setJobs(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const handleToggle = async (jobId: string, enabled: boolean) => {
    try {
      await toggleCronJob(jobId, enabled);
      loadJobs();
    } catch {
      // ignore
    }
  };

  const handleDelete = async (jobId: string) => {
    try {
      await removeCronJob(jobId);
      loadJobs();
    } catch {
      // ignore
    }
  };

  const handleRun = async (jobId: string) => {
    try {
      await runCronJob(jobId);
      loadJobs();
    } catch {
      // ignore
    }
  };

  const handleAdd = async (params: {
    name: string;
    message: string;
    every_seconds?: number;
    cron_expr?: string;
  }) => {
    try {
      await addCronJob(params);
      setShowAdd(false);
      loadJobs();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const formatTime = (ms: number | null) => {
    if (!ms) return '-';
    return new Date(ms).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Clock className="w-6 h-6" />
          Scheduled Jobs
        </h1>
        <div className="flex items-center gap-2">
          <Button onClick={loadJobs} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowAdd(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Job
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Job Form */}
      {showAdd && (
        <AddJobForm
          onAdd={handleAdd}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {/* Jobs Table */}
      <Card>
        <CardContent className="p-0">
          {jobs.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No scheduled jobs</p>
              <p className="text-sm mt-1">
                Add a job to run agent tasks on a schedule
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Active</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead>Next Run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <Switch
                        checked={job.enabled}
                        onCheckedChange={(checked) =>
                          handleToggle(job.id, checked)
                        }
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div>
                        <span>{job.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {job.id}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {job.schedule_display}
                      </code>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm truncate max-w-[200px] block">
                        {job.message}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatTime(job.last_run_at_ms)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatTime(job.next_run_at_ms)}
                    </TableCell>
                    <TableCell>
                      {job.last_status === 'ok' && (
                        <Badge variant="default" className="text-xs bg-green-600">
                          OK
                        </Badge>
                      )}
                      {job.last_status === 'error' && (
                        <Badge variant="destructive" className="text-xs">
                          Error
                        </Badge>
                      )}
                      {!job.last_status && (
                        <span className="text-xs text-muted-foreground">
                          -
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleRun(job.id)}
                          title="Run now"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(job.id)}
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AddJobForm({
  onAdd,
  onCancel,
}: {
  onAdd: (params: {
    name: string;
    message: string;
    every_seconds?: number;
    cron_expr?: string;
  }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [scheduleType, setScheduleType] = useState<'every' | 'cron'>('every');
  const [everySeconds, setEverySeconds] = useState('3600');
  const [cronExpr, setCronExpr] = useState('0 9 * * *');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !message.trim()) return;

    const params: any = { name: name.trim(), message: message.trim() };
    if (scheduleType === 'every') {
      params.every_seconds = parseInt(everySeconds, 10) || 3600;
    } else {
      params.cron_expr = cronExpr.trim();
    }
    onAdd(params);
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Add New Job</CardTitle>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Job Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. daily-report"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule-type">Schedule Type</Label>
              <Select
                value={scheduleType}
                onValueChange={(v) => setScheduleType(v as 'every' | 'cron')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="every">Interval (every N seconds)</SelectItem>
                  <SelectItem value="cron">Cron Expression</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {scheduleType === 'every' ? (
            <div className="space-y-2">
              <Label htmlFor="every">Interval (seconds)</Label>
              <Input
                id="every"
                type="number"
                value={everySeconds}
                onChange={(e) => setEverySeconds(e.target.value)}
                min="10"
                placeholder="3600"
              />
              <p className="text-xs text-muted-foreground">
                {parseInt(everySeconds, 10) >= 3600
                  ? `= ${Math.floor(parseInt(everySeconds, 10) / 3600)}h ${Math.floor((parseInt(everySeconds, 10) % 3600) / 60)}m`
                  : parseInt(everySeconds, 10) >= 60
                  ? `= ${Math.floor(parseInt(everySeconds, 10) / 60)}m ${parseInt(everySeconds, 10) % 60}s`
                  : ''}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="cron">Cron Expression</Label>
              <Input
                id="cron"
                value={cronExpr}
                onChange={(e) => setCronExpr(e.target.value)}
                placeholder="0 9 * * *"
              />
              <p className="text-xs text-muted-foreground">
                Format: minute hour day-of-month month day-of-week
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="message">Message for Agent</Label>
            <Input
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Check my emails and summarize"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || !message.trim()}>
              <Plus className="w-4 h-4 mr-2" />
              Add Job
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
