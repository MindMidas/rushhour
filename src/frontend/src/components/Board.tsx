import { useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Model, Vehicle } from "../../types";
import { COLORS, lengthOf, RED_ROW, TRUCKS } from "../model";

interface Props {
  vehicles: Vehicle[];
  selected: Model;
  playback: boolean;
  onCell: (x: number, y: number) => boolean;
  onSelect: (model: Model) => void;
  onMove: (vehicle: Vehicle, anchorX: number, anchorY: number, pointerX: number, pointerY: number) => boolean;
}

interface DragPreview {
  model: Model;
  anchorX: number;
  anchorY: number;
  reverting?: boolean;
}

const SNAP_MS = 220;

export function Board({ vehicles, selected, playback, onCell, onSelect, onMove }: Props) {
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);

  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>, vehicle: Vehicle) => {
    if (playback) return;
    const board = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!board) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const cellSize = board.width / 6;
    const grabOffsetX = (event.clientX - board.left) / cellSize - vehicle.x;
    const grabOffsetY = (event.clientY - board.top) / cellSize - vehicle.y;
    let moved = false;

    const cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };

    const move = (pointer: PointerEvent) => {
      moved = true;
      const pointerX = (pointer.clientX - board.left) / cellSize;
      const pointerY = (pointer.clientY - board.top) / cellSize;
      setDragPreview({
        model: vehicle.model,
        anchorX: pointerX - grabOffsetX,
        anchorY: vehicle.model === "X" ? RED_ROW : pointerY - grabOffsetY,
      });
    };

    const up = (pointer: PointerEvent) => {
      cleanup();
      if (moved) {
        const pointerX = (pointer.clientX - board.left) / cellSize;
        const pointerY = (pointer.clientY - board.top) / cellSize;
        const anchorX = pointerX - grabOffsetX;
        const anchorY = vehicle.model === "X" ? RED_ROW : pointerY - grabOffsetY;
        if (onMove(vehicle, anchorX, anchorY, pointerX, pointerY)) {
          setDragPreview(null);
        } else {
          setDragPreview({ model: vehicle.model, anchorX: vehicle.x, anchorY: vehicle.y, reverting: true });
          window.setTimeout(() => setDragPreview(null), SNAP_MS);
        }
      } else {
        setDragPreview(null);
        onSelect(vehicle.model);
      }
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  return (
    <div className="board-wrap">
      <div className={`board ${playback ? "playback-mode" : ""}`} aria-label="6 by 6 Rush Hour board">
        {Array.from({ length: 36 }, (_, index) => {
          const x = index % 6;
          const y = Math.floor(index / 6);
          return (
            <button
              key={index}
              type="button"
              className="grid-cell"
              style={{ left: `${x * 100 / 6}%`, top: `${y * 100 / 6}%` }}
              aria-label={`Column ${x + 1}, row ${y + 1}`}
              onClick={() => onCell(x, y)}
            />
          );
        })}
        {vehicles.map(vehicle => {
          const length = lengthOf(vehicle.model);
          const preview = dragPreview?.model === vehicle.model ? dragPreview : null;
          const x = preview ? preview.anchorX : vehicle.x;
          const y = preview ? preview.anchorY : vehicle.y;
          return (
            <button
              key={vehicle.model}
              type="button"
              className={`vehicle ${vehicle.orientation === "H" ? "horizontal" : "vertical"} ${TRUCKS.has(vehicle.model) ? "truck" : "car"} ${!playback && selected === vehicle.model ? "selected" : ""} ${preview && !preview.reverting ? "dragging" : ""} ${preview?.reverting ? "drag-revert" : ""}`}
              style={{
                backgroundColor: COLORS[vehicle.model],
                left: `${x * 100 / 6}%`,
                top: `${y * 100 / 6}%`,
                width: `${(vehicle.orientation === "H" ? length : 1) * 100 / 6}%`,
                height: `${(vehicle.orientation === "V" ? length : 1) * 100 / 6}%`,
                ["--vehicle-length" as string]: String(length),
              }}
              onPointerDown={event => startDrag(event, vehicle)}
            >
              <span className="vehicle-wheels" aria-hidden="true" />
              <span className="vehicle-panel" aria-hidden="true" />
              <span className="vehicle-label">{vehicle.model}</span>
              <span className="vehicle-lights" aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <div className="exit-road" aria-label="Exit road"><span>EXIT</span><i /></div>
    </div>
  );
}
