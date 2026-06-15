"use client";

import { useState } from "react";
import {
  beadPrayers,
  ROSARY_HIGHLIGHT,
  type BeadType,
  type Devotion,
} from "@/lib/rosary";

/* ------------------------------------------------------------------ *
 * A schematic of a five-decade rosary with the current prayer's
 * bead(s) lit in gold. Structure (per USCCB): crucifix → 1 Our Father
 * bead → 3 Hail Mary beads → centerpiece, then a loop of five decades
 * (1 large + 10 small each). Hover/focus a bead to see its prayer;
 * clicking calls onPick so the parent can show it below.
 * ------------------------------------------------------------------ */

const CX = 120;
const CY = 108;
const R = 92;
const STEP = (2 * Math.PI) / 56; // 55 loop beads + 1 centerpiece slot

function at(k: number): [number, number] {
  const a = Math.PI / 2 + k * STEP; // k=0 → bottom (centerpiece)
  return [CX + R * Math.cos(a), CY + R * Math.sin(a)];
}

const GOLD = "var(--gold)";
const DIM = "var(--parchment)";
const LINE = "var(--hairline)";
const INK = "var(--ink-soft)";
const PICK = "var(--caller)"; // the bead-type the reader tapped

export function RosaryDiagram({
  slug,
  devotion,
  picked,
  onPick,
}: {
  slug: string;
  devotion: Devotion;
  picked: BeadType | null;
  onPick: (type: BeadType) => void;
}) {
  const titlesFor = (type: BeadType) =>
    beadPrayers(devotion, type)
      .map((p) => p.title)
      .join(" · ");

  const hl = ROSARY_HIGHLIGHT[slug];
  const [hovered, setHovered] = useState<BeadType | null>(null);
  if (!hl) return null;

  // Shared interactive props for any bead, tagged with its bead type.
  const bead = (type: BeadType) => ({
    role: "button" as const,
    tabIndex: 0,
    style: { cursor: "pointer", outline: "none" },
    onMouseEnter: () => setHovered(type),
    onMouseLeave: () => setHovered(null),
    onFocus: () => setHovered(type),
    onBlur: () => setHovered(null),
    onClick: () => onPick(type),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onPick(type);
      }
    },
  });

  const loop: React.ReactNode[] = [];
  for (let k = 1; k <= 55; k += 1) {
    const isOF = (k - 1) % 11 === 0;
    const [x, y] = at(k);
    const on = isOF ? hl.decadeOF : hl.decadeHM;
    const type: BeadType = isOF ? "decadeOF" : "decadeHM";
    const sel = type === picked;
    loop.push(
      <circle
        key={`b${k}`}
        cx={x}
        cy={y}
        r={(isOF ? 6.5 : 4) + (sel ? 1 : 0)}
        fill={sel ? PICK : on ? GOLD : DIM}
        stroke={sel ? PICK : on ? GOLD : LINE}
        strokeWidth={sel ? 1.5 : 1}
        {...bead(type)}
      >
        <title>{titlesFor(type)}</title>
      </circle>,
    );
  }

  // Glory Be / O My Jesus sit on the chain after each decade.
  const conns: React.ReactNode[] = [];
  for (let d = 0; d < 5; d += 1) {
    const [x, y] = at(d * 11 + 11.5);
    const sel = picked === "afterDecade";
    conns.push(
      <circle
        key={`c${d}`}
        cx={x}
        cy={y}
        r={sel ? 4 : 3}
        fill={sel ? PICK : hl.afterDecade ? GOLD : "transparent"}
        stroke={sel ? PICK : hl.afterDecade ? GOLD : LINE}
        strokeWidth={sel ? 1.5 : 1}
        {...bead("afterDecade")}
      >
        <title>{titlesFor("afterDecade")}</title>
      </circle>,
    );
  }

  const [mx, my] = at(0); // centerpiece anchor (bottom of loop)
  const pendantX = CX;
  const hmYs = [my + 18, my + 33, my + 48];
  const ofY = my + 67;
  const cruxTop = ofY + 16;

  return (
    <figure className="my-1 flex flex-col items-center">
      <svg
        viewBox="0 0 240 312"
        width="220"
        className="max-w-full"
        role="img"
        aria-label="Rosary diagram — hover or tap a bead to see its prayer"
      >
        {/* Loop + pendant chain */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke={LINE} strokeWidth={1} />
        <line x1={pendantX} y1={my} x2={pendantX} y2={cruxTop} stroke={LINE} strokeWidth={1} />

        {conns}
        {loop}

        {/* Centerpiece medal */}
        <circle
          cx={mx}
          cy={my}
          r={picked === "centerpiece" ? 8 : 7}
          fill={picked === "centerpiece" ? PICK : hl.centerpiece ? GOLD : DIM}
          stroke={picked === "centerpiece" ? PICK : hl.centerpiece ? GOLD : LINE}
          strokeWidth={1.2}
          {...bead("centerpiece")}
        >
          <title>{titlesFor("centerpiece")}</title>
        </circle>

        {/* Pendant: 3 Hail Mary beads, 1 Our Father bead */}
        {hmYs.map((y, i) => (
          <circle
            key={`phm${i}`}
            cx={pendantX}
            cy={y}
            r={4}
            fill={hl.pendantHM ? GOLD : DIM}
            stroke={hl.pendantHM ? GOLD : LINE}
            strokeWidth={1}
            {...bead("pendantHM")}
          >
            <title>{titlesFor("pendantHM")}</title>
          </circle>
        ))}
        <circle
          cx={pendantX}
          cy={ofY}
          r={6.5}
          fill={hl.pendantOF ? GOLD : DIM}
          stroke={hl.pendantOF ? GOLD : LINE}
          strokeWidth={1}
          {...bead("pendantOF")}
        >
          <title>{titlesFor("pendantOF")}</title>
        </circle>

        {/* Crucifix */}
        <g
          stroke={picked === "crucifix" ? PICK : hl.crucifix ? GOLD : INK}
          strokeWidth={picked === "crucifix" || hl.crucifix ? 3 : 2}
          strokeLinecap="round"
          {...bead("crucifix")}
        >
          <title>{titlesFor("crucifix")}</title>
          {/* invisible hit area so the thin cross is easy to hover/tap */}
          <rect
            x={pendantX - 12}
            y={cruxTop - 2}
            width={24}
            height={30}
            fill="transparent"
            stroke="none"
          />
          <line x1={pendantX} y1={cruxTop} x2={pendantX} y2={cruxTop + 24} />
          <line x1={pendantX - 8} y1={cruxTop + 8} x2={pendantX + 8} y2={cruxTop + 8} />
        </g>
      </svg>

      <figcaption
        aria-live="polite"
        className="mt-2 min-h-[1.5rem] text-center font-sans text-sm text-ink-soft"
      >
        {hovered ? (
          <span className="font-medium text-ink">{titlesFor(hovered)}</span>
        ) : (
          <span className="text-ink-faint">
            Tap a bead to open its prayer · gold marks this one
          </span>
        )}
      </figcaption>
    </figure>
  );
}
