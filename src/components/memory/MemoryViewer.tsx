import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { listWorkspaceFiles, readWorkspaceFile } from "@/services/tauri-commands";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import type { FileEntry } from "@/types/ui";

interface MemoryViewerProps { agentId: string; }

export function MemoryViewer({ agentId }: MemoryViewerProps) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [dirFiles, setDirFiles] = useState<Map<string, FileEntry[]>>(new Map());

  useEffect(() => { listWorkspaceFiles(agentId, ".").then((f) => setFiles(f ?? [])).catch(console.error); }, [agentId]);

  useEffect(() => {
    if (!selectedFile) { setContent(null); return; }
    setLoading(true);
    readWorkspaceFile(agentId, selectedFile).then((c) => setContent(c)).catch(() => setContent(null)).finally(() => setLoading(false));
  }, [agentId, selectedFile]);

  const toggleDir = async (dirName: string) => {
    const next = new Set(expandedDirs);
    if (next.has(dirName)) { next.delete(dirName); }
    else {
      next.add(dirName);
      if (!dirFiles.has(dirName)) {
        try {
          const entries = await listWorkspaceFiles(agentId, dirName);
          setDirFiles((prev) => new Map(prev).set(dirName, entries ?? []));
        } catch (err) { console.error("Failed to list dir:", err); }
      }
    }
    setExpandedDirs(next);
  };

  return (
    <div className="flex h-full">
      <div className="w-60 overflow-y-auto border-r border-border-primary bg-bg-secondary p-2">
        {files.map((file) => (
          <div key={file.name}>
            {file.kind === "directory" ? (
              <>
                <button onClick={() => toggleDir(file.name)} className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm text-text-secondary hover:bg-bg-hover">
                  <span>{expandedDirs.has(file.name) ? "📂" : "📁"}</span><span>{file.name}/</span>
                </button>
                {expandedDirs.has(file.name) && dirFiles.get(file.name)?.map((sub) => (
                  <button key={sub.name} onClick={() => setSelectedFile(`${file.name}/${sub.name}`)}
                    className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1 pl-6 text-sm", selectedFile === `${file.name}/${sub.name}` ? "bg-bg-active text-text-primary" : "text-text-secondary hover:bg-bg-hover")}>
                    <span>📄</span><span className="truncate">{sub.name}</span>
                  </button>
                ))}
              </>
            ) : (
              <button onClick={() => file.kind === "missing" ? undefined : setSelectedFile(file.name)} disabled={file.kind === "missing"}
                className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm", file.kind === "missing" ? "text-text-tertiary cursor-not-allowed" : selectedFile === file.name ? "bg-bg-active text-text-primary" : "text-text-secondary hover:bg-bg-hover")}>
                <span>📄</span><span className="truncate">{file.name}</span>
                {file.kind === "missing" && <span className="text-xs text-text-tertiary">(not found)</span>}
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? <p className="text-sm text-text-tertiary">Loading…</p> : !selectedFile ? (
          <EmptyState icon="📄" title="Select a file" description="Choose a file from the browser to view its contents." />
        ) : content === null ? (
          <EmptyState icon="❓" title="File not found" description="This file does not exist in the agent's workspace." />
        ) : (
          <div className="prose prose-sm max-w-none text-text-primary">
            <div className="mb-4 flex items-center gap-2 text-xs text-text-tertiary">
              <span className="font-mono">{selectedFile}</span><span className="rounded bg-bg-secondary px-1.5 py-0.5">Read-only</span>
            </div>
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>{content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}