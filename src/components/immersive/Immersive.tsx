"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon, PlayGlyph, PauseGlyph } from "@/components/immersive/Icon";
import { ImmersiveRosaryMap } from "@/components/immersive/ImmersiveRosaryMap";
import { ImmersiveRecite } from "@/components/immersive/ImmersiveRecite";
import { audioSrc, VOICES, type VoiceId } from "@/lib/voice";
import { COLLECTIONS } from "@/lib/rosary";
import type { ImmersivePrayer, ImmersiveLine } from "@/lib/immersive";

type Route = "home" | "library" | "player" | "practice" | "profile" | "devotion";

const SERIF = "var(--font-serif), Georgia, serif";
// Bead diagram in the player is hidden for now — flip to re-enable it.
const SHOW_DIAGRAM = false;
const norm = (w: string) => w.toLowerCase().replace(/[^a-z']/g, "");
const fmt = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;

// Group the catalog into its content sets (The Rosary, Prayers & Devotions,
// and later Scripture, Poems…) for the home library, preserving catalog order.
function libraryGroups(prayers: ImmersivePrayer[]): { section: string; items: ImmersivePrayer[] }[] {
  const groups: { section: string; items: ImmersivePrayer[] }[] = [];
  for (const p of prayers) {
    const key = p.section || "Prayers";
    const g = groups.find((x) => x.section === key);
    if (g) g.items.push(p);
    else groups.push({ section: key, items: [p] });
  }
  return groups;
}

/** A prayer line in edit mode: tap words to toggle anchors, tap badge to flip role. */
function EditableLine({
  ln,
  showRole,
  onWord,
  onSetRole,
}: {
  ln: ImmersiveLine;
  isR: boolean;
  showRole: boolean;
  onWord: (wi: number) => void;
  onSetRole: (role: "L" | "R") => void;
}) {
  const ws = ln.text.split(/\s+/).filter(Boolean);
  // A line can only move the one way it isn't: a left "call" moves right to
  // become a response; a right "response" moves left to become a call. So we
  // show a single arrow on the side it can travel toward.
  const moveArrow = (to: "L" | "R", glyph: string, label: string, side: "left" | "right") => (
    <button
      onClick={() => onSetRole(to)}
      aria-label={label}
      title={label}
      style={{
        font: "inherit",
        fontSize: 12,
        lineHeight: 1,
        padding: "3px 6px",
        borderRadius: 8,
        background: "rgba(127,127,127,.16)",
        border: "none",
        color: "var(--ink-soft)",
        cursor: "pointer",
        verticalAlign: "middle",
        marginRight: side === "left" ? 8 : 0,
        marginLeft: side === "right" ? 8 : 0,
      }}
    >
      {glyph}
    </button>
  );
  return (
    <>
      {showRole && ln.role === "R" && moveArrow("L", "◀", "Make this a Call (move left)", "left")}
      {ws.map((w, wi) => {
        const a = ln.anchors.includes(wi);
        return (
          <span key={wi}>
            <button
              onClick={() => onWord(wi)}
              style={{
                font: "inherit",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "0 1px",
                borderRadius: 4,
                color: a ? "var(--gold)" : "inherit",
                fontStyle: a ? "italic" : "normal",
                fontWeight: a ? 600 : 400,
                borderBottom: a ? "none" : "1px dashed rgba(127,127,127,.45)",
              }}
            >
              {w}
            </button>
            {wi < ws.length - 1 ? " " : ""}
          </span>
        );
      })}
      {showRole && ln.role !== "R" && moveArrow("R", "▶", "Make this a Response (move right)", "right")}
    </>
  );
}

export function Immersive({ prayers }: { prayers: ImmersivePrayer[] }) {
  const order = prayers.map((p) => p.slug);
  const byId = Object.fromEntries(prayers.map((p) => [p.slug, p]));

  const [route, setRoute] = useState<Route>("library");
  const [pid, setPid] = useState<string>(order[0]);
  const [playing, setPlaying] = useState(false);
  const [activeLine, setActiveLine] = useState(-1);
  const [typed, setTyped] = useState("");
  // Devotion view: a representative slug picks which diagram (rosary / chaplet).
  const [devotionSlug, setDevotionSlug] = useState<string>("our-father");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  // Last prayer opened in the Player — powers "Continue" on the dashboard.
  // Per-device (localStorage); the DB progress models aren't wired up yet.
  const [lastSlug, setLastSlug] = useState<string | null>(null);
  // Greeting is time-of-day dependent; compute on the client (mount effect) so
  // it can't cause an SSR/hydration mismatch.
  const [greeting, setGreeting] = useState("Welcome back");
  // Collapsed home-page categories (accordion) — all open by default.
  const [collapsedSets, setCollapsedSets] = useState<Set<string>>(new Set());
  const toggleSet = (section: string) =>
    setCollapsedSets((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });

  // Practice: choose an exercise (recite by voice / type) and show anchors or not.
  const [exercise, setExercise] = useState<"recite" | "type">("recite");
  const [reciteMode, setReciteMode] = useState<"line" | "buildup">("line");
  const [anchorsOn, setAnchorsOn] = useState(true);
  const [lineIdx, setLineIdx] = useState(0); // current line in the typing test
  const [lineResults, setLineResults] = useState<{ ok: number; total: number }[]>([]);

  const cur = byId[pid] ?? prayers[0];

  // ---- inline editing (anchors + roles), saved to canonical content --------
  type Ov = { anchors: Record<number, number[]>; roles: Record<number, "L" | "R"> };
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Ov | null>(null);
  const [overrides, setOverrides] = useState<Record<string, Ov>>({});
  const [editStatus, setEditStatus] = useState<
    "idle" | "saving" | "saved" | "error" | "auth"
  >("idle");

  const effLines = useCallback(
    (p: ImmersivePrayer): ImmersiveLine[] => {
      const ov = editing && p.slug === pid ? draft : overrides[p.slug];
      // Every prayer defaults to all-call (Leader); responses come only from a
      // saved edit. So the base line role is ignored unless overridden.
      return p.lines.map((ln) => ({
        ...ln,
        role: ov?.roles[ln.order] ?? "L",
        anchors: ov?.anchors[ln.order] ?? ln.anchors,
      }));
    },
    [editing, draft, overrides, pid],
  );

  const resetTyping = () => {
    setLineIdx(0);
    setLineResults([]);
    setTyped("");
  };
  const changeExercise = (e: "recite" | "type") => {
    setExercise(e);
    resetTyping();
  };

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The off-screen field that captures typing for the inline Type exercise.
  const typeInputRef = useRef<HTMLInputElement | null>(null);
  const focusTypeInput = () => typeInputRef.current?.focus();

  useEffect(() => {
    const t = document.documentElement.getAttribute("data-theme");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read resolved theme once
    if (t === "light") setTheme("light");
    try {
      const saved = localStorage.getItem("memoria-last");
      if (saved && byId[saved]) setLastSlug(saved);
    } catch {}
    try {
      // Restore inline anchor/role edits saved on this device.
      const ovRaw = localStorage.getItem("memoria-overrides");
      if (ovRaw) setOverrides(JSON.parse(ovRaw));
    } catch {}
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  // ---- URL deep-linking --------------------------------------------------
  // The screen is in-app state, not a route; mirror it in the query string
  // (?view&prayer&ex&mode) so Practice / Recite / Build-up are shareable and
  // survive a refresh. Read once on load, then write on every state change.
  const urlInited = useRef(false);
  const skipFirstWrite = useRef(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- restore screen from URL once on mount */
    try {
      const q = new URLSearchParams(window.location.search);
      const v = q.get("view");
      const pr = q.get("prayer");
      const ex = q.get("ex");
      const m = q.get("mode");
      const hasPrayer = !!(pr && byId[pr]);
      if (hasPrayer) setPid(pr!);
      if (v === "library" || v === "profile") setRoute(v);
      else if ((v === "player" || v === "practice") && hasPrayer) setRoute(v);
      else if (v === "devotion" && hasPrayer) {
        setRoute("devotion");
        setDevotionSlug(pr!);
      }
      if (ex === "recite" || ex === "type") setExercise(ex);
      if (m === "line" || m === "buildup") setReciteMode(m);
    } catch {}
    /* eslint-enable react-hooks/set-state-in-effect */
    urlInited.current = true;
    skipFirstWrite.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  useEffect(() => {
    if (!urlInited.current) return;
    // The first write after the load-time read would run with pre-restore state
    // and clobber the deep link; skip it.
    if (skipFirstWrite.current) {
      skipFirstWrite.current = false;
      return;
    }
    try {
      const q = new URLSearchParams();
      if (route !== "library") q.set("view", route);
      if (route === "player" || route === "practice") q.set("prayer", pid);
      if (route === "devotion") q.set("prayer", devotionSlug);
      if (route === "practice") {
        q.set("ex", exercise);
        if (exercise === "recite") q.set("mode", reciteMode);
      }
      const qs = q.toString();
      window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
    } catch {}
  }, [route, pid, exercise, reciteMode, devotionSlug]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("memoria-theme", next);
    } catch {}
  };

  const stopPlay = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlaying(false);
    setActiveLine(-1);
  }, []);

  // ---- Library read-aloud: tap a card's play button to hear the whole prayer
  // in the chosen voice (Male / Female), line by line. Independent of the
  // full player above so listening never leaves the grid. ----
  const [libVoice, setLibVoice] = useState<VoiceId>("onyx");
  // Player playback voice. "both" (call-and-response prayers only) alternates
  // male leader / female responder; otherwise the whole prayer uses one voice.
  const [playVoice, setPlayVoice] = useState<VoiceId | "both">("both");
  const [libReading, setLibReading] = useState<string | null>(null);
  const libAudioRef = useRef<HTMLAudioElement | null>(null);
  const libTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const libTokenRef = useRef(0); // bump to cancel an in-flight sequence

  const stopRead = useCallback(() => {
    libTokenRef.current += 1;
    if (libTimerRef.current) {
      clearTimeout(libTimerRef.current);
      libTimerRef.current = null;
    }
    if (libAudioRef.current) {
      libAudioRef.current.pause();
      libAudioRef.current = null;
    }
    setLibReading(null);
  }, []);

  function readAloud(p: ImmersivePrayer) {
    if (libReading === p.slug) {
      stopRead();
      return;
    }
    stopRead();
    const token = (libTokenRef.current += 1);
    setLibReading(p.slug);
    const lines = [...p.lines].sort((a, b) => a.order - b.order);
    const play = (i: number) => {
      if (token !== libTokenRef.current) return; // superseded / stopped
      if (i >= lines.length) {
        setLibReading(null);
        return;
      }
      const ln = lines[i];
      const dwell = Math.min(3000, Math.max(1100, ln.text.split(/\s+/).length * 330 + 450));
      const a = new Audio(audioSrc(p.slug, ln.order, libVoice));
      a.playbackRate = 1.15;
      libAudioRef.current = a;
      a.onended = () => play(i + 1);
      a.onerror = () => {
        libTimerRef.current = setTimeout(() => play(i + 1), dwell);
      };
      a.play().catch(() => {
        libTimerRef.current = setTimeout(() => play(i + 1), dwell);
      });
    };
    play(0);
  }

  // Walk the prayer line by line, playing each line's clip (Leader = male,
  // Response = female), skipping lines filtered out by the Voices toggle.
  // A hoisted function so it can schedule its own next step.
  function step(p: ImmersivePrayer, i: number) {
    const lines = effLines(p);
    if (i >= lines.length) {
      stopPlay();
      return;
    }
    const ln = lines[i];
    setActiveLine(i);
    const voice: VoiceId =
      playVoice === "both" ? (ln.role === "R" ? "shimmer" : "onyx") : playVoice;
    const dwell = Math.min(
      3000,
      Math.max(1100, ln.text.split(/\s+/).length * 330 + 450),
    );
    const a = new Audio(audioSrc(p.slug, ln.order, voice));
    a.playbackRate = 1.2;
    audioRef.current = a;
    a.onended = () => step(p, i + 1);
    a.onerror = () => {
      timerRef.current = setTimeout(() => step(p, i + 1), dwell);
    };
    a.play().catch(() => {
      timerRef.current = setTimeout(() => step(p, i + 1), dwell);
    });
  }

  const togglePlay = () => {
    if (playing) {
      stopPlay();
    } else {
      stopPlay();
      setPlaying(true);
      step(cur, 0);
    }
  };

  const go = (r: Route, id?: string) => {
    stopPlay();
    stopRead();
    setEditing(false);
    setDraft(null);
    setActiveLine(-1);
    setLineIdx(0);
    setLineResults([]);
    setTyped("");
    if (id) setPid(id);
    if (r === "player" && id) {
      setLastSlug(id);
      try {
        localStorage.setItem("memoria-last", id);
      } catch {}
    }
    setRoute(r);
  };

  const enterEdit = () => {
    stopPlay();
    const base = effLines(cur);
    setDraft({
      anchors: Object.fromEntries(base.map((l) => [l.order, [...l.anchors]])),
      roles: Object.fromEntries(base.map((l) => [l.order, l.role])),
    });
    setEditStatus("idle");
    setEditing(true);
  };
  const cancelEdit = () => {
    setEditing(false);
    setDraft(null);
    setEditStatus("idle");
  };
  const toggleWordAnchor = (order: number, wi: number) =>
    setDraft((d) => {
      if (!d) return d;
      const set = new Set(d.anchors[order] ?? []);
      if (set.has(wi)) set.delete(wi);
      else set.add(wi);
      return { ...d, anchors: { ...d.anchors, [order]: [...set].sort((a, b) => a - b) } };
    });
  const setLineRole = (order: number, role: "L" | "R") =>
    setDraft((d) => (d ? { ...d, roles: { ...d.roles, [order]: role } } : d));
  const saveEdit = async () => {
    if (!draft) return;
    const d = draft;
    const nextOv = { ...overrides, [cur.slug]: d };
    setOverrides(nextOv);
    // Persist on-device so edits survive a reload even when the DB save is
    // unauthenticated (no sign-in). effLines reads overrides on next mount.
    try {
      localStorage.setItem("memoria-overrides", JSON.stringify(nextOv));
    } catch {}
    setEditing(false);
    setEditStatus("saving");
    const anchors: Record<string, number[]> = {};
    const roles: Record<string, string> = {};
    cur.lines.forEach((ln) => {
      anchors[ln.id] = d.anchors[ln.order] ?? ln.anchors;
      roles[ln.id] = (d.roles[ln.order] ?? ln.role) === "R" ? "RESPONDER" : "CALLER";
    });
    const body: { anchors: typeof anchors; roles?: typeof roles } = { anchors };
    if (cur.cr) body.roles = roles; // only touch roles on call-and-response prayers
    try {
      const res = await fetch(`/api/passages/${cur.slug}/content`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setEditStatus(res.status === 401 ? "auth" : res.ok ? "saved" : "error");
    } catch {
      setEditStatus("error");
    }
  };

  useEffect(() => stopPlay, [stopPlay]);

  // ---- shared bits -------------------------------------------------------
  const topPad: React.CSSProperties = {
    minHeight: "100vh",
    maxWidth: 440,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    padding: "54px 18px 0",
    color: "var(--ink)",
    fontFamily: "var(--font-sans), system-ui, sans-serif",
  };
  const glass = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: "var(--glass)",
    border: "1px solid var(--glass-border)",
    ...extra,
  });

  function anchorWline(text: string, anchors: number[], active: boolean) {
    const ws = text.split(/\s+/).filter(Boolean);
    return ws.map((w, i) => {
      const isA = anchors.includes(i);
      const node = isA ? (
        <em
          key={i}
          style={{
            color: "var(--gold)",
            fontStyle: "italic",
            fontWeight: 600,
            textShadow:
              active && theme === "dark"
                ? "0 0 14px rgba(227,188,92,.7)"
                : "none",
          }}
        >
          {w}
        </em>
      ) : (
        <span key={i}>{w}</span>
      );
      return (
        <span key={i}>
          {node}
          {i < ws.length - 1 ? " " : ""}
        </span>
      );
    });
  }

  // ---- HOME (dashboard) --------------------------------------------------
  function Home() {
    const feat = byId[order[1]] ?? cur;
    const resume = lastSlug ? byId[lastSlug] : null;

    // Placeholder figures until DB progress (PracticeSession/MasteryState) is wired up.
    const stats: [string, string][] = [
      ["12", "day streak"],
      ["4", "by heart"],
      ["38", "sessions"],
    ];

    const quick = (icon: string, label: string, sub: string, onClick: () => void) => (
      <button
        key={label}
        onClick={onClick}
        style={glass({ display: "flex", alignItems: "center", gap: 11, padding: "13px 14px", borderRadius: 16, textAlign: "left", width: "100%" })}
      >
        <div style={{ width: 38, height: 38, borderRadius: 11, background: "var(--icon-grad)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon name={icon} size={17} color="var(--icon-stroke)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, color: "var(--ink)", fontWeight: 600 }}>{label}</div>
          <div style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>{sub}</div>
        </div>
        <Icon name="next" size={15} color="var(--ink-faint)" />
      </button>
    );

    return (
      <div style={topPad}>
        {/* Greeting + brand */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ letterSpacing: ".18em", textTransform: "uppercase", fontSize: 10.5, color: "var(--ink-faint)", fontWeight: 700 }}>
              {greeting}
            </div>
            <div style={{ fontFamily: SERIF, fontSize: 26, color: "var(--ink)", marginTop: 1 }}>
              Memoria
            </div>
          </div>
          <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
            <button onClick={toggleTheme} aria-label="Toggle theme" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 999, background: "var(--chip-bg)", border: "1px solid var(--chip-bd)", color: "var(--gold)" }}>
              <Icon name={theme === "dark" ? "sun" : "moon"} size={16} color="currentColor" />
            </button>
            <button onClick={() => go("profile")} aria-label="You" style={{ width: 34, height: 34, borderRadius: 999, background: "linear-gradient(135deg,var(--gold-soft),var(--gold))", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SERIF, fontSize: 16, color: "#fff", fontWeight: 600, border: "1px solid rgba(255,255,255,.18)" }}>
              A
            </button>
          </div>
        </div>

        {/* Stats strip (placeholder figures) */}
        <button
          onClick={() => go("profile")}
          style={{ display: "flex", gap: 9, marginTop: 16, width: "100%", background: "none", border: "none", padding: 0 }}
        >
          {stats.map(([n, l]) => (
            <div key={l} style={glass({ flex: 1, borderRadius: 16, padding: "13px 8px", textAlign: "center" })}>
              <div style={{ fontFamily: SERIF, fontSize: 24, color: "var(--ink)" }}>{n}</div>
              <div style={{ fontSize: 10.5, color: "var(--ink-faint)", marginTop: 1 }}>{l}</div>
            </div>
          ))}
        </button>

        {/* Today's featured prayer */}
        <button
          onClick={() => go("player", feat.slug)}
          style={{
            marginTop: 16,
            borderRadius: 26,
            padding: 22,
            minHeight: 238,
            position: "relative",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            border: "1px solid var(--glass-border)",
            background: "var(--feat-grad)",
            boxShadow: "0 22px 50px rgba(0,0,0,.25)",
            textAlign: "left",
            width: "100%",
          }}
        >
          <div style={{ position: "absolute", width: 200, height: 200, borderRadius: 999, right: -50, top: -60, background: "radial-gradient(circle,var(--feat-g1),transparent 65%)" }} />
          <div style={{ position: "absolute", width: 170, height: 170, borderRadius: 999, left: -40, bottom: -50, background: "radial-gradient(circle,var(--feat-g2),transparent 65%)" }} />
          <div style={{ position: "relative" }}>
            <div style={{ letterSpacing: ".2em", textTransform: "uppercase", fontSize: 10.5, fontWeight: 700, color: "var(--gold)" }}>
              Today · The Rosary
            </div>
            <div style={{ fontFamily: SERIF, fontSize: 42, lineHeight: 1, color: "var(--feat-ink)", marginTop: 10, letterSpacing: "-.01em" }}>
              {feat.title}
            </div>
            <div style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 8 }}>
              {feat.lines.length} lines · {feat.cr ? "call & response · " : ""}
              {feat.dur}
            </div>
          </div>
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 14, marginTop: 18 }}>
            <div style={{ width: 54, height: 54, borderRadius: 999, background: "var(--play-grad)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--play-glow)", flexShrink: 0 }}>
              <PlayGlyph color="var(--gold-text)" size={17} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 15, color: "var(--feat-ink)" }}>Begin session</div>
              <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>Guided · both voices</div>
            </div>
            <Icon name="bookmark" size={20} color="var(--ink-soft)" />
          </div>
        </button>

        {/* Continue where you left off */}
        {resume && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--ink-faint)", margin: "24px 0 11px" }}>
              Continue
            </div>
            <button
              onClick={() => go("player", resume.slug)}
              style={glass({ display: "flex", alignItems: "center", gap: 13, padding: "12px 13px", borderRadius: 16, textAlign: "left", width: "100%" })}
            >
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--icon-grad)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name={resume.icon} size={18} color="var(--icon-stroke)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: SERIF, fontSize: 18, color: "var(--ink)" }}>{resume.title}</div>
                <div style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>Pick up where you left off</div>
              </div>
              <div style={{ width: 32, height: 32, borderRadius: 999, background: "var(--chip-bg)", border: "1px solid var(--chip-bd)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <PlayGlyph color="var(--ink)" size={11} />
              </div>
            </button>
          </>
        )}

        {/* Quick actions */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--ink-faint)", margin: "24px 0 11px" }}>
          Jump in
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {quick("target", "Practice", "Recite or type from memory", () => go("practice", feat.slug))}
          {quick("book", "Browse the Library", `${prayers.length} prayers · Rosary, Divine Mercy & more`, () => go("library"))}
        </div>

      </div>
    );
  }

  // ---- LIBRARY -----------------------------------------------------------
  // Which curated collections a prayer belongs to (a prayer can be in both).
  const COLLECTION_PILL: Record<string, { label: string; bg: string; fg: string; slug: string }> = {
    "The Rosary": { label: "Rosary", bg: "rgba(37, 99, 235, 0.1)", fg: "var(--gold)", slug: "our-father" },
    "Divine Mercy": { label: "Divine Mercy", bg: "rgba(249, 115, 22, 0.12)", fg: "var(--accent)", slug: "divine-mercy-chaplet" },
  };
  const collectionsFor = (slug: string) =>
    COLLECTIONS.filter((c) => c.slugs.includes(slug)).map((c) => c.title);

  function PrayerCard(p: ImmersivePrayer) {
    const tags = collectionsFor(p.slug);
    const reading = libReading === p.slug;
    return (
      <div
        key={p.slug}
        role="button"
        tabIndex={0}
        onClick={() => go("player", p.slug)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            go("player", p.slug);
          }
        }}
        style={glass({
          display: "flex",
          flexDirection: "column",
          gap: 11,
          padding: 15,
          borderRadius: 18,
          textAlign: "left",
          height: "100%",
          cursor: "pointer",
          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.05)",
        })}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 13,
              background: "var(--icon-grad)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Icon name={p.icon} size={19} color="var(--icon-stroke)" />
          </div>
          {tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 5 }}>
              {tags.map((t) => {
                const s = COLLECTION_PILL[t];
                return (
                  <button
                    key={t}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDevotionSlug(s.slug);
                      go("devotion");
                    }}
                    aria-label={`Open the ${s.label} view`}
                    style={{
                      fontSize: 9,
                      fontWeight: 600,
                      letterSpacing: ".02em",
                      padding: "2px 7px",
                      borderRadius: 999,
                      background: s.bg,
                      color: s.fg,
                      border: "none",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10, marginTop: "auto" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: SERIF, fontSize: 17.5, lineHeight: 1.2, color: "var(--ink)" }}>
              {p.title}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: 3 }}>
              {/* Poems carry their poet in `sub` — lead with the author. */}
              {p.section === "Poems" && p.sub ? `${p.sub} · ` : ""}
              {p.lines.length} lines{p.cr ? " · call & response" : ""}
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              readAloud(p);
            }}
            aria-label={reading ? `Stop reading ${p.title}` : `Read ${p.title} aloud`}
            style={{
              width: 38,
              height: 38,
              borderRadius: 999,
              background: "var(--play-grad)",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {reading ? <PauseGlyph color="#fff" size={14} /> : <PlayGlyph color="#fff" size={13} />}
          </button>
        </div>
      </div>
    );
  }

  function Library() {
    // One card per prayer (a prayer can be prayed in several devotions but is
    // listed once); its pills show which collections it belongs to.
    const seen = new Set<string>();
    const unique = prayers.filter((p) => !seen.has(p.slug) && seen.add(p.slug));

    return (
      <div style={{ ...topPad, maxWidth: "none", padding: "54px 10% 0" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginTop: 2 }}>
          <div>
            <div style={{ letterSpacing: ".18em", textTransform: "uppercase", fontSize: 10.5, color: "var(--gold)", fontWeight: 700 }}>
              {greeting}
            </div>
            <div style={{ fontFamily: SERIF, fontSize: 34, color: "var(--ink)", marginTop: 2, letterSpacing: "-.01em" }}>
              Your Library
            </div>
          </div>
          {/* Voice for the card play buttons (reads the prayer aloud). */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--ink-faint)" }}>
              Voice
            </span>
            <div style={{ display: "inline-flex", background: "var(--chip-bg)", border: "1px solid var(--chip-bd)", borderRadius: 999, padding: 3, gap: 2 }}>
              {VOICES.map((v) => {
                const on = libVoice === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => setLibVoice(v.id)}
                    style={{
                      padding: "6px 15px",
                      borderRadius: 999,
                      border: "none",
                      cursor: "pointer",
                      fontSize: 12.5,
                      fontWeight: 600,
                      background: on ? "var(--gold)" : "transparent",
                      color: on ? "#fff" : "var(--ink-soft)",
                    }}
                  >
                    {v.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        {libraryGroups(unique).map((g) => {
          const open = !collapsedSets.has(g.section);
          return (
            <div key={g.section} style={{ marginTop: 30 }}>
              <button
                onClick={() => toggleSet(g.section)}
                aria-expanded={open}
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", marginBottom: open ? 13 : 0, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
              >
                <span
                  aria-hidden
                  style={{ display: "inline-flex", transition: "transform .2s", transform: open ? "rotate(0deg)" : "rotate(-90deg)", color: "var(--ink-faint)" }}
                >
                  <Icon name="chevdown" size={16} color="currentColor" />
                </span>
                <h2 style={{ fontFamily: SERIF, fontSize: 20, color: "var(--ink)", margin: 0, letterSpacing: "-.01em" }}>{g.section}</h2>
                <span style={{ fontSize: 12, color: "var(--ink-faint)", fontWeight: 500 }}>{g.items.length}</span>
              </button>
              {open && (
                <div className="library-grid">
                  {g.items.map((p) => PrayerCard(p))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ---- DEVOTION (Rosary / Divine Mercy) — first pass: the bead diagram ----
  function Devotion() {
    return (
      <div style={{ ...topPad, maxWidth: "none", padding: "54px 4% 0" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
          <button
            onClick={() => go("library")}
            aria-label="Home"
            style={glass({ display: "flex", alignItems: "center", gap: 6, height: 38, padding: "0 15px 0 11px", borderRadius: 999, color: "var(--ink)" })}
          >
            <Icon name="home" size={16} color="currentColor" />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Home</span>
          </button>
        </div>
        <ImmersiveRosaryMap
          slug={devotionSlug}
          onPrayer={(s) => go("player", s)}
          onPractice={(s) => go("practice", s)}
          textFor={(s) => byId[s]?.lines.map((l) => l.text) ?? null}
        />
      </div>
    );
  }

  // ---- PLAYER ------------------------------------------------------------
  function Player() {
    const p = cur;
    const lines = effLines(p);
    const total = p.durSec;
    const elapsed = activeLine >= 0 ? (total * (activeLine + 1)) / lines.length : 0;
    return (
      <div
        style={{ ...topPad, maxWidth: undefined, margin: undefined, padding: "54px 6% 0" }}
        className="immersive-shell immersive-shell--wide"
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={() => go("library")} aria-label="Home" style={glass({ display: "flex", alignItems: "center", gap: 6, height: 38, padding: "0 15px 0 11px", borderRadius: 999, color: "var(--ink)" })}>
            <Icon name="home" size={16} color="currentColor" />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Home</span>
          </button>
          <button
            onClick={() => (editing ? cancelEdit() : enterEdit())}
            aria-label="Edit anchors & call-and-response roles"
            title="Edit anchors & call-and-response roles"
            style={glass({ display: "flex", alignItems: "center", gap: 6, height: 38, padding: "0 15px 0 12px", borderRadius: 999, color: editing ? "var(--gold)" : "var(--ink)", borderColor: editing ? "var(--gold)" : "var(--glass-border)" })}
          >
            <Icon name="edit" size={15} color="currentColor" />
            <span style={{ fontSize: 13, fontWeight: 600 }}>{editing ? "Editing…" : "Edit"}</span>
          </button>
        </div>

        <div style={{ textAlign: "center", marginTop: 10 }}>
          <div style={{ fontFamily: SERIF, fontSize: 44, lineHeight: 1.05, color: "var(--ink)", letterSpacing: "-.01em" }}>
            {p.title}
          </div>
          {p.section === "Poems" && p.sub && (
            <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 16, color: "var(--ink-faint)", marginTop: 6 }}>
              {p.sub}
            </div>
          )}
        </div>

        {editing && (
          <div style={{ textAlign: "center", marginTop: 16, fontSize: 12.5, color: "var(--ink-soft)" }}>
            Tap words to set anchors · tap a line’s arrow to move it between call and response.
          </div>
        )}

        {/* Opening a prayer shows just the prayer for now — the bead diagram is
            hidden behind this flag until we bring it back. */}
        <div className={!editing && SHOW_DIAGRAM ? "player-cols" : undefined}>
          {!editing && SHOW_DIAGRAM && (
            <div className="col-aside">
              <div className="col-aside-inner">
                <ImmersiveRosaryMap slug={p.slug} onPrayer={(s) => go("player", s)} />
              </div>
            </div>
          )}
          <div className="col-lines">
            {/* Lines */}
            <div style={{ marginTop: editing ? 14 : 24, display: "flex", flexDirection: "column", gap: 11 }}>
              {lines.map((ln, i) => {
            const isR = ln.role === "R";
            const act = !editing && playing && activeLine === i;
            const dimmed = playing && !act;
            const bg = act ? (isR ? "var(--resp-act-bg)" : "var(--act-bg)") : isR ? "var(--resp-bubble)" : "var(--leader-bubble)";
            const bd = act ? (isR ? "var(--resp-act-bd)" : "var(--act-bd)") : isR ? "var(--resp-bd)" : "var(--leader-bd)";
            const glow = act ? (isR ? "var(--resp-act-glow)" : "var(--act-glow)") : "none";
            return (
              <div key={i} style={{ display: "flex", justifyContent: isR ? "flex-end" : "flex-start" }}>
                <div
                  style={{
                    // Call & response lanes — wide enough that a left "call"
                    // and a right "response" sit close, not at opposite edges.
                    maxWidth: "78%",
                    padding: act ? "13px 18px" : "10px 16px",
                    borderRadius: isR ? "18px 18px 5px 18px" : "18px 18px 18px 5px",
                    background: bg,
                    border: `1px solid ${bd}`,
                    fontFamily: SERIF,
                    fontSize: act ? 21 : 18.5,
                    lineHeight: 1.32,
                    color: act ? "var(--act-ink)" : dimmed ? "var(--ink-faint)" : "var(--ink-soft)",
                    boxShadow: glow,
                    transform: act ? "scale(1.01)" : "none",
                    transition: "all .3s",
                    textAlign: isR ? "right" : "left",
                  }}
                >
                  {editing ? (
                    <EditableLine
                      ln={ln}
                      isR={isR}
                      showRole={p.cr}
                      onWord={(wi) => toggleWordAnchor(ln.order, wi)}
                      onSetRole={(role) => setLineRole(ln.order, role)}
                    />
                  ) : (
                    <>
                      {anchorWline(ln.text, ln.anchors, act)}
                      {act ? <span style={{ color: "var(--gold)", marginLeft: 3, animation: "hblink 1s steps(1) infinite" }}>▍</span> : null}
                    </>
                  )}
                </div>
              </div>
            );
          })}
            </div>
          </div>
        </div>

        {/* Edit bar (when editing) */}
        {editing && (
          <div style={{ position: "sticky", bottom: 14, marginTop: "auto", paddingTop: 22, zIndex: 30 }}>
            <div style={{ borderRadius: 22, padding: 14, background: "var(--glass-strong)", border: "1px solid var(--glass-border)", backdropFilter: "blur(20px) saturate(160%)", WebkitBackdropFilter: "blur(20px) saturate(160%)", boxShadow: "0 16px 38px rgba(0,0,0,.4)" }}>
              {editStatus === "auth" && (
                <p style={{ fontSize: 12.5, color: "var(--ink-soft)", textAlign: "center", marginBottom: 10 }}>
                  <a href="/signin?redirect=/" style={{ color: "var(--gold)", textDecoration: "underline" }}>Sign in</a> to save edits for everyone.
                </p>
              )}
              <div style={{ display: "flex", gap: 9 }}>
                <button onClick={cancelEdit} style={{ flex: 1, color: "var(--ink)", border: "1px solid var(--chip-bd)", borderRadius: 999, padding: 11, fontSize: 14, fontWeight: 600, background: "var(--chip-bg)" }}>Cancel</button>
                <button onClick={saveEdit} style={{ flex: 1, color: "var(--gold-text)", border: "none", borderRadius: 999, padding: 11, fontSize: 14, fontWeight: 700, background: "var(--play-grad)", boxShadow: "var(--play-glow)" }}>Save</button>
              </div>
            </div>
          </div>
        )}

        {/* Dock */}
        {!editing && (
        <div style={{ position: "sticky", bottom: 14, marginTop: "auto", paddingTop: 22, zIndex: 30 }}>
          <div
            className="player-dock-card"
            style={{
              borderRadius: 26,
              padding: "16px 18px 17px",
              background: "var(--glass-strong)",
              border: "1px solid var(--glass-border)",
              backdropFilter: "blur(20px) saturate(160%)",
              WebkitBackdropFilter: "blur(20px) saturate(160%)",
              boxShadow: "0 16px 38px rgba(0,0,0,.4)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 11, color: "var(--ink-faint)", fontVariantNumeric: "tabular-nums" }}>{fmt(elapsed)}</span>
              <div style={{ flex: 1, height: 4, borderRadius: 99, background: "var(--track)", position: "relative" }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${total ? (elapsed / total) * 100 : 0}%`, background: "linear-gradient(90deg,var(--gold),var(--gold-soft))", borderRadius: 99 }} />
              </div>
              <span style={{ fontSize: 11, color: "var(--ink-faint)", fontVariantNumeric: "tabular-nums" }}>{fmt(total)}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 15 }}>
              <div style={{ display: "inline-flex", background: "var(--chip-bg)", border: "1px solid var(--chip-bd)", borderRadius: 999, padding: 3, gap: 2 }}>
                {[
                  { id: "onyx" as const, label: "Male", icon: "male" },
                  { id: "shimmer" as const, label: "Female", icon: "female" },
                  { id: "both" as const, label: "Both", icon: "both" },
                ].map((v) => {
                  const on = playVoice === v.id;
                  return (
                    <button
                      key={v.id}
                      onClick={() => setPlayVoice(v.id)}
                      aria-label={v.label}
                      title={v.label}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 30, borderRadius: 999, border: "none", cursor: "pointer", background: on ? "var(--gold)" : "transparent", color: on ? "#fff" : "var(--ink-soft)" }}
                    >
                      <Icon name={v.icon} size={17} color={on ? "#fff" : "var(--ink-soft)"} />
                    </button>
                  );
                })}
              </div>
              <button onClick={togglePlay} style={{ width: 64, height: 64, borderRadius: 999, background: "var(--play-grad)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--play-glow)" }}>
                {playing ? <PauseGlyph color="var(--gold-text)" size={18} /> : <PlayGlyph color="var(--gold-text)" size={20} />}
              </button>
              <button onClick={() => go("practice")} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--chip-bg)", borderRadius: 999, padding: "6px 12px", border: "1px solid var(--chip-bd)" }}>
                <Icon name="target" size={14} color="var(--gold)" />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--gold)" }}>Practice</span>
              </button>
            </div>
          </div>
        </div>
        )}
      </div>
    );
  }

  // ---- PRACTICE ----------------------------------------------------------

  function Practice() {
    const p = cur;
    // A segmented pill control (exercise type / recite mode).
    const seg = (opts: { v: string; label: string }[], value: string, onSel: (v: string) => void) => (
      <div style={{ display: "inline-flex", background: "var(--chip-bg)", border: "1px solid var(--chip-bd)", borderRadius: 999, padding: 3, gap: 2 }}>
        {opts.map((o) => {
          const on = value === o.v;
          return (
            <button key={o.v} onClick={() => onSel(o.v)} style={{ borderRadius: 999, padding: "6px 15px", fontSize: 12.5, fontWeight: 600, border: "none", cursor: "pointer", background: on ? "var(--gold)" : "transparent", color: on ? "#fff" : "var(--ink-soft)" }}>
              {o.label}
            </button>
          );
        })}
      </div>
    );

    // Shared header — matches the reading view: back + a toggle up top, a
    // centred title, then one clean row of controls.
    const header = (
      <>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => go("library")} aria-label="Home" title="Home" style={glass({ display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 999, color: "var(--ink)" })}>
              <Icon name="home" size={17} color="currentColor" />
            </button>
            <button onClick={() => go("player")} aria-label="Back to reading" style={glass({ display: "flex", alignItems: "center", gap: 6, height: 38, padding: "0 15px 0 11px", borderRadius: 999, color: "var(--ink)" })}>
              <Icon name="chevleft" size={16} color="currentColor" />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Read</span>
            </button>
          </div>
          <button onClick={() => setAnchorsOn((a) => !a)} aria-pressed={anchorsOn} aria-label={anchorsOn ? "Anchor words on" : "Anchor words off"} title={anchorsOn ? "Anchor words on" : "Anchor words off"} style={glass({ display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 999, borderColor: anchorsOn ? "var(--gold)" : "var(--glass-border)" })}>
            <Icon name="anchor" size={18} filled={anchorsOn} color={anchorsOn ? "var(--gold)" : "var(--ink-soft)"} />
          </button>
        </div>
        <div style={{ textAlign: "center", marginTop: 10 }}>
          <div style={{ fontFamily: SERIF, fontSize: 40, lineHeight: 1.05, color: "var(--ink)", letterSpacing: "-.01em" }}>{p.title}</div>
          {p.section === "Poems" && p.sub && (
            <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 15, color: "var(--ink-faint)", marginTop: 5 }}>
              {p.sub}
            </div>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          {seg([{ v: "recite", label: "Recite" }, { v: "type", label: "Type" }], exercise, (v) => changeExercise(v as "recite" | "type"))}
          {exercise === "recite" && seg([{ v: "line", label: "Line by line" }, { v: "buildup", label: "Build up" }], reciteMode, (v) => setReciteMode(v as "line" | "buildup"))}
        </div>
      </>
    );

    const shell = (children: React.ReactNode) => (
      <div style={{ ...topPad, maxWidth: undefined, margin: undefined, padding: "54px 6% 0" }} className="immersive-shell immersive-shell--wide">
        {header}
        {children}
      </div>
    );

    // ---- Recite (voice, line-by-line / build-up) ----
    if (exercise === "recite") {
      return shell(
        <ImmersiveRecite
          key={`${pid}-${anchorsOn}-${reciteMode}`}
          prayer={{ ...p, lines: effLines(p) }}
          anchorsOn={anchorsOn}
          mode={reciteMode}
          onRead={() => go("player")}
        />,
      );
    }

    // ---- Type (one line at a time) ----
    const tLines = effLines(p);
    const total = tLines.length;
    const done = lineIdx >= total;
    const accTotal = lineResults.reduce((a, r) => a + r.total, 0);
    const accOk = lineResults.reduce((a, r) => a + r.ok, 0);
    const acc = accTotal ? Math.round((accOk / accTotal) * 100) : 100;
    const prog = total ? Math.min(lineIdx, total) / total : 0;

    const curLine = done ? null : tLines[lineIdx];
    const tgtW = curLine ? curLine.text.split(/\s+/).filter(Boolean) : [];
    const tw = typed.split(/\s+/).filter(Boolean);
    const committed = /\s$/.test(typed) ? tw.length : Math.max(0, tw.length - 1);

    // Commit on space; when the whole line is typed, score it and advance.
    const onType = (value: string) => {
      const ends = /\s$/.test(value);
      const words = value.split(/\s+/).filter(Boolean);
      const comm = ends ? words.length : Math.max(0, words.length - 1);
      if (tgtW.length > 0 && comm >= tgtW.length) {
        let ok = 0;
        for (let i = 0; i < tgtW.length; i++)
          if (words[i] && norm(words[i]) === norm(tgtW[i])) ok++;
        setLineResults((r) => [...r, { ok, total: tgtW.length }]);
        setLineIdx((i) => i + 1);
        setTyped("");
      } else {
        setTyped(value);
      }
    };
    const revealWord = () => {
      if (!curLine) return;
      const c = typed.replace(/\s+$/, "");
      onType((c.length ? c + " " : "") + (tgtW[committed] ?? "") + " ");
    };
    const restart = () => {
      setLineResults([]);
      setLineIdx(0);
      setTyped("");
    };

    const head = (
      <div style={{ marginTop: 12, maxWidth: 320, marginLeft: "auto", marginRight: "auto" }}>
        <div style={{ fontSize: 12, color: "var(--ink-soft)", textAlign: "center" }}>
          {done ? `Complete · ${acc}% accurate` : `Line ${Math.min(lineIdx + 1, total)} / ${total} · ${acc}% accurate`}
        </div>
        <div style={{ height: 3, borderRadius: 99, background: "var(--track)", marginTop: 8, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${prog * 100}%`, background: "var(--gold)", borderRadius: 99, transition: "width .25s" }} />
        </div>
      </div>
    );

    const bubbles = (
      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 9 }}>
        {tLines.map((ln, li) => {
          const isR = ln.role === "R";
          const isCur = li === lineIdx && !done;
          const isPast = li < lineIdx;
          const ws = ln.text.split(/\s+/).filter(Boolean);
          let content: React.ReactNode;
          if (isCur) {
            content = ws.map((w, wi) => {
              const a = ln.anchors.includes(wi);
              let color = "var(--act-ink)";
              const st: React.CSSProperties = {};
              if (wi < committed) {
                const okk = tw[wi] && norm(tw[wi]) === norm(w);
                st.display = "inline-block";
                if (okk) {
                  color = a ? "var(--gold)" : "var(--act-ink)";
                  st.fontWeight = a ? 600 : 500;
                  st.fontStyle = a ? "italic" : "normal";
                  st.animation = "type-pop .28s ease-out both";
                } else {
                  color = "#E2876A";
                  st.textDecoration = "line-through";
                  st.animation = "type-shake .32s ease-in-out both";
                }
              } else if (anchorsOn && a) {
                // anchor hint stays legible when "Anchors on"
                color = "var(--gold)";
                st.fontStyle = "italic";
                st.opacity = wi === committed ? 0.85 : 0.6;
              } else if (wi === committed) {
                // the word you're on: a blinking caret underline
                color = "transparent";
                st.borderBottom = "2px solid var(--gold)";
                st.borderRadius = 3;
                st.animation = "caret-blink 1.1s step-end infinite";
              } else {
                // upcoming words: blanked so you can't read ahead
                color = "transparent";
                st.borderBottom = "2px dashed rgba(127,127,127,.5)";
                st.borderRadius = 3;
              }
              return (
                <span key={wi} style={{ color, transition: "color .15s", ...st }}>
                  {w}{" "}
                </span>
              );
            });
          } else if (isPast) {
            content = anchorWline(ln.text, ln.anchors, false);
          } else {
            content = ws.map((w, wi) => {
              const a = ln.anchors.includes(wi);
              const hint = anchorsOn && a;
              return (
                <span
                  key={wi}
                  style={
                    hint
                      ? { color: "var(--gold)", fontStyle: "italic", opacity: 0.5 }
                      : { color: "transparent", borderBottom: "2px dashed rgba(127,127,127,.4)", borderRadius: 3 }
                  }
                >
                  {w}{" "}
                </span>
              );
            });
          }
          const bg = isCur ? (isR ? "var(--resp-act-bg)" : "var(--act-bg)") : isR ? "var(--resp-bubble)" : "var(--leader-bubble)";
          const bd = isCur ? (isR ? "var(--resp-act-bd)" : "var(--act-bd)") : isR ? "var(--resp-bd)" : "var(--leader-bd)";
          return (
            <div key={li} style={{ display: "flex", justifyContent: isR ? "flex-end" : "flex-start" }}>
              <div
                onClick={isCur ? focusTypeInput : undefined}
                style={{
                  maxWidth: "86%",
                  padding: isCur ? "12px 17px" : "9px 15px",
                  borderRadius: isR ? "18px 18px 5px 18px" : "18px 18px 18px 5px",
                  background: bg,
                  border: "1px solid " + bd,
                  fontFamily: SERIF,
                  fontSize: isCur ? 20 : 18,
                  lineHeight: 1.32,
                  color: isPast ? "var(--ink-soft)" : "var(--ink-faint)",
                  boxShadow: isCur ? (isR ? "var(--resp-act-glow)" : "var(--act-glow)") : "none",
                  textAlign: isR ? "right" : "left",
                  opacity: !isCur && !isPast ? 0.75 : 1,
                  transition: "all .25s",
                  cursor: isCur ? "text" : "default",
                }}
              >
                {content}
              </div>
            </div>
          );
        })}
      </div>
    );

    if (done) {
      const great = acc >= 92;
      return shell(
        <>
          {head}
          <div style={{ opacity: 0.7 }}>{bubbles}</div>
          <div style={{ marginTop: "auto", textAlign: "center", padding: "20px 0 28px" }}>
            <div style={{ width: 56, height: 56, borderRadius: 999, background: great ? "#5FBD93" : "var(--play-grad)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
              <Icon name="check" size={26} color="#fff" />
            </div>
            <div style={{ fontFamily: SERIF, fontSize: 32, color: "var(--ink)" }}>{great ? "By heart." : "Almost there."}</div>
            <div style={{ color: "var(--ink-soft)", fontSize: 14, marginTop: 2 }}>{acc}% accurate</div>
            <button onClick={restart} style={{ marginTop: 16, background: "var(--play-grad)", color: "var(--gold-text)", borderRadius: 999, padding: "12px 26px", fontWeight: 600, fontSize: 14, boxShadow: "var(--play-glow)" }}>Practice again</button>
          </div>
        </>,
      );
    }

    return shell(
      <>
        {head}
        {bubbles}
        {/* The real typing happens off-screen, so the highlighted line above
            *is* the input — words fill in and light up as you go. Tapping the
            active line (or a helper below) refocuses the field. */}
        <input
          ref={typeInputRef}
          value={typed}
          onChange={(e) => onType(e.target.value)}
          autoFocus
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          aria-label="Type the current line"
          style={{ position: "fixed", bottom: 70, left: "50%", opacity: 0, width: 1, height: 1, padding: 0, border: "none", pointerEvents: "none" }}
        />
        <div style={{ position: "fixed", left: "50%", bottom: 14, transform: "translateX(-50%)", width: "min(500px, calc(100vw - 28px))", zIndex: 40, display: "flex", justifyContent: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 999, padding: 7, background: "var(--glass-strong)", border: "1px solid var(--glass-border)", backdropFilter: "blur(20px) saturate(160%)", WebkitBackdropFilter: "blur(20px) saturate(160%)", boxShadow: "0 16px 38px rgba(0,0,0,.4)" }}>
            <button onClick={() => { revealWord(); focusTypeInput(); }} style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ink)", border: "1px solid var(--chip-bd)", borderRadius: 999, padding: "9px 16px", fontSize: 13, fontWeight: 600, background: "var(--chip-bg)", cursor: "pointer" }}>
              <Icon name="eye" size={15} color="var(--ink-soft)" /> Reveal word
            </button>
            <button onClick={() => { restart(); focusTypeInput(); }} style={{ color: "var(--ink-soft)", border: "1px solid var(--chip-bd)", borderRadius: 999, padding: "9px 16px", fontSize: 13, fontWeight: 600, background: "var(--chip-bg)", cursor: "pointer" }}>↺ Restart</button>
          </div>
        </div>
      </>,
    );
  }

  // ---- PROFILE -----------------------------------------------------------
  function Profile() {
    const stat = (n: string, l: string) => (
      <div key={l} style={glass({ flex: 1, borderRadius: 18, padding: 16, textAlign: "center" })}>
        <div style={{ fontFamily: SERIF, fontSize: 30, color: "var(--ink)" }}>{n}</div>
        <div style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: 2 }}>{l}</div>
      </div>
    );
    return (
      <div style={topPad}>
        <div style={{ textAlign: "center", marginTop: 10 }}>
          <div style={{ width: 78, height: 78, borderRadius: 999, margin: "0 auto", background: "linear-gradient(135deg,var(--gold-soft),var(--gold))", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SERIF, fontSize: 34, color: "#fff", border: "2px solid var(--glass-border)" }}>A</div>
          <div style={{ fontFamily: SERIF, fontSize: 27, color: "var(--ink)", marginTop: 12 }}>Anthony</div>
          <div style={{ fontSize: 13, color: "var(--ink-faint)" }}>Praying since June</div>
        </div>
        <div style={{ display: "flex", gap: 11, marginTop: 24 }}>
          {stat("12", "day streak")}
          {stat("4", "by heart")}
          {stat("38", "sessions")}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--ink-faint)", margin: "26px 0 11px" }}>Settings</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <button onClick={toggleTheme} style={glass({ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 15px", borderRadius: 14, textAlign: "left", width: "100%" })}>
            <span style={{ fontSize: 14.5, color: "var(--ink)", fontWeight: 500 }}>Theme · {theme === "dark" ? "Candlelight" : "Dawn"}</span>
            <Icon name={theme === "dark" ? "sun" : "moon"} size={16} color="var(--gold)" />
          </button>
          {["Daily reminder", "Voices & audio", "Anchors", "About Memoria"].map((sett) => (
            <div key={sett} style={glass({ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 15px", borderRadius: 14 })}>
              <span style={{ fontSize: 14.5, color: "var(--ink)", fontWeight: 500 }}>{sett}</span>
              <Icon name="next" size={15} color="var(--ink-faint)" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const screen =
    route === "player" ? Player() : route === "practice" ? Practice() : route === "library" ? Library() : route === "devotion" ? Devotion() : route === "profile" ? Profile() : Home();

  return <div style={{ animation: "fade-up .45s ease-out", minHeight: "100vh" }}>{screen}</div>;
}
