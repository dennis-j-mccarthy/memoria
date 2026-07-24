"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import {
  beadPrayers,
  DEVOTION_LABEL,
  mysteriesForDay,
  ROSARY_SEQUENCE,
  sequenceByType,
  type BeadType,
  type Devotion,
  type MysterySet,
  type SeqPhase,
  type SeqStep,
} from "@/lib/rosary";

/* ------------------------------------------------------------------ *
 * A schematic of a five-decade rosary with the current prayer's
 * bead(s) lit in gold. Structure (per USCCB): crucifix → 1 Our Father
 * bead → 3 Hail Mary beads → centerpiece, then a loop of five decades
 * (1 large + 10 small each). Hover/focus a bead to see its prayer;
 * clicking calls onPick so the parent can show it below.
 * ------------------------------------------------------------------ */

const CX = 160;
const CY = 160;
const R = 150; // big loop — fills the width; beads spread out on the larger ring
const STEP = (2 * Math.PI) / 56; // 55 loop beads + 1 centerpiece slot

// Round to 0.001px. Math.cos/sin can differ by 1 ULP between the server (Node)
// and the browser, and the raw value goes straight into an SVG coordinate — so
// the last digit would disagree and trip a hydration mismatch. Rounding makes
// both runtimes serialize the same string; the shift is sub-pixel.
const round = (n: number) => Math.round(n * 1000) / 1000;
function at(k: number): [number, number] {
  const a = Math.PI / 2 + k * STEP; // k=0 → bottom (centerpiece)
  return [round(CX + R * Math.cos(a)), round(CY + R * Math.sin(a))];
}

const GOLD = "var(--gold)";
const DIM = "var(--parchment)";
const LINE = "var(--hairline)";
const INK = "var(--ink-soft)";
const PICK = "var(--caller)"; // the bead-type the reader tapped

// Each bead type is coloured by the prayer said on it. Our Father = maroon,
// Glory Be = amber, the Mary medallion = light blue; Hail Mary (rose) and the
// crucifix (green, for the Sign of the Cross & Creed) fill out the set.
const BEAD_COLOR: Record<BeadType, string> = {
  crucifix: "#3f8261", // green
  pendantOF: "#8a2b3a", // maroon — Our Father
  pendantHM: "#3b82f6", // blue — Hail Mary (Mary)
  decadeOF: "#8a2b3a", // maroon — Our Father
  decadeHM: "#3b82f6", // blue — Hail Mary (Mary)
  centerpiece: "#7fb2dd", // light blue — Mary medallion
  afterDecade: "#d99331", // amber — Glory Be / O My Jesus
};
// The current prayer's beads get a dark ring; a tapped bead a stronger one;
// hovering lights up EVERY bead of that type (all the Marys, all the Our
// Fathers…) with a gold ring.
const HOVER_RING = "var(--accent)"; // orange — visible on every bead colour
const ringFor = (on: boolean, sel: boolean, hov = false) =>
  sel ? "var(--ink)" : hov ? HOVER_RING : on ? "var(--ink-soft)" : "none";
const ringW = (on: boolean, sel: boolean, hov = false) => (sel ? 2 : hov ? 2 : on ? 1.3 : 0);

