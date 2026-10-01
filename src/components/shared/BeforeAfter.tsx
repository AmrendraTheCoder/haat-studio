"use client";

import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

/**
 * Drag to compare the model photo (before) with the try-on result (after).
 * Pointer events cover mouse, touch and pen; arrow keys move the divider
 * when the handle has focus. Both images use the same box and object-cover,
 * so a result generated from that model photo lines up with it.
 */
export function BeforeAfter({
  before,
  after,
  className = "",
  beforeLabel = "Before",
  afterLabel = "After",
}: {
  before: string;
  after: string;
  className?: string;
  beforeLabel?: string;
  afterLabel?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(50);
  const [dragging, setDragging] = useState(false);

  const moveTo = useCallback((clientX: number) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    setPos(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)));
  }, []);

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    moveTo(e.clientX);
  };
  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2;
    if (e.key === "ArrowLeft") setPos((p) => Math.max(0, p - step));
    else if (e.key === "ArrowRight") setPos((p) => Math.min(100, p + step));
    else if (e.key === "Home") setPos(0);
    else if (e.key === "End") setPos(100);
    else return;
    e.preventDefault();
  };

  return (
    <div
      ref={box}
      onPointerDown={onDown}
      onPointerMove={(e) => dragging && moveTo(e.clientX)}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      className={`relative touch-none overflow-hidden bg-paper-3 select-none ${dragging ? "cursor-grabbing" : "cursor-ew-resize"} ${className}`}
    >
      <img src={after} alt={afterLabel} draggable={false} className="absolute inset-0 size-full object-cover" />
      <img
        src={before}
        alt={beforeLabel}
        draggable={false}
        className="absolute inset-0 size-full object-cover"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      />
      <span className="pointer-events-none absolute top-3 left-3 rounded-full bg-ink/75 px-2.5 py-1 font-mono text-[11px] text-paper">
        {beforeLabel}
      </span>
      <span className="pointer-events-none absolute top-3 right-3 rounded-full bg-accent-strong px-2.5 py-1 font-mono text-[11px] text-paper">
        {afterLabel}
      </span>
      <div className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-paper shadow" style={{ left: `${pos}%` }} />
      <div
        role="slider"
        tabIndex={0}
        aria-label="Compare before and after"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos)}
        onKeyDown={onKey}
        className="absolute top-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-line bg-paper text-ink shadow-lg"
        style={{ left: `${pos}%` }}
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="m9 7-5 5 5 5M15 7l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
