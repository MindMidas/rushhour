import { useEffect, useState } from "react";
import type { Run } from "../../types";
import { runStatus } from "../model";

const APP_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const assetUrl = (path: string) => `${APP_BASE}${path.startsWith("/") ? path : `/${path}`}`;

interface Props {
  report: boolean;
  runs: Run[];
  active: Run | null;
  onReport: () => void;
  onRun: (run: Run) => void;
  onDelete: (id: number) => void;
  onClear: () => void;
}

function DocumentIcon() {
  return <svg aria-hidden="true" viewBox="0 0 16 16" fill="currentColor"><path d="M4.5 0A1.5 1.5 0 0 0 3 1.5v13A1.5 1.5 0 0 0 4.5 16h7a1.5 1.5 0 0 0 1.5-1.5V4.62a1.5 1.5 0 0 0-.44-1.06L9.94.44A1.5 1.5 0 0 0 8.88 0H4.5ZM8.5 1v3a1 1 0 0 0 1 1h3L8.5 1Z" /></svg>;
}

function GitHubIcon() {
  return <svg aria-hidden="true" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.49c-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.6 7.6 0 0 1 8 3.86c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 0Z" /></svg>;
}

function runStateLabel(run: Run): string {
  if (run.solved) return "solved";
  if (run.stoppedReason === "cancelled") return "cancelled";
  if (run.stoppedReason === "timeout") return "timeout";
  return "unsolved";
}

function formatRuntime(run: Run): string {
  return `${Math.round(run.elapsed * 1000)}ms`;
}

function formatSearch(run: Run): string {
  if (run.algorithm === "bestFS") return run.heuristic ? `A* ${run.heuristic}` : "A*";
  return run.algorithm.toUpperCase();
}

function formatPuzzle(run: Run): string {
  return run.preset ? `Preset ${run.preset}` : "Custom board";
}

function formatMeta(run: Run): string {
  const outcome = run.solved ? `${run.moveCount} moves` : runStatus(run);
  return `${formatSearch(run)} · ${outcome} · ${run.visited.toLocaleString()} expanded`;
}

function SidebarBrand({ className = "" }: { className?: string }) {
  return (
    <div className={`sidebar-brand${className ? ` ${className}` : ""}`}>
      <img className="sidebar-brand-logo" src={assetUrl("/assets/rushhour_white.png")} alt="" />
      <div className="sidebar-brand-copy">
        <strong>RUSH HOUR</strong>
        <span>interactive puzzle solver</span>
      </div>
    </div>
  );
}

export function Sidebar({ report, runs, active, onReport, onRun, onDelete, onClear }: Props) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const toggle = () => setOpen((current) => !current);

  return <div className="sidebar-shell">
    <header className="mobile-topbar mobile-header-bar">
      <SidebarBrand className="mobile-topbar-brand" />
      <button type="button" className={`menu-toggle${open ? " is-open" : ""}`} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={toggle}>
        <span className="menu-bar" aria-hidden="true" />
        <span className="menu-bar" aria-hidden="true" />
        <span className="menu-bar" aria-hidden="true" />
      </button>
    </header>
    <button className={`sidebar-backdrop ${open ? "open" : ""}`} type="button" onClick={close} aria-label="Close menu" tabIndex={open ? 0 : -1} />
    <div className={`sidebar-column ${open ? "open" : ""}`}>
      <aside className="tool-panel"><div className="tool-panel-body">
        <SidebarBrand className="sidebar-drawer-brand" />
        <div className="sidebar-main">
          <p className="sidebar-description">Build a board, choose a search strategy, and inspect the solution path.</p>
          <div className="sidebar-section-heading">
            <span className="sidebar-section-title">Run history</span>
            <div className="sidebar-section-actions">
              {runs.length > 0 && <button className="sidebar-clear-button" type="button" onClick={onClear}>Clear</button>}
              <em>{runs.length}</em>
            </div>
          </div>
          <nav className="run-list" aria-label="Session run history">
            {runs.map(run => {
              const state = runStateLabel(run);
              return <div className={`run-list-item ${active?.id === run.id ? "active" : ""}`} key={run.id}>
                <button className="run-select-button" type="button" onClick={() => { onRun(run); close(); }}>
                  <span className="run-list-top">
                    <span className="run-list-title"><strong>#{run.id}</strong><span className="run-list-puzzle">{formatPuzzle(run)}</span><span className="run-list-runtime">{formatRuntime(run)}</span></span>
                    <i className={`run-state run-state-${state}`}>{state}</i>
                  </span>
                  <span className="run-list-meta">{formatMeta(run)}</span>
                </button>
                <button className="run-delete-button" type="button" aria-label={`Delete run #${run.id}`} onClick={() => onDelete(run.id)}>×</button>
              </div>;
            })}
            {!runs.length && <p className="sidebar-empty">Completed searches appear here.</p>}
          </nav>
        </div>
        <div className="sidebar-footer">
          <section className="reference-section" aria-label="Project reference"><p className="reference-kicker">Reference</p>
            <div className="reference-block"><button className={`secondary wide labeled-button ${report ? "active" : ""}`} type="button" onClick={() => { onReport(); close(); }}><DocumentIcon /><span>{report ? "Back to workspace" : "Project write-up"}</span></button></div>
            <div className="reference-block"><a className="secondary wide button-link labeled-button" href="https://github.com/MindMidas/rushhour" target="_blank" rel="noreferrer"><GitHubIcon /><span>Source code</span></a></div>
          </section>
          <p className="sidebar-copyright">© 2026 MindMidas · <a href="https://github.com/MindMidas/rushhour" target="_blank" rel="noreferrer">GitHub</a></p>
        </div>
      </div></aside>
    </div>
  </div>;
}
