import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Column<T> {
  key: string;
  header: string;
  width?: string;
  sortable?: boolean;
  render: (item: T) => ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  className?: string;
  emptyMessage?: string;
}

type SortDir = "asc" | "desc";

export function Table<T>({ columns, data, keyExtractor, onRowClick, className, emptyMessage = "No data" }: TableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (key: string) => {
    if (sortKey === key) { setSortDir((d) => (d === "asc" ? "desc" : "asc")); }
    else { setSortKey(key); setSortDir("asc"); }
  };

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-primary bg-bg-secondary">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn("px-3 py-2 text-left text-xs font-semibold text-text-secondary", col.sortable && "cursor-pointer select-none hover:text-text-primary")}
                style={col.width ? { width: col.width } : undefined}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                <span className="inline-flex items-center gap-1">
                  {col.header}
                  {col.sortable && sortKey === col.key && <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-3 py-8 text-center text-text-tertiary">{emptyMessage}</td></tr>
          ) : (
            data.map((item) => (
              <tr
                key={keyExtractor(item)}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
                className={cn("border-b border-border-secondary transition-colors", onRowClick && "cursor-pointer hover:bg-bg-hover")}
              >
                {columns.map((col) => <td key={col.key} className="px-3 py-2 text-text-primary">{col.render(item)}</td>)}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
