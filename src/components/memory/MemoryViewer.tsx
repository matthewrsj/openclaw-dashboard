import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { listWorkspaceFiles, readWorkspaceFile, writeWorkspaceFile } from "@/services/tauri-commands";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { useUIStore } from "@/stores/ui";
import type { FileEntry } from "@/types/ui";

interface MemoryViewerProps {
  agentId: string;
}

export function MemoryViewer({ agentId }: MemoryViewerProps) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [dirFiles, setDirFiles] = useState<Map<string, FileEntry[]>>(new Map());
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const addToast = useUIStore((s) => s.addToast);

  useEffect(() => {
    listWorkspaceFiles(agentId, ".").then((f) => setFiles(f ?? [])).catch(console.error);
  }, [agentId]);

  useEffect(() => {
    if (!selectedFile) {
      setContent(null);
      return;
    }
    setLoading(true);
    readWorkspaceFile(agentId, selectedFile)
      .then((c) => setContent(c))
      .catch(() => setContent(null))
      .finally(() => setLoading(false));
  }, [agentId, selectedFile]);

  // Exit edit mode whenever a different file is selected.
  useEffect(() => {
    setEditing(false);
    setEditContent("");
  }, [selectedFile]);

  const toggleDir = async (dirName: string) => {
    const next = new Set(expandedDirs);
    if (next.has(dirName)) {
      next.delete(dirName);
    } else {
      next.add(dirName);
      if (!dirFiles.has(dirName)) {
        try {
          const entries = await listWorkspaceFiles(agentId, dirName);
          setDirFiles((prev) => new Map(prev).set(dirName, entries ?? []));
        } catch (err) {
          console.error("Failed to list dir:", err);
        }
      }
    }
    setExpandedDirs(next);
  };

  const handleEdit = () => {
    setEditContent(content ?? "");
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setEditContent("");
  };

  const handleSave = async () => {
    if (!selectedFile) return;
    setSaving(true);
    try {
      await writeWorkspaceFile(agentId, selectedFile, editContent);
      setContent(editContent);
      setEditing(false);
      setEditContent("");
      addToast({ type: "success", message: "File saved", description: selectedFile });
    } catch (err) {
      console.error("Failed to save workspace file:", err);
      addToast({ type: "error", message: "Save failed", description: "Could not write file. Check permissions and try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full">
      <div className="w-60 overflow-y-auto border-r border-border-primary bg-bg-secondary p-2">
        {files.map((file) => (
          <div key={file.name}>
            {file.kind === "directory" ? (
              <>
                <button
                  onClick={() => toggleDir(file.name)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm text-text-secondary hover:bg-bg-hover"
                >
                  <span>{expandedDirs.has(file.name) ? "📂" : "📁"}</span>
                  <span>{file.name}/</span>
                </button>
                {expandedDirs.has(file.name) &&
                  dirFiles.get(file.name)?.map((sub) => (
                    <button
                      key={sub.name}
                      onClick={() => setSelectedFile(`${file.name}/${sub.name}`)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1 pl-6 text-sm",
                        selectedFile === `${file.name}/${sub.name}`
                          ? "bg-bg-active text-text-primary"
                          : "text-text-secondary hover:bg-bg-hover",
                      )}
                    >
                      <span>📄</span>
                      <span className="truncate">{sub.name}</span>
                    </button>
                  ))}
              </>
            ) : (
              <button
                onClick={() => (file.kind === "missing" ? undefined : setSelectedFile(file.name))}
                disabled={file.kind === "missing"}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm",
                  file.kind === "missing"
                    ? "cursor-not-allowed text-text-tertiary"
                    : selectedFile === file.name
                      ? "bg-bg-active text-text-primary"
                      : "text-text-secondary hover:bg-bg-hover",
                )}
              >
                <span>📄</span>
                <span className="truncate">{file.name}</span>
                {file.kind === "missing" && (
                  <span className="text-xs text-text-tertiary">(not found)</span>
                )}
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        {loading ? (
          <div className="flex-1 p-6">
            <p className="text-sm text-text-tertiary">Loading...</p>
          </div>
        ) : !selectedFile ? (
          <div className="flex-1 p-6">
            <EmptyState
              icon="📄"
              title="Select a file"
              description="Choose a file from the browser to view its contents."
            />
          </div>
        ) : content === null ? (
          <div className="flex-1 p-6">
            <EmptyState
              icon="❓"
              title="File not found"
              description="This file does not exist in the agent's workspace."
            />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-border-primary px-6 py-3">
              <span className="flex-1 truncate font-mono text-xs text-text-tertiary">
                {selectedFile}
              </span>
              {editing ? (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={handleCancel} disabled={saving}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? "Saving..." : "Save"}
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={handleEdit}>
                  Edit
                </Button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {editing ? (
                <Textarea
                  className="h-full min-h-[400px] w-full resize-none font-mono text-xs"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  disabled={saving}
                  autoFocus
                />
              ) : (
                <div className="prose prose-sm max-w-none text-text-primary">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                    {content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
