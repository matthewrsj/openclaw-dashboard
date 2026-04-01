export function TitleBar() {
  return (
    <div
      data-tauri-drag-region
      className="flex h-10 shrink-0 items-center justify-center border-b border-border-primary bg-bg-secondary"
    >
      <span className="text-xs font-medium text-text-secondary">
        OpenClaw Dashboard
      </span>
    </div>
  );
}
