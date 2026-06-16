import type { Model, Orientation } from "../../types";
import { MODELS } from "../../types";
import { COLORS } from "../model";

interface Props {
  vehicles: Model[];
  selected: Model;
  orientation: Orientation;
  onSelect: (model: Model) => void;
  onOrientation: (value: Orientation) => void;
  onRemove: () => void;
}

export function VehicleControls(props: Props) {
  return <section className="vehicle-toolbar workspace-card" aria-label="Vehicle library">
    <div className="vehicle-library-heading"><div className="kicker-row"><p className="section-kicker">Board editor</p><span className="badge">{props.vehicles.length} placed</span></div><h2>Vehicle library</h2></div>
    <div className="orientation-heading"><p className="section-kicker">Orientation</p><h2>Vehicle direction</h2></div>
    <div className="vehicle-palette">{MODELS.map(model => <button key={model} type="button" style={{ backgroundColor: COLORS[model] }} className={`vehicle-choice ${props.selected === model ? "active" : ""} ${props.vehicles.includes(model) ? "placed" : ""}`} onClick={() => props.onSelect(model)}>{model}</button>)}</div>
    <div className="vehicle-toolbar-actions"><div className="field"><div className="segmented" role="group" aria-label="Vehicle orientation">
      <button type="button" className={props.orientation === "H" ? "active" : ""} onClick={() => props.onOrientation("H")}>Horizontal</button>
      <button type="button" className={props.orientation === "V" ? "active" : ""} disabled={props.selected === "X"} onClick={() => props.onOrientation("V")}>Vertical</button>
    </div><button className="secondary remove-vehicle" type="button" disabled={!props.vehicles.includes(props.selected)} onClick={props.onRemove}>Remove selected</button></div></div>
  </section>;
}
