"use client";

import { useState } from "react";
import { ConnectiveText } from "@/components/ConnectiveText";
import { useSpeech } from "@/lib/useSpeech";
import type { PassageView, SegmentRole } from "@/lib/content";

type Perspective = "CALLER" | "RESPONDER" | "BOTH";

interface Props {
  passage: PassageView;
}

/**
 * Renders a passage as an iMessage-style conversation (spec section 2).
 * Caller (V.) = blue, Responder (R.) = green, single-voice = neutral. The
 * reader can adopt a role; their own lines align right as "outgoing" bubbles.
 * Every line can be heard, plus the whole prayer read aloud in sequence.
 */
export function PrayerChat({ passage }: Props) {
  const [perspective, setPerspective] = useState<Perspective>("BOTH");
  const [highlight, setHighlight] = useState(true);
  const { supported, activeKey, playingAll, speak, speakAll, stop } =
    useSpeech();

  function isOutgoing(role: SegmentRole): boolean {
    if (perspective === "BOTH") return role === "RESPONDER";
    return role === perspective;
  }

  const speechItems = passage.segments.map((s) => ({
    key: s.id,
    text: s.text,
    lang: passage.language,
  }));

  return (
    <div>
      {/* Controls */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {supported && (
          <button
            onClick={() => (playingAll ? stop() : speakAll(speechItems))}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-sans text-sm font-medium transition-colors ${
              playingAll
                ? "bg-gold text-parchment-raised"
                : "bg-ink text-parchment-raised hover:opacity-90"
            }`}
          >
            {playingAll ? (
              <>
                <StopIcon /> Stop
              </>
            ) : (
              <>
                <PlayIcon /> Hear the prayer
              </>
            )}
          </button>
        )}

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
          const active = activeKey === seg.id;
          return (
            <li
              key={seg.id}
              className={`flex items-center gap-2 ${
                outgoing ? "flex-row-reverse" : "flex-row"
              }`}
              style={{
                animation: "rise 0.4s ease-out both",
                animationDelay: `${Math.min(i * 40, 600)}ms`,
              }}
            >
              <Bubble role={seg.role} outgoing={outgoing} active={active}>
                <ConnectiveText
                  text={seg.text}
                  connectiveIndices={seg.connectiveIndices}
                  highlight={highlight}
                />
              </Bubble>
              {supported && (
                <PlayButton
                  active={active}
                  onClick={() =>
                    active
                      ? stop()
                      : speak({
                          key: seg.id,
                          text: seg.text,
                          lang: passage.language,
                        })
                  }
                />
              )}
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
  active,
  children,
}: {
  role: SegmentRole;
  outgoing: boolean;
  active: boolean;
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
      className="max-w-[80%] px-4 py-2.5 font-serif text-lg leading-snug shadow-[var(--bubble-shadow)] transition-shadow"
      style={{
        background: bg,
        color,
        border,
        borderRadius: outgoing ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
        outline: active ? "2px solid var(--gold)" : "none",
        outlineOffset: active ? "2px" : "0",
      }}
    >
      {children}
    </div>
  );
}

function PlayButton({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={active ? "Stop" : "Play line"}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors ${
        active
          ? "border-gold bg-gold text-parchment-raised"
          : "border-hairline text-ink-faint hover:border-gold/50 hover:text-gold"
      }`}
    >
      {active ? <StopIcon /> : <PlayIcon />}
    </button>
  );
}

function PlayIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
      <path d="M2.5 1.6v8.8c0 .5.5.8 1 .6l7-4.4c.4-.3.4-.9 0-1.2l-7-4.4c-.5-.3-1 0-1 .6z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
      <rect x="2.5" y="2.5" width="7" height="7" rx="1.2" />
    </svg>
  );
}
