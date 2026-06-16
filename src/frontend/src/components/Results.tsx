import { useLayoutEffect, useRef, type MouseEvent } from "react";
import type { Run } from "../../types";
import { DIRECTIONS, moveDirection, moveModel } from "../model";

interface Props { active: Run | null; step: number; playing: boolean; onStep: (step: number) => void; onPlay: () => void; }

function scrollActiveMoveIntoView(list: HTMLOListElement, item: HTMLLIElement) {
  const listRect = list.getBoundingClientRect();
  const itemRect = item.getBoundingClientRect();
  const edge = 6;

  if (itemRect.top < listRect.top + edge) {
    list.scrollTop += itemRect.top - listRect.top - edge;
  } else if (itemRect.bottom > listRect.bottom - edge) {
    list.scrollTop += itemRect.bottom - listRect.bottom + edge;
  }
}

export function Results({ active, step, playing, onStep, onPlay }: Props) {
  const moveList = useRef<HTMLOListElement>(null);
  const moves = active?.moves ?? [];
  const total = active?.solved ? moves.length + 1 : 0;
  const algorithmLabel = active
    ? active.algorithm === "bestFS"
      ? "A*"
      : active.algorithm.toUpperCase()
    : "—";
  const heuristicLabel = active?.algorithm === "bestFS" && active.heuristic
    ? active.heuristic.toUpperCase()
    : "—";

  useLayoutEffect(() => {
    const list = moveList.current;
    if (!list) return;
    const activeItem = list.querySelector<HTMLLIElement>("li.active");
    if (!activeItem) return;
    scrollActiveMoveIntoView(list, activeItem);
  }, [step]);

  const handlePlay = (event: MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.blur();
    onPlay();
  };

  return <div className="puzzle-inspector">
    <section className="result-card workspace-card"><div className="section-heading"><div><p className="section-kicker">Results</p><h2>Solution summary</h2></div><span className="badge">{active ? `Step ${step} / ${total}` : "No run"}</span></div>
      <div className="run-context"><div><span>Algorithm</span><strong>{algorithmLabel}</strong></div><div><span>Heuristic</span><strong>{heuristicLabel}</strong></div><div><span>Puzzle</span><strong>{active ? (active.preset ? `Preset ${active.preset}` : "Custom") : "—"}</strong></div></div>
      <div className="metrics"><div><span>Moves</span><strong>{active?.solved ? active.moveCount : "—"}</strong></div><div><span>Time</span><strong>{active ? `${(active.elapsed * 1000).toFixed(1)} ms` : "—"}</strong></div><div><span>Expanded</span><strong>{active?.visited.toLocaleString() ?? "—"}</strong></div><div><span>Discovered</span><strong>{active?.unique.toLocaleString() ?? "—"}</strong></div></div>
    </section>
    <section className="moves-card workspace-card"><div className="card-heading"><div><p className="section-kicker">Move history</p><h2>Move sequence</h2></div><div className="playback" aria-label="Solution playback controls"><button className="icon-button" type="button" disabled={!total || step === 0} onClick={() => onStep(step - 1)}>◀</button><button className="icon-button play" type="button" disabled={!total} onClick={handlePlay}>{playing ? "❚❚" : "▶"}</button><button className="icon-button" type="button" disabled={!total || step === total} onClick={() => onStep(step + 1)}>▶</button></div></div>
      <div className="move-table-heading"><span>Step</span><span>Vehicle</span><span>Direction</span></div>
      <ol ref={moveList} className="move-list">
        {moves.length
          ? moves.map((move, index) => <li key={`${move}-${index}`} className={step === index + 1 ? "active" : ""}><button className="move-row" type="button" onClick={() => onStep(index + 1)}><span className="move-step">{index + 1}</span><strong>{moveModel(move)}</strong><span>{DIRECTIONS[moveDirection(move)]}</span></button></li>)
          : <li className="move-empty-row"><span>Solve a puzzle to inspect its move sequence.</span></li>}
      </ol>
    </section>
  </div>;
}
