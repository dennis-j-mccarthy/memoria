"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ConnectiveText } from "@/components/ConnectiveText";
import { PrayerRecite } from "@/components/PrayerRecite";
import { useSpeech } from "@/lib/useSpeech";
import { useAuth } from "@/lib/useAuth";
import {
  audioSrc,
  voiceForSegment,
  VOICES,
  DEFAULT_VOICE,
  type VoiceId,
} from "@/lib/voice";
import type { PassageView, SegmentRole, SegmentView } from "@/lib/content";

type Perspective = "CALLER" | "RESPONDER" | "BOTH";
type Mode = "READ" | "RECITE" | "ICONS";
type AnchorMode = "hide" | "show" | "edit";
type SaveStatus = "idle" | "saving" | "saved" | "error";

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
  const [mode, setMode] = useState<Mode>("READ");
  const [perspective, setPerspective] = useState<Perspective>("BOTH");
  const [highlight, setHighlight] = useState(true);
  const [editAnchors, setEditAnchors] = useState(false);

  // Per-segment role overrides (Leader/Response), seeded from the passage.
  // In-session; lets you correct which lines are call vs. response.
  const [editRoles, setEditRoles] = useState(false);
  const [roles, setRoles] = useState<Record<string, SegmentRole>>(() =>
    Object.fromEntries(passage.segments.map((s) => [s.id, s.role])),
  );
  const roleOf = (seg: SegmentView): SegmentRole => roles[seg.id] ?? seg.role;
  const { supported, activeKey, playingAll, speak, speakAll, stop } =
    useSpeech();

  // Narration voice, persisted across prayers. The chosen voice "leads";
  // in call-and-response prayers the Responder lines use the other voice.
  const [voice, setVoice] = useState<VoiceId>(DEFAULT_VOICE);
  useEffect(() => {
    const v = localStorage.getItem("memoria-voice");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time pref load
    if (v === "onyx" || v === "shimmer") setVoice(v);
  }, []);
  const changeVoice = useCallback((v: VoiceId) => {
    stop();
    setVoice(v);
    try {
      localStorage.setItem("memoria-voice", v);
    } catch {}
  }, [stop]);
  const srcFor = useCallback(
    (seg: SegmentView, role: SegmentRole) =>
      audioSrc(
        passage.slug,
        seg.order,
        voiceForSegment(voice, passage.dialogic, role),
      ),
    [passage.slug, passage.dialogic, voice],
  );

  // Which words are anchors, per segment — seeded from the curated connective
  // words but editable, and shared between Read and Recite so a change in one
  // shows up in the other. Lives here, the common parent of both views.
  const [anchors, setAnchors] = useState<Record<string, Set<number>>>(() =>
    Object.fromEntries(
      passage.segments.map((s) => [s.id, new Set(s.connectiveIndices)]),
    ),
  );

  const { user } = useAuth();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // Mirror anchors + roles into refs so the debounced save reads the latest.
  const anchorsRef = useRef(anchors);
  useEffect(() => {
    anchorsRef.current = anchors;
  }, [anchors]);
  const rolesRef = useRef(roles);
  useEffect(() => {
    rolesRef.current = roles;
  }, [roles]);

  // Debounced save of the canonical prayer content (anchors + roles). Edits are
  // the default for everyone; the API gates this to signed-in users and
  // revalidates the page. Signed-out edits stay in-session (nudge shown).
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveContent = useCallback(() => {
    if (!user) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus("saving");
    saveTimer.current = setTimeout(async () => {
      try {
        const anchorsPayload = Object.fromEntries(
          passage.segments.map((s) => [
            s.id,
            [...(anchorsRef.current[s.id] ?? [])],
          ]),
        );
        const rolesPayload = Object.fromEntries(
          passage.segments.map((s) => [s.id, rolesRef.current[s.id] ?? s.role]),
        );
        const res = await fetch(`/api/passages/${passage.slug}/content`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ anchors: anchorsPayload, roles: rolesPayload }),
        });
        setSaveStatus(res.ok ? "saved" : "error");
      } catch {
        setSaveStatus("error");
      }
    }, 600);
  }, [user, passage.slug, passage.segments]);

  const toggleAnchor = useCallback(
    (segId: string, wordIndex: number) => {
      setAnchors((prev) => {
        const set = new Set(prev[segId]);
        if (set.has(wordIndex)) set.delete(wordIndex);
        else set.add(wordIndex);
        return { ...prev, [segId]: set };
      });
      saveContent();
    },
    [saveContent],
  );

  const cycleRole = useCallback(
    (segId: string) => {
      setRoles((prev) => ({
        ...prev,
        [segId]: prev[segId] === "CALLER" ? "RESPONDER" : "CALLER",
      }));
      saveContent();
    },
    [saveContent],
  );

  const resetAnchors = useCallback(() => {
    setAnchors(
      Object.fromEntries(
        passage.segments.map((s) => [s.id, new Set(s.connectiveIndices)]),
      ),
    );
    saveContent();
  }, [passage.segments, saveContent]);

  const anchorsEdited = passage.segments.some((s) => {
    const cur = anchors[s.id];
    if (!cur) return false;
    const orig = s.connectiveIndices;
    return cur.size !== orig.length || orig.some((i) => !cur.has(i));
  });

  // Collapse the two anchor toggles (show + edit) into one 3-way control.
  const anchorMode: AnchorMode = !highlight
    ? "hide"
    : editAnchors
      ? "edit"
      : "show";
  function setAnchorMode(m: AnchorMode) {
    setHighlight(m !== "hide");
    setEditAnchors(m === "edit");
  }

  function isOutgoing(role: SegmentRole): boolean {
    if (perspective === "BOTH") return role === "RESPONDER";
    return role === perspective;
  }

  const speechItems = passage.segments.map((s) => ({
    key: s.id,
    text: s.text,
    lang: passage.language,
    src: srcFor(s, roleOf(s)),
  }));

  return (
    <div>
      {/* Mode + voice */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div
          className="inline-flex rounded-full border border-hairline bg-parchment-raised p-1"
          role="group"
          aria-label="Mode"
        >
          {(["READ", "RECITE", "ICONS"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`rounded-full px-3.5 py-1 font-sans text-sm transition-colors ${
                mode === m
                  ? "bg-ink text-parchment-raised"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              {m === "READ"
                ? "Read / Listen"
                : m === "RECITE"
                  ? "Practice"
                  : "Icons"}
            </button>
          ))}
        </div>

        <div
          className="inline-flex items-center gap-1 rounded-full border border-hairline bg-parchment-raised py-1 pl-2.5 pr-1 text-ink-faint"
          role="group"
          aria-label="Narration voice"
        >
          <SpeakerIcon />
          {VOICES.map((v) => (
            <button
              key={v.id}
              onClick={() => changeVoice(v.id)}
              aria-pressed={voice === v.id}
              aria-label={`${v.label} voice`}
              title={`${v.label} voice`}
              className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                voice === v.id
                  ? "bg-ink text-parchment-raised"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              <VoiceIcon id={v.id} />
            </button>
          ))}
        </div>
      </div>

      {mode === "RECITE" || mode === "ICONS" ? (
        <PrayerRecite
          passage={passage}
          anchors={anchors}
          onToggleAnchor={toggleAnchor}
          voice={voice}
          hintStyle={mode === "ICONS" ? "icons" : "anchors"}
        />
      ) : (
        <>
      {/* Primary action: a large play button to hear the whole prayer */}
      {supported && (
        <button
          onClick={() => (playingAll ? stop() : speakAll(speechItems))}
          aria-label={playingAll ? "Stop" : "Hear the whole prayer"}
          title={playingAll ? "Stop" : "Hear the whole prayer"}
          className={`mb-6 flex h-14 w-14 items-center justify-center rounded-full shadow-[var(--bubble-shadow)] transition-colors ${
            playingAll
              ? "bg-gold text-parchment-raised"
              : "bg-ink text-parchment-raised hover:opacity-90"
          }`}
        >
          {playingAll ? (
            <svg width="20" height="20" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
              <rect x="2.5" y="2.5" width="7" height="7" rx="1.4" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
              <path d="M3 1.8v8.4c0 .5.5.8 1 .55l6.6-4.2c.4-.26.4-.84 0-1.1L4 1.25c-.5-.3-1 0-1 .55z" />
            </svg>
          )}
        </button>
      )}

      {/* Voices — only for call-and-response prayers */}
      {passage.dialogic && (
        <div className="mb-6">
          <Labeled label="Voices">
            {(["CALLER", "RESPONDER", "BOTH"] as Perspective[]).map((r) => (
              <Segment
                key={r}
                active={perspective === r}
                onClick={() => setPerspective(r)}
              >
                {r === "CALLER"
                  ? "Leader"
                  : r === "RESPONDER"
                    ? "Response"
                    : "Both"}
              </Segment>
            ))}
          </Labeled>
        </div>
      )}

      {/* Conversation */}
      <ol className="space-y-2.5">
        {passage.segments.map((seg, i) => {
          const role = roleOf(seg);
          const outgoing = isOutgoing(role);
          const active = activeKey === seg.id;
          return (
            <li
              key={seg.id}
              className={`flex ${outgoing ? "justify-end" : "justify-start"}`}
              style={{
                animation: "rise 0.4s ease-out both",
                animationDelay: `${Math.min(i * 40, 600)}ms`,
              }}
            >
              <Bubble role={role} outgoing={outgoing} active={active}>
                <span className="flex items-center gap-2.5">
                  {/* When editing roles, a tappable badge flips Leader/Response */}
                  {editRoles ? (
                    <RoleBadge role={role} onClick={() => cycleRole(seg.id)} />
                  ) : (
                    supported && (
                      <PlayButton
                        active={active}
                        onClick={() =>
                          active
                            ? stop()
                            : speak({
                                key: seg.id,
                                text: seg.text,
                                lang: passage.language,
                                src: srcFor(seg, role),
                              })
                        }
                      />
                    )
                  )}
                  <ConnectiveText
                    text={seg.text}
                    anchorIndices={[
                      ...(anchors[seg.id] ?? seg.connectiveIndices),
                    ]}
                    highlight={highlight}
                    onToggleWord={
                      editAnchors
                        ? (idx) => toggleAnchor(seg.id, idx)
                        : undefined
                    }
                  />
                </span>
              </Bubble>
            </li>
          );
        })}
      </ol>

      {/* Anchors + roles — quiet footer controls under the prayer */}
      <div className="mt-8 border-t border-hairline pt-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {passage.dialogic && (
            <Labeled label="Roles">
              <Segment active={!editRoles} onClick={() => setEditRoles(false)}>
                View
              </Segment>
              <Segment active={editRoles} onClick={() => setEditRoles(true)}>
                <span className="inline-flex items-center gap-1.5">
                  <PencilIcon /> Edit
                </span>
              </Segment>
            </Labeled>
          )}

          <div className="flex items-center gap-2">
            <Labeled label="Anchors">
              {(
                [
                  ["hide", "Hide", <EyeOffIcon key="i" />],
                  ["show", "Show", <EyeIcon key="i" />],
                  ["edit", "Edit", <PencilIcon key="i" />],
                ] as [AnchorMode, string, React.ReactNode][]
              ).map(([am, label, icon]) => (
                <Segment
                  key={am}
                  active={anchorMode === am}
                  onClick={() => setAnchorMode(am)}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {icon}
                    {label}
                  </span>
                </Segment>
              ))}
            </Labeled>
            {anchorMode === "edit" && anchorsEdited && (
              <button
                onClick={resetAnchors}
                className="font-sans text-sm text-ink-faint underline-offset-2 transition-colors hover:text-gold hover:underline"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {anchorMode === "edit" && (
          <p className="mt-3 font-sans text-xs text-ink-faint">
            Tap a word above to add or remove its gold anchor. Edits become the
            prayer’s default for everyone.{" "}
            <SaveNote user={!!user} status={saveStatus} slug={passage.slug} />
          </p>
        )}

        {editRoles && (
          <p className="mt-3 font-sans text-xs text-ink-faint">
            Tap a line’s <span className="text-ink-soft">V·/R·</span> badge to
            switch it between Leader and Response — bubble colour and voice
            follow. Edits become the prayer’s default for everyone.{" "}
            <SaveNote user={!!user} status={saveStatus} slug={passage.slug} />
          </p>
        )}
      </div>

      <style>{`
        @keyframes rise {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          li { animation: none !important; }
        }
      `}</style>
        </>
      )}
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
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-opacity ${
        active ? "opacity-100" : "opacity-55 hover:opacity-100"
      }`}
    >
      {active ? (
        <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
          <rect x="2.5" y="2.5" width="7" height="7" rx="1.2" />
        </svg>
      ) : (
        <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
          <path d="M3 1.8v8.4c0 .5.5.8 1 .55l6.6-4.2c.4-.26.4-.84 0-1.1L4 1.25c-.5-.3-1 0-1 .55z" />
        </svg>
      )}
    </button>
  );
}

function SaveNote({
  user,
  status,
  slug,
}: {
  user: boolean;
  status: SaveStatus;
  slug: string;
}) {
  if (!user) {
    return (
      <Link
        href={`/signin?redirect=/prayers/${slug}`}
        className="text-gold underline-offset-2 hover:underline"
      >
        Sign in to save your edits.
      </Link>
    );
  }
  return (
    <span className="text-ink-soft">
      {status === "saving"
        ? "· Saving…"
        : status === "saved"
          ? "· Saved"
          : status === "error"
            ? "· Couldn’t save — check your connection"
            : ""}
    </span>
  );
}

function RoleBadge({
  role,
  onClick,
}: {
  role: SegmentRole;
  onClick: () => void;
}) {
  const isCaller = role === "CALLER";
  return (
    <button
      onClick={onClick}
      aria-label={`This line is ${isCaller ? "the Leader" : "the Response"} — tap to switch`}
      title="Switch Leader / Response"
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/25 font-sans text-xs font-semibold ring-1 ring-white/40 transition-transform hover:scale-110"
    >
      {isCaller ? "V" : "R"}
    </button>
  );
}

function VoiceIcon({ id }: { id: VoiceId }) {
  // Onyx = male (Mars ♂), Shimmer = female (Venus ♀).
  return id === "onyx" ? (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="6.3" cy="9.7" r="3.4" />
      <path d="M9.2 6.8 13.5 2.5M10.3 2.5h3.2v3.2" />
    </svg>
  ) : (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="8" cy="6" r="3.4" />
      <path d="M8 9.4v5M5.6 12h4.8" />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
      <path
        d="M8 2.8 4.6 5.5H2.2v5h2.4L8 13.2z"
        fill="currentColor"
      />
      <path
        d="M10.6 5.6a3.2 3.2 0 0 1 0 4.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M1.5 8S3.8 3.5 8 3.5 14.5 8 14.5 8 12.2 12.5 8 12.5 1.5 8 1.5 8Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="1.8" fill="currentColor" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3 4.2C1.9 5.2 1.5 8 1.5 8s2.3 4.5 6.5 4.5c1 0 1.9-.2 2.7-.6M6.4 4c.5-.1 1-.2 1.6-.2 4.2 0 6.5 4.5 6.5 4.5s-.6 1.2-1.7 2.3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.6 6.6a2 2 0 0 0 2.8 2.8"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path d="M2 2l12 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M11 2.5l2.5 2.5M3 13l-.5 1.5L4 14l8-8-2-2-7 7z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A small labelled segmented-control group used in the reading options. */
function Labeled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-sans text-xs uppercase tracking-[0.15em] text-ink-faint">
        {label}
      </span>
      <div
        className="inline-flex rounded-full border border-hairline bg-parchment-raised p-1"
        role="group"
        aria-label={label}
      >
        {children}
      </div>
    </div>
  );
}

function Segment({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1 font-sans text-sm transition-colors ${
        active
          ? "bg-ink text-parchment-raised"
          : "text-ink-soft hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
