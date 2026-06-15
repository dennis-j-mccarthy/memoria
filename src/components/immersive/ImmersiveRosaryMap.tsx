"use client";

import { useState } from "react";
import { RosaryDiagram } from "@/components/RosaryDiagram";
import {
  beadPrayers,
  devotionForSlug,
  ROSARY_BEADS,
  type BeadType,
} from "@/lib/rosary";

/**
 * The "Where in the Rosary" / "On the chaplet beads" map, inside the immersive
 * Player. Reuses the shared diagram + bead data, but taps navigate within the
 * immersive app (onPrayer) and multi-prayer beads show a glass pill chooser.
 */
export function ImmersiveRosaryMap({
  slug,
  onPrayer,
}: {
  slug: string;
  onPrayer: (slug: string) => void;
}) {
  const devotion = devotionForSlug(slug);
  const [picked, setPicked] = useState<BeadType | null>(null);
  if (!devotion) return null;

  const note = ROSARY_BEADS[slug];
  const title = devotion === "chaplet" ? "On the chaplet beads" : "Where in the Rosary";

  function handlePick(type: BeadType) {
    const prayers = beadPrayers(devotion!, type);
    if (prayers.length === 1) onPrayer(prayers[0].slug);
    else setPicked(type);
  }

  return (
    <div
      style={{
        marginTop: 24,
        borderRadius: 22,
        padding: "14px 16px 16px",
        background: "var(--glass)",
        border: "1px solid var(--glass-border)",
      }}
    >
      <div
        style={{
          letterSpacing: ".16em",
          textTransform: "uppercase",
          fontSize: 10.5,
          fontWeight: 700,
          color: "var(--gold)",
          textAlign: "center",
        }}
      >
        {title}
      </div>
      <RosaryDiagram
        slug={slug}
        devotion={devotion}
        picked={picked}
        onPick={handlePick}
      />
      {note && (
        <p style={{ fontSize: 12.5, color: "var(--ink-soft)", textAlign: "center", marginTop: 6, lineHeight: 1.5 }}>
          {note}
        </p>
      )}
      {picked && (
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 12 }}>
          {beadPrayers(devotion, picked).map((pr) => {
            const current = pr.slug === slug;
            return (
              <button
                key={pr.slug}
                onClick={() => onPrayer(pr.slug)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  borderRadius: 999,
                  padding: "7px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "var(--font-serif), Georgia, serif",
                  background: current ? "var(--gold)" : "var(--chip-bg)",
                  color: current ? "var(--gold-text)" : "var(--ink)",
                  border: "1px solid " + (current ? "var(--gold)" : "var(--chip-bd)"),
                }}
              >
                {pr.title}
                {!current && <span aria-hidden>→</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