// Unlabelled chevron that flanks the diagram — step to the prev/next bead.
function StepArrow({ dir, onClick }: { dir: "left" | "right"; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-label={dir === "left" ? "Previous bead" : "Next bead"}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline text-ink-soft transition-colors disabled:opacity-20 enabled:hover:border-gold/60 enabled:hover:text-gold"
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d={dir === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
      </svg>
    </button>
  );
}

export function RosaryDiagram({
  slug,
  devotion,
  picked,
  onPick,
  onPractice,
  textFor,
  onPrev,
  onNext,
}: {
  slug: string;
  devotion: Devotion;
  picked: BeadType | null;
  onPick: (type: BeadType) => void;
  onPractice?: (slug: string) => void;
  textFor?: (slug: string) => string[] | null;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const clipId = "maryMed" + useId().replace(/:/g, "");
  const titlesFor = (type: BeadType) =>
    beadPrayers(devotion, type)
      .map((p) => p.title)
      .join(" · ");

  const [hovered, setHovered] = useState<BeadType | null>(null);
  // Which prayer is showing in the centre readout (multi-prayer beads page
  // through their prayers with prev/next).
  const [prayerIdx, setPrayerIdx] = useState(0);
  // A bead lights up on hover together with every RELATED bead — any bead
  // that carries a shared prayer (all the Hail Marys, pendant and decades).
  const isHov = (t: BeadType): boolean => {
    if (!hovered) return false;
    if (t === hovered) return true;
    const a = beadPrayers(devotion, hovered);
    const b = beadPrayers(devotion, t);
    return a.some((p) => b.some((q) => q.slug === p.slug));
  };
  const [showSeq, setShowSeq] = useState(false);
  const [fs, setFs] = useState(false); // full-screen, labelled view
  const [mounted, setMounted] = useState(false); // portal target only exists client-side
  useEffect(() => setMounted(true), []);

  // Which mysteries to meditate on today — depends on the weekday, so it's
  // read on the client (mount) to avoid an SSR/hydration mismatch.
  const [today, setToday] = useState<MysterySet | null>(null);
  useEffect(() => setToday(mysteriesForDay(new Date().getDay())), []);

  // In full screen: close on Esc and lock body scroll behind the overlay.
  useEffect(() => {
    if (!fs) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFs(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [fs]);

  // Shared interactive props for any bead, tagged with its bead type.
  const bead = (type: BeadType) => ({
    role: "button" as const,
    tabIndex: 0,
    style: { cursor: "pointer", outline: "none" },
    // Hover stays "stuck" on the last bead so the centre readout + its Practice
    // button remain reachable when the pointer moves off the bead toward them.
    onMouseEnter: () => { setHovered(type); setPrayerIdx(0); },
    onFocus: () => { setHovered(type); setPrayerIdx(0); },
    onClick: () => {
      onPick(type);
      setFs(false);
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onPick(type);
        setFs(false);
      }
    },
  });

  const loop: React.ReactNode[] = [];
  for (let k = 1; k <= 55; k += 1) {
    const isOF = (k - 1) % 11 === 0;
    const [x, y] = at(k);
    const type: BeadType = isOF ? "decadeOF" : "decadeHM";
    const sel = type === picked;
    const fill = BEAD_COLOR[type];
    loop.push(
      <circle
        key={`b${k}`}
        cx={x}
        cy={y}
        r={(isOF ? 6.5 : 4) + (sel ? 1 : 0)}
        fill={fill}
        stroke={ringFor(false, sel, isHov(type))}
        strokeWidth={ringW(false, sel, isHov(type))}
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
        fill={BEAD_COLOR.afterDecade}
        stroke={ringFor(false, sel, isHov("afterDecade"))}
        strokeWidth={ringW(false, sel, isHov("afterDecade"))}
        {...bead("afterDecade")}
      >
        <title>{titlesFor("afterDecade")}</title>
      </circle>,
    );
  }

  const [mx, my] = at(0); // centerpiece anchor (bottom of loop)
  const pendantX = CX;

  const hmYs = [my + 28, my + 44, my + 60];
  const ofY = my + 80;
  const cruxTop = ofY + 16;

  // --- "Show the order" overlay: a numbered badge + leader on each bead
  // where the prayer changes. Loop beads point to a representative bead; the
  // pendant cluster (the tricky opening/closing prayers) offsets left/right so
  // the stacked captions don't collide. ---
  const [ofBX, ofBY] = at(34); // a representative decade Our Father bead
  const [hmBX, hmBY] = at(37); // a representative decade Hail Mary bead
  const [adBX, adBY] = at(11.5); // Glory Be / O My Jesus on the chain
  const anchor: Record<BeadType, { bx: number; by: number; place: "L" | "R" | "out" }> = {
    crucifix: { bx: CX, by: cruxTop + 12, place: "L" },
    pendantOF: { bx: CX, by: ofY, place: "R" },
    pendantHM: { bx: CX, by: hmYs[1], place: "L" },
    centerpiece: { bx: mx, by: my, place: "R" },
    decadeOF: { bx: ofBX, by: ofBY, place: "out" },
    decadeHM: { bx: hmBX, by: hmBY, place: "out" },
    afterDecade: { bx: adBX, by: adBY, place: "out" },
  };
  const badgeXY = (bx: number, by: number, place: "L" | "R" | "out"): [number, number] => {
    if (place === "L") return [bx - 24, by];
    if (place === "R") return [bx + 24, by];
    const dx = bx - CX, dy = by - CY, m = Math.hypot(dx, dy) || 1;
    return [bx + (dx / m) * 16, by + (dy / m) * 16];
  };
  const seqMap = sequenceByType(devotion);

  // --- Full-screen prayer-title callouts. One per step in the praying order:
  // the opening run fans out to the right of the pendant, the closing prayers to
  // the left of the centerpiece, and the repeating decade prayers point outward
  // from a representative loop bead. Driven by ROSARY_SEQUENCE so both devotions
  // work and the centerpiece's double duty (opening Glory Be + closing prayers)
  // reads as two callouts on opposite sides. ---
  const FS_RIGHT_X = 380;
  const FS_LEFT_X = -60;
  type FsCallout = {
    step: SeqStep;
    lx: number;
    ly: number;
    align: "start" | "end";
    bx: number;
    by: number;
  };
  // Each label sits at its bead's height, so the leader runs cleanly across
  // rather than crossing its neighbours. The beginning prayers and the two
  // decade bead-prayers extend to the right; the closing prayers and the
  // after-decade prayer (which lives on the left of the loop) extend left.
  const fsCallouts: FsCallout[] = ROSARY_SEQUENCE[devotion].map((step) => {
    const a = anchor[step.type];
    const right = step.phase !== "close" && step.type !== "afterDecade";
    return {
      step,
      lx: right ? FS_RIGHT_X : FS_LEFT_X,
      ly: a.by,
      align: right ? "start" : "end",
      bx: a.bx,
      by: a.by,
    };
  });

  // The beads, chain, pendant and crucifix — shared by the inline diagram and
  // the full-screen view (both wrap it in their own <svg> with a viewBox).
  const diagramCore = (
    <>
      <defs>
        <marker
          id="seqArrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M0,1 L9,5 L0,9 z" fill={GOLD} />
        </marker>
      </defs>
      {/* Pendant chain (the loop itself is shown by the beads). */}
      <line x1={pendantX} y1={my} x2={pendantX} y2={cruxTop} stroke={LINE} strokeWidth={1} />

      {conns}
      {loop}

      {/* Centerpiece — the Mary medallion. Renders the Our Lady of Guadalupe
          image if present at /public/mary-guadalupe.png; until then the light-
          blue oval with an "M" stands in. */}
      <g {...bead("centerpiece")}>
        <title>{titlesFor("centerpiece")}</title>
        <defs>
          <clipPath id={clipId}>
            <ellipse cx={mx} cy={my} rx={picked === "centerpiece" ? 16 : 15} ry={picked === "centerpiece" ? 20 : 19} />
          </clipPath>
        </defs>
        <ellipse
          cx={mx}
          cy={my}
          rx={picked === "centerpiece" ? 16 : 15}
          ry={picked === "centerpiece" ? 20 : 19}
          fill={BEAD_COLOR.centerpiece}
          stroke={picked === "centerpiece" ? "var(--ink)" : isHov("centerpiece") ? HOVER_RING : "#5a92c0"}
          strokeWidth={picked === "centerpiece" ? 2 : isHov("centerpiece") ? 2 : 1.4}
        />
        <image
          href="/mary-guadalupe.png"
          x={mx - 15}
          y={my - 19}
          width={30}
          height={38}
          clipPath={`url(#${clipId})`}
          preserveAspectRatio="xMidYMid slice"
          style={{ pointerEvents: "none" }}
        />
      </g>

      {/* Pendant: 3 Hail Mary beads, 1 Our Father bead */}
      {hmYs.map((y, i) => (
        <circle
          key={`phm${i}`}
          cx={pendantX}
          cy={y}
          r={4}
          fill={BEAD_COLOR.pendantHM}
          stroke={ringFor(false, picked === "pendantHM", isHov("pendantHM"))}
          strokeWidth={ringW(false, picked === "pendantHM", isHov("pendantHM"))}
          {...bead("pendantHM")}
        >
          <title>{titlesFor("pendantHM")}</title>
        </circle>
      ))}
      <circle
        cx={pendantX}
        cy={ofY}
        r={6.5}
        fill={BEAD_COLOR.pendantOF}
        stroke={ringFor(false, picked === "pendantOF", isHov("pendantOF"))}
        strokeWidth={ringW(false, picked === "pendantOF", isHov("pendantOF"))}
        {...bead("pendantOF")}
      >
        <title>{titlesFor("pendantOF")}</title>
      </circle>

      {/* Crucifix */}
      <g
        stroke={picked === "crucifix" ? "var(--ink)" : isHov("crucifix") ? HOVER_RING : BEAD_COLOR.crucifix}
        strokeWidth={picked === "crucifix" || isHov("crucifix") ? 3.2 : 2.4}
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
    </>
  );

  // Full-screen prayer-title callouts, drawn over diagramCore in the overlay.
  const fsCalloutEls = fsCallouts.map(({ step, lx, ly, align, bx, by }) => {
    const tx = align === "start" ? lx + 14 : lx - 14;
    return (
      <g key={`fs-${step.n}-${step.type}`} style={{ pointerEvents: "none" }}>
        <line x1={lx} y1={ly} x2={bx} y2={by} stroke={GOLD} strokeWidth={1} opacity={0.45} />
        <circle cx={lx} cy={ly} r={8.5} fill={GOLD} />
        <text
          x={lx}
          y={ly}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={9.5}
          fontWeight={700}
          fill="var(--gold-text)"
        >
          {step.n}
        </text>
        <text
          x={tx}
          y={ly}
          textAnchor={align}
          dominantBaseline="central"
          fontSize={11}
          fontWeight={600}
          fill={INK}
        >
          {step.short}
        </text>
      </g>
    );
  });

  // Mystery callouts — the five decade "Our Father" beads each announce one
  // mystery; label each with a leader line out to the rope and prefix it with
  // the mystery type. Only for the Rosary (chaplet has no mysteries).
  const mysteryPrefix = today ? today.title.replace(/^The\s+/, "").replace(/\s+Mysteries$/, "") : "";
  const mysteryCallouts =
    today && devotion === "rosary"
      ? today.mysteries.map((name, i) => {
          const [bx, by] = at(1 + i * 11);
          // The first mystery's bead sits just left of bottom-centre, but its
          // label reads better on the right, clear of the pendant.
          const left = i === 0 ? false : bx < CX;
          return { name, i, bx, by, left, lx: left ? -36 : 356, ly: by };
        })
      : [];
  const showMyst = mysteryCallouts.length > 0;

  return (
    <figure className="mb-1 mt-[50px] flex w-full flex-col items-center">
      <div className="flex w-full items-center justify-center">
        <svg
          viewBox={showSeq ? "-16 0 356 452" : showMyst ? "-198 -6 716 470" : "0 -4 320 452"}
          className="min-w-0 w-full max-w-full"
          role="img"
          aria-label="Rosary diagram — hover or tap a bead to see its prayer"
        >
        {diagramCore}

        {/* Hover readout — every prayer said on the bead (a bead can carry
            more than one, e.g. Glory Be + O My Jesus), each with its full text
            and a Practice button, centred inside the loop. */}
        {hovered && !showSeq && (
          <foreignObject x={CX - 102} y={CY - 92} width={204} height={184}>
            <div
              // xmlns keeps the foreignObject HTML namespaced correctly; React's
              // div typings don't know the attribute, so it's spread in.
              {...{ xmlns: "http://www.w3.org/1999/xhtml" }}
              style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <div style={{ maxHeight: "100%", width: "100%", overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "2px 1px" }}>
                {(() => {
                  // One prayer at a time; multi-prayer beads (Glory Be +
                  // O My Jesus…) page through with a prev/next system.
                  const prayers = beadPrayers(devotion, hovered);
                  const idx = Math.min(prayerIdx, prayers.length - 1);
                  const p = prayers[idx];
                  const lines = textFor?.(p.slug) ?? null;
                  const next = prayers.length > 1 ? prayers[(idx + 1) % prayers.length] : null;
                  const prev = prayers.length > 1 ? prayers[(idx - 1 + prayers.length) % prayers.length] : null;
                  const navBtn: React.CSSProperties = { fontFamily: "var(--font-sans), system-ui, sans-serif", fontSize: 7.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-soft)", background: "var(--chip-bg)", border: "1px solid var(--chip-bd)", borderRadius: 999, padding: "2px 8px", cursor: "pointer" };
                  return (
                    <div style={{ width: "100%", textAlign: "center" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                        <span style={{ fontFamily: "var(--font-sans), system-ui, sans-serif", fontSize: 7.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--gold)" }}>
                          {p.title}
                          {prayers.length > 1 ? ` · ${idx + 1}/${prayers.length}` : ""}
                        </span>
                      </div>
                      {lines && lines.length > 0 && (
                        <div style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: 9, lineHeight: 1.25, color: "var(--ink)" }}>
                          {lines.map((ln, j) => (
                            <div key={j}>{ln}</div>
                          ))}
                        </div>
                      )}
                      {onPractice && (
                        <button
                          onClick={() => onPractice(p.slug)}
                          style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6, fontFamily: "var(--font-sans), system-ui, sans-serif", fontSize: 8, fontWeight: 600, color: "var(--gold)", background: "var(--chip-bg)", border: "1px solid var(--chip-bd)", borderRadius: 999, padding: "3px 10px", cursor: "pointer" }}
                        >
                          {/* mini target glyph — matches the reading dock's Practice chip */}
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth={2} aria-hidden>
                            <circle cx={12} cy={12} r={8.5} />
                            <circle cx={12} cy={12} r={4} />
                            <circle cx={12} cy={12} r={0.7} fill="var(--gold)" />
                          </svg>
                          Practice
                        </button>
                      )}
                      {next && prev && (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 6 }}>
                          <button
                            onClick={() => setPrayerIdx((idx - 1 + prayers.length) % prayers.length)}
                            aria-label={`Previous prayer: ${prev.title}`}
                            title={`Prev: ${prev.title}`}
                            style={navBtn}
                          >
                            ‹
                          </button>
                          <button
                            onClick={() => setPrayerIdx((idx + 1) % prayers.length)}
                            aria-label={`Next prayer: ${next.title}`}
                            style={navBtn}
                          >
                            Next: {next.title} ›
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </foreignObject>
        )}

        {/* Mystery callouts on the five decade beads (today's set). */}
        {showMyst &&
          mysteryCallouts.map(({ name, i, bx, by, left, lx, ly }) => {
            const tx = left ? lx - 11 : lx + 11;
            return (
              <g key={`myst-${i}`} style={{ pointerEvents: "none" }}>
                <line x1={lx} y1={ly} x2={bx} y2={by} stroke={GOLD} strokeWidth={1} opacity={0.5} />
                <circle cx={lx} cy={ly} r={7.5} fill={GOLD} />
                <text x={lx} y={ly} textAnchor="middle" dominantBaseline="central" fontSize={8.5} fontWeight={700} fill="var(--gold-text)">
                  {i + 1}
                </text>
                <text x={tx} y={ly} textAnchor={left ? "end" : "start"} fontSize={9} fill={INK}>
                  <tspan x={tx} dy="-0.5em" fontSize={7} fontWeight={700} fill={GOLD} letterSpacing="0.4" style={{ textTransform: "uppercase" }}>
                    {mysteryPrefix}
                  </tspan>
                  <tspan x={tx} dy="1.25em">{name}</tspan>
                </text>
              </g>
            );
          })}

        {/* Numbered sequence callouts (toggled by "Show the order") */}
        {showSeq &&
          [...seqMap.entries()].map(([type, steps]) => {
            const a = anchor[type];
            const [px, py] = badgeXY(a.bx, a.by, a.place);
            const label = steps.map((s) => s.n).join("·");
            const wide = label.length > 1;
            const dx = a.bx - px, dy = a.by - py, len = Math.hypot(dx, dy) || 1;
            const [ex, ey] = [a.bx - (dx / len) * 5, a.by - (dy / len) * 5];
            return (
              <g key={`seq-${type}`} style={{ pointerEvents: "none" }}>
                <line x1={px} y1={py} x2={ex} y2={ey} stroke={GOLD} strokeWidth={1.2} markerEnd="url(#seqArrow)" />
                {wide ? (
                  <rect x={px - 11} y={py - 8} width={22} height={16} rx={8} fill={GOLD} />
                ) : (
                  <circle cx={px} cy={py} r={8.5} fill={GOLD} />
                )}
                <text
                  x={px}
                  y={py}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={9.5}
                  fontWeight={700}
                  fill="var(--gold-text)"
                >
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {showSeq && (
        <ol className="mt-3 w-full max-w-[320px] space-y-3 text-left">
          {(["open", "decade", "close"] as SeqPhase[]).map((phase) => {
            const rows = ROSARY_SEQUENCE[devotion].filter((s) => s.phase === phase);
            if (!rows.length) return null;
            const heading =
              phase === "open"
                ? "Begin"
                : phase === "decade"
                  ? "Each decade — repeat five times"
                  : "To close";
            return (
              <li key={phase}>
                <p className="mb-1.5 font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-gold">
                  {heading}
                </p>
                <ul className="space-y-1.5">
                  {rows.map((s) => (
                    <li key={s.n} className="flex items-start gap-2">
                      <span
                        className="mt-px inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 font-sans text-[10px] font-bold"
                        style={{ background: "var(--gold)", color: "var(--gold-text)" }}
                      >
                        {s.n}
                      </span>
                      <span className="font-sans text-[12.5px] leading-snug text-ink-soft">
                        <span className="font-medium text-ink">{s.short}</span> — {s.full}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      )}

      {/* Full-screen labelled view — portalled to <body> so it escapes the
          sticky sidebar's stacking context and covers the site header too. */}
      {fs &&
        mounted &&
        createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${DEVOTION_LABEL[devotion]} — full-screen diagram`}
          className="fixed inset-0 z-[60] flex flex-col"
          style={{ background: "var(--parchment)" }}
        >
          <div className="flex items-center justify-between border-b border-hairline px-5 py-3">
            <div>
              <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">
                {DEVOTION_LABEL[devotion]}
              </p>
              <p className="font-serif text-lg text-ink">Where each prayer falls</p>
            </div>
            <button
              type="button"
              onClick={() => setFs(false)}
              aria-label="Close full screen"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-hairline text-ink-soft transition-colors hover:border-gold/60 hover:text-gold"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center overflow-auto px-4 py-2">
            <svg
              viewBox="-210 -10 760 470"
              className="h-full max-h-[80vh] w-full max-w-5xl"
              role="img"
              aria-label="Rosary diagram with each prayer labelled in praying order"
            >
              {diagramCore}
              {fsCalloutEls}
            </svg>
          </div>
          <p className="pb-4 pt-1 text-center font-sans text-xs text-ink-faint">
            Numbered in praying order · tap a bead to open its prayer · Esc to close
          </p>
        </div>,
          document.body,
        )}
    </figure>
  );
}
