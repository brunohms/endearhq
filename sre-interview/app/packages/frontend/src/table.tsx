import type { ReactNode } from "react";
import { PAGE_SIZE } from "./api.js";
import type { Page } from "./types.js";

export const shortId = (id: string) => id.slice(0, 8);
export const time = (iso: string) => new Date(iso).toLocaleString();

export function TableState<T>({
  page,
  error,
  label,
  children,
}: {
  page: Page<T> | null;
  error: string | null;
  label: string;
  children: ReactNode;
}) {
  if (error)
    return (
      <p className="error">
        Could not load {label}: {error}
      </p>
    );
  if (page === null) return <p className="empty">Loading {label}…</p>;
  if (page.total === 0)
    return <p className="empty">No {label} yet. Post one to /ingest.</p>;
  if (page.rows.length === 0)
    return (
      <p className="empty">
        Nothing on this page. There are {page.total} {label} in all.
      </p>
    );
  return <>{children}</>;
}

export function Pager<T>({
  page,
  onPage,
}: {
  page: Page<T>;
  onPage: (next: number) => void;
}) {
  const size = page.limit || PAGE_SIZE;
  const current = Math.floor(page.offset / size) + 1;
  const pages = Math.max(1, Math.ceil(page.total / size));
  const from = page.rows.length === 0 ? 0 : page.offset + 1;
  const to = page.offset + page.rows.length;
  const previous = Math.min(current - 1, pages);

  return (
    <div className="pager">
      <button
        type="button"
        disabled={current <= 1}
        onClick={() => onPage(previous)}
      >
        ← Previous
      </button>
      <span className="range">
        {from === 0 ? `0 of ${page.total}` : `${from}–${to} of ${page.total}`}
        {current > 1 && <span className="paused"> · paused while you page</span>}
      </span>
      <button
        type="button"
        disabled={current >= pages}
        onClick={() => onPage(current + 1)}
      >
        Next →
      </button>
    </div>
  );
}
