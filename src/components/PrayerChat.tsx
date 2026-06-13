"use client";

import { useState } from "react";
import { ConnectiveText } from "@/components/ConnectiveText";
import type { PassageView, SegmentRole } from "@/lib/content";

type Perspective = "CALLER" | "RESPONDER" | "BOTH";

interface Props {
  passage: PassageView;
}

/**
 * Renders a passage as an iMessage-style conversation (spec section 2).
 * Caller (V.) = blue, Responder (R.) = green, single-voice = neutral. The
 * reader can adopt a role; their own lines align right as "outgoing" bubbles.
 */
export function PrayerChat({ passage }: Props) {
  const [perspective, setPerspective] = useState<Perspective>("BOTH");
  const [highlight, setHighlight] = useState(true);

  // Determine if a given role's line is the reader's own (outgoing/right).
  function isOutgoing(role: SegmentRole): boolean {
    if (perspective === "BOTH") return role === "RESPONDER";
    return role === perspective;
  }

  return (
    <div>
      {/* Controls */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {passage.dialogic && (
          <div
            className="inline-flex rounded-full border border-hairline bg-parchment-raised p-1"
            role="group"
            aria-label="Choose your role"
          >
            {(["CALLER", "RESPONDER", "BOTH"] as Perspective[]).map((r) => (
              <button
                key={r}
                onClick={() => setPerspective(r)}
                className={`rounded-full px-3 py-1 font-sans text-sm transition-colors ${
                  perspective === r
                    ? "bg-ink text-parchment-raised"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                {r === "CALLER"
                  ? "Caller (V.)"
                  : r === "RESPONDER"
                    ? "Responder (R.)"
                    : "Both"}
              </button>
            ))}
          </div>
        )}

        {passage.dialogic && perspective !== "BOTH" && (
          <button
            onClick={() =>
              setPerspective(perspective === "CALLER" ? "RESPONDER" : "CALLER")
            }
            className="rounded-full border border-hairline px-3 py-1 font-sans text-sm text-ink-soft transition-colors hover:border-gold/40 hover:text-gold"
          >
            ⇄ Flip sides
          </button>
        )}

        <button
          onClick={() => setHighlight((h) => !h)}
          aria-pressed={highlight}
          className={`rounded-full border px-3 py-1 font-sans text-sm transition-colors ${
            highlight
              ? "border-gold/40 text-gold"
              : "border-hairline text-ink-soft hover:text-ink"
          }`}
        >
          {highlight ? "Anchors on" : "Anchors off"}
        </button>
      </div>

      {/* Conversation */}
      <ol className="space-y-2.5">
        {passage.segments.map((seg, i) => {
          const outgoing = isOutgoing(seg.role);
          return (
            <li
              key={seg.id}
              className={`flex ${outgoing ? "justify-end" : "justify-start"}`}
              style={{
                animation: "rise 0.4s ease-out both",
                animationDelay: `${Math.min(i * 40, 600)}ms`,
              }}
            >
              <Bubble role={seg.role} outgoing={outgoing}>
                <ConnectiveText
                  text={seg.text}
                  connectiveIndices={seg.connectiveIndices}
                  highlight={highlight}
                />
              </Bubble>
            </li>
          );
        })}
      </ol>

      <style>{`
        @keyframes rise {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          li { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

function Bubble({
  role,
  outgoing,
  children,
}: {
  role: SegmentRole;
  outgoing: boolean;
  children: React.ReactNode;
}) {
  const isCaller = role === "CALLER";
  const isResponder = role === "RESPONDER";

  let bg = "var(--unison)";
  let color = "var(--unison-ink)";
  let border = "1px solid var(--hairline)";
  if (isCaller) {
    bg = "var(--caller)";
    color = "var(--caller-ink)";
    border = "none";
  } else if (isResponder) {
    bg = "var(--responder)";
    color = "var(--responder-ink)";
    border = "none";
  }

  return (
    <div
      className="max-w-[80%] px-4 py-2.5 font-serif text-lg leading-snug shadow-[var(--bubble-shadow)]"
      style={{
        background: bg,
        color,
        border,
        borderRadius: outgoing
          ? "18px 18px 4px 18px"
          : "18px 18px 18px 4px",
      }}
    >
      {children}
    </div>
  );
}
