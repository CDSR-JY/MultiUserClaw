'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  Puzzle,
  Upload,
  Download,
  Trash2,
  RefreshCw,
  Loader2,
  AlertCircle,
  X,
} from 'lucide-react';
import { listSkills, deleteSkill, uploadSkill, downloadSkill } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Skill } from '@/types';

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadSkills = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listSkills();
      setSkills(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load skills');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSkills();
  }, []);

  const handleDelete = async (name: string) => {
    setDeleting(name);
  };

  const confirmDelete = async (name: string) => {
    try {
      await deleteSkill(name);
      setDeleting(null);
      loadSkills();
    } catch (err: any) {
      setError(err.message || 'Failed to delete skill');
      setDeleting(null);
    }
  };

  const handleUploadDone = () => {
    setShowUpload(false);
    loadSkills();
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
          <Puzzle className="w-6 h-6" />
          Skills
        </h1>
        <div className="flex items-center gap-2">
          <Button onClick={loadSkills} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowUpload(true)} size="sm">
            <Upload className="w-4 h-4 mr-2" />
            Upload Skill
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

      {/* Upload Dialog */}
      {showUpload && (
        <UploadSkillForm
          onDone={handleUploadDone}
          onCancel={() => setShowUpload(false)}
          onError={(msg) => setError(msg)}
        />
      )}

      {/* Delete Confirmation */}
      {deleting && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm">
                Delete skill <strong>{deleting}</strong>? This cannot be undone.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleting(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => confirmDelete(deleting)}
                >
                  Delete
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Skills Table */}
      <Card>
        <CardContent className="p-0">
          {skills.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Puzzle className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No skills found</p>
              <p className="text-sm mt-1">
                Upload a skill zip file to get started
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {skills.map((skill) => (
                  <TableRow key={`${skill.source}:${skill.name}`}>
                    <TableCell className="font-medium">{skill.name}</TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground truncate max-w-[300px] block">
                        {skill.description}
                      </span>
                    </TableCell>
                    <TableCell>
                      {skill.source === 'builtin' ? (
                        <Badge variant="secondary" className="text-xs">
                          builtin
                        </Badge>
                      ) : (
                        <Badge variant="default" className="text-xs">
                          workspace
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {skill.available ? (
                        <Badge variant="default" className="text-xs bg-green-600">
                          Available
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          Unavailable
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Download"
                          onClick={() => downloadSkill(skill.name).catch((e) => setError(e.message))}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                        {skill.source === 'workspace' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(skill.name)}
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
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

function UploadSkillForm({
  onDone,
  onCancel,
  onError,
}: {
  onDone: () => void;
  onCancel: () => void;
  onError: (msg: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      await uploadSkill(file);
      onDone();
    } catch (err: any) {
      onError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Upload Skill</CardTitle>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="skill-zip">
              Skill Zip File
            </label>
            <input
              id="skill-zip"
              ref={fileRef}
              type="file"
              accept=".zip"
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
            />
            <p className="text-xs text-muted-foreground">
              Zip archive must contain a SKILL.md file
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
