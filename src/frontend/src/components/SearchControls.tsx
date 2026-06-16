import type { Algorithm, Heuristic } from "../../types";
import { SelectField } from "./SelectField";

interface Props {
  algorithm: Algorithm;
  heuristic: Heuristic;
  solving: boolean;
  cooldown: boolean;
  notice: string | null;
  onAlgorithm: (value: Algorithm) => void;
  onHeuristic: (value: Heuristic) => void;
  onSolve: () => void;
  onCancel: () => void;
}

export function SearchControls(props: Props) {
  return <section className={`search-toolbar workspace-card ${props.solving ? "solving" : ""}`} aria-label="Search strategy" aria-busy={props.solving}>
    <div className="section-heading"><div><p className="section-kicker">Search strategy</p><h2>Configure solver</h2></div></div>
    <div className="search-control"><label>Algorithm</label><div className="segmented segmented-three" role="group" aria-label="Search algorithm">
      {([["bestFS","A*"],["bfs","BFS"],["dfs","DFS"]] as const).map(([value,label]) => <button key={value} type="button" className={props.algorithm === value ? "active" : ""} onClick={() => props.onAlgorithm(value)}>{label}</button>)}
    </div></div>
    <div className="search-control"><SelectField<Heuristic> label="Heuristic" disabled={props.algorithm !== "bestFS"} value={props.heuristic} onChange={props.onHeuristic} options={[["h1", "h1 · Distance"], ["h2", "h2 · Distance + blockers"], ["h3", "h3 · Clear blockers"]]} /></div>
    <div className="search-actions"><button className="primary" type="button" disabled={props.solving || props.cooldown} onClick={props.onSolve}>{props.solving ? <><span className="inline-spinner" />Searching...</> : props.cooldown ? "Cooling down" : "Solve puzzle"}</button>{props.solving && <button className="secondary" type="button" onClick={props.onCancel}>Cancel</button>}</div>
    {props.notice && <p className="search-notice" role="status">{props.notice}</p>}
  </section>;
}
