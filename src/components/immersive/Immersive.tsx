"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon, PlayGlyph, PauseGlyph } from "@/components/immersive/Icon";
import { ImmersiveRosaryMap } from "@/components/immersive/ImmersiveRosaryMap";
import { audioSrc, type VoiceId } from "@/lib/voice";
import type { ImmersivePrayer } from "@/lib/immersive";

type Route = "home" | "library" | "player" | "practice" | "profile";
type Voices = "leader" | "response" | "both";

const SERIF = "var(--font-serif), Georgia, serif";
const norm = (w: string) => w.toLowerCase().replace(/[^a-z']/g, "");
const fmt = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;

export function Immersive({ prayers }: { prayers: ImmersivePrayer[] }) {
  const order = prayers.map((p) => p.slug);
  const byId = Object.fromEntries(prayers.map((p) => [p.slug, p]));

  const [route, setRoute] = useState<Route>("home");
  const [pid, setPid] = useState<string>(order[0]);
  const [playing, setPlaying] = useState(false);
  const [activeLine, setActiveLine] = useState(-1);
  const [voices, setVoices] = useState<Voices>("both");
  const [typed, setTyped] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  const cur = byId[pid] ?? prayers[0];

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voicesRef = useRef(voices);
  useEffect(() => {
    voicesRef.current = voices;
  }, [voices]);

  useEffect(() => {
    const t = document.documentElement.getAttribute("data-theme");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read resolved theme once
    if (t === "light") setTheme("light");
  }, []);

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

  // Walk the prayer line by line, playing each line's clip (Leader = male,
  // Response = female), skipping lines filtered out by the Voices toggle.
  // A hoisted function so it can schedule its own next step.
  function step(p: ImmersivePrayer, i: number) {
    if (i >= p.lines.length) {
      stopPlay();
      return;
    }
    const ln = p.lines[i];
    const v = voicesRef.current;
    const spoken =
      v === "both" ||
      (v === "leader" && ln.role === "L") ||
      (v === "response" && ln.role === "R");
    setActiveLine(i);
    if (!spoken) {
      timerRef.current = setTimeout(() => step(p, i + 1), 240);
      return;
    }
    const voice: VoiceId = ln.role === "R" ? "shimmer" : "onyx";
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
    setTyped("");
    setActiveLine(-1);
    if (id) setPid(id);
    setRoute(r);
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

  function PrayerRow(p: ImmersivePrayer) {
    return (
      <button
        key={p.slug}
        onClick={() => go("player", p.slug)}
        style={glass({
          display: "flex",
          alignItems: "center",
          gap: 13,
          padding: "12px 13px",
          borderRadius: 16,
          textAlign: "left",
          width: "100%",
        })}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: "var(--icon-grad)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon name={p.icon} size={18} color="var(--icon-stroke)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: SERIF, fontSize: 18, color: "var(--ink)" }}>
            {p.title}
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: "var(--ink-faint)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {p.lines.length} lines{p.cr ? " · call & response" : ""}
          </div>
        </div>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            background: "var(--chip-bg)",
            border: "1px solid var(--chip-bd)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <PlayGlyph color="var(--ink)" size={11} />
        </div>
      </button>
    );
  }

  function TabBar() {
    const isPray = route === "home" || route === "player";
    const item = (icon: string, label: string, r: Route, act: boolean) => (
      <button
        key={label}
        onClick={() => go(r)}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 3,
          color: act ? "var(--gold)" : "var(--ink-faint)",
          flex: 1,
        }}
      >
        <Icon name={icon} size={22} color="currentColor" />
        <span style={{ fontSize: 10, fontWeight: 600 }}>{label}</span>
      </button>
    );
    return (
      <div style={{ position: "sticky", bottom: 16, marginTop: "auto", paddingTop: 22, zIndex: 30 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-around",
            padding: "11px 8px",
            borderRadius: 24,
            background: "var(--glass-strong)",
            border: "1px solid var(--glass-border)",
            backdropFilter: "blur(18px) saturate(160%)",
            WebkitBackdropFilter: "blur(18px) saturate(160%)",
            boxShadow: "0 14px 34px rgba(0,0,0,.35)",
          }}
        >
          {item("pray", "Pray", "home", isPray)}
          {item("book", "Library", "library", route === "library")}
          {item("target", "Practice", "practice", route === "practice")}
          {item("user", "You", "profile", route === "profile")}
        </div>
      </div>
    );
  }

  // ---- HOME --------------------------------------------------------------
  function Home() {
    const feat = byId[order[1]] ?? cur;
    return (
      <div style={topPad}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ letterSpacing: ".18em", textTransform: "uppercase", fontSize: 10.5, color: "var(--ink-faint)", fontWeight: 700 }}>
              Pray by heart
            </div>
            <div style={{ fontFamily: SERIF, fontSize: 26, color: "var(--ink)", marginTop: 1 }}>
              Memoria
            </div>
          </div>
          <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
            <button onClick={toggleTheme} aria-label="Toggle theme" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 999, background: "var(--chip-bg)", border: "1px solid var(--chip-bd)", color: "var(--gold)" }}>
              <Icon name={theme === "dark" ? "sun" : "moon"} size={16} color="currentColor" />
            </button>
            <div style={{ width: 34, height: 34, borderRadius: 999, background: "linear-gradient(135deg,#C99A38,#7E5A1E)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SERIF, fontSize: 16, color: "#0A0C18", fontWeight: 600, border: "1px solid rgba(255,255,255,.18)" }}>
              A
            </div>
          </div>
        </div>

        {/* Featured */}
        <button
          onClick={() => go("player", feat.slug)}
          style={{
            marginTop: 18,
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

        {/* The Rosary list */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "24px 0 11px" }}>
          <div style={{ fontFamily: SERIF, fontSize: 21, color: "var(--ink)" }}>The Rosary</div>
          <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>{prayers.length} prayers</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {prayers.slice(0, 5).map((p) => PrayerRow(p))}
        </div>

        {TabBar()}
      </div>
    );
  }

  // ---- LIBRARY -----------------------------------------------------------
  function Library() {
    const sections = Array.from(new Set(prayers.map((p) => p.section)));
    return (
      <div style={topPad}>
        <div style={{ marginTop: 2 }}>
          <div style={{ letterSpacing: ".18em", textTransform: "uppercase", fontSize: 10.5, color: "var(--gold)", fontWeight: 700 }}>
            All prayers
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 34, color: "var(--ink)", marginTop: 2, letterSpacing: "-.01em" }}>
            Library
          </div>
        </div>
        {sections.map((sec) => (
          <div key={sec}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--ink-faint)", margin: "22px 0 11px" }}>
              {sec}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {prayers.filter((p) => p.section === sec).map((p) => PrayerRow(p))}
            </div>
          </div>
        ))}
        {TabBar()}
      </div>
    );
  }

  // ---- PLAYER ------------------------------------------------------------
  function Player() {
    const p = cur;
    const total = p.durSec;
    const elapsed = activeLine >= 0 ? (total * (activeLine + 1)) / p.lines.length : 0;
    return (
      <div style={topPad}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={() => go("home")} style={glass({ width: 38, height: 38, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center" })}>
            <Icon name="chevdown" size={18} color="var(--ink)" />
          </button>
          <div style={{ letterSpacing: ".22em", textTransform: "uppercase", fontSize: 10.5, color: "var(--ink-faint)", fontWeight: 700 }}>
            {p.section}
          </div>
          <a
            href={`/prayers/${p.slug}`}
            aria-label="Edit anchors & roles"
            title="Edit anchors & roles"
            style={glass({ width: 38, height: 38, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink)" })}
          >
            <Icon name="edit" size={17} color="currentColor" />
          </a>
        </div>

        {/* Halo */}
        <div style={{ textAlign: "center", marginTop: 16, position: "relative" }}>
          <div style={{ position: "absolute", left: "50%", top: -6, transform: "translateX(-50%)", width: 150, height: 150, borderRadius: 999, background: "radial-gradient(circle,var(--halo),transparent 65%)", animation: "hglow 5s ease-in-out infinite" }} />
          <div style={{ position: "relative", width: 80, height: 80, margin: "0 auto", borderRadius: 999, border: "1px solid var(--gold)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.9 }}>
            <div style={{ width: 54, height: 54, borderRadius: 999, border: "1px dashed var(--gold)", opacity: 0.6 }} />
            <div style={{ position: "absolute", width: 9, height: 9, borderRadius: 999, background: "var(--gold)", top: -4, boxShadow: "0 0 12px rgba(227,188,92,.8)" }} />
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 44, lineHeight: 1, color: "var(--ink)", marginTop: 16, letterSpacing: "-.01em" }}>
            {p.title}
          </div>
          <div style={{ color: "var(--ink-soft)", fontSize: 13, marginTop: 8 }}>
            {p.cr ? "Call & response · " : ""}gold marks the anchors
          </div>
        </div>

        {/* Lines */}
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 11 }}>
          {p.lines.map((ln, i) => {
            const isR = ln.role === "R";
            const act = playing && activeLine === i;
            const dimmed = playing && !act;
            const bg = act ? (isR ? "var(--resp-act-bg)" : "var(--act-bg)") : isR ? "var(--resp-bubble)" : "var(--leader-bubble)";
            const bd = act ? (isR ? "var(--resp-act-bd)" : "var(--act-bd)") : isR ? "var(--resp-bd)" : "var(--leader-bd)";
            const glow = act ? (isR ? "var(--resp-act-glow)" : "var(--act-glow)") : "none";
            return (
              <div key={i} style={{ display: "flex", justifyContent: isR ? "flex-end" : "flex-start" }}>
                <div
                  style={{
                    maxWidth: "84%",
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
                  {anchorWline(ln.text, ln.anchors, act)}
                  {act ? <span style={{ color: "var(--gold)", marginLeft: 3, animation: "hblink 1s steps(1) infinite" }}>▍</span> : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* Where this prayer falls on the beads */}
        <ImmersiveRosaryMap slug={p.slug} onPrayer={(s) => go("player", s)} />

        {/* Dock */}
        <div style={{ position: "sticky", bottom: 14, marginTop: "auto", paddingTop: 22, zIndex: 30 }}>
          <div
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
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${total ? (elapsed / total) * 100 : 0}%`, background: "linear-gradient(90deg,#C99A38,#F0CE78)", borderRadius: 99 }} />
              </div>
              <span style={{ fontSize: 11, color: "var(--ink-faint)", fontVariantNumeric: "tabular-nums" }}>{fmt(total)}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 15 }}>
              <button
                onClick={() => setVoices((v) => (v === "both" ? "leader" : v === "leader" ? "response" : "both"))}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--chip-bg)", borderRadius: 999, padding: "6px 12px", border: "1px solid var(--chip-bd)" }}
              >
                <Icon name="voices" size={14} color="var(--ink)" />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", textTransform: "capitalize" }}>{voices}</span>
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <Icon name="prev" size={22} color="var(--ink-soft)" />
                <button onClick={togglePlay} style={{ width: 64, height: 64, borderRadius: 999, background: "var(--play-grad)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--play-glow)" }}>
                  {playing ? <PauseGlyph color="var(--gold-text)" size={18} /> : <PlayGlyph color="var(--gold-text)" size={20} />}
                </button>
                <Icon name="next" size={22} color="var(--ink-soft)" />
              </div>
              <button onClick={() => go("practice")} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--chip-bg)", borderRadius: 999, padding: "6px 12px", border: "1px solid var(--chip-bd)" }}>
                <Icon name="target" size={14} color="var(--gold)" />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--gold)" }}>Practice</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- PRACTICE ----------------------------------------------------------
  function practiceState() {
    const raw = typed;
    const endsSp = /\s$/.test(raw);
    const tw = raw.split(/\s+/).filter(Boolean);
    const committed = endsSp ? tw.length : Math.max(0, tw.length - 1);
    const tgt: { t: string; a: boolean }[] = [];
    cur.lines.forEach((ln) => {
      ln.text.split(/\s+/).filter(Boolean).forEach((w, wi) => {
        tgt.push({ t: w, a: ln.anchors.includes(wi) });
      });
    });
    let ok = 0;
    for (let i = 0; i < committed && i < tgt.length; i++) {
      if (norm(tw[i]) === norm(tgt[i].t)) ok++;
    }
    return { tw, committed, tgt, ok, done: committed >= tgt.length && tgt.length > 0 };
  }

  function Practice() {
    const p = cur;
    const s = practiceState();
    const acc = s.committed > 0 ? Math.round((s.ok / s.committed) * 100) : 100;
    const prog = s.tgt.length ? s.committed / s.tgt.length : 0;
    const R = 26;
    const C = 2 * Math.PI * R;

    const reveal = () => {
      if (s.done) return;
      const c = typed.replace(/\s+$/, "");
      setTyped((c.length ? c + " " : "") + s.tgt[s.committed].t + " ");
    };

    let gi = 0;
    const body = p.lines.map((ln, li) => {
      const ws = ln.text.split(/\s+/).filter(Boolean);
      return (
        <div key={li} style={{ marginBottom: 3 }}>
          {ws.map((w, wi) => {
            const idx = gi++;
            const a = ln.anchors.includes(wi);
            let color = "var(--ink-faint)";
            const st: React.CSSProperties = {};
            if (idx < s.committed) {
              const okk = s.tw[idx] && norm(s.tw[idx]) === norm(w);
              if (okk) {
                color = a ? "var(--gold)" : "var(--ink)";
                st.fontWeight = a ? 600 : 500;
                st.fontStyle = a ? "italic" : "normal";
              } else {
                color = theme === "dark" ? "#E2876A" : "#C0492F";
                st.textDecoration = "line-through";
              }
            } else if (idx === s.committed && !s.done) {
              color = "var(--ink)";
              st.borderBottom = "2px solid var(--gold)";
            } else {
              color = "var(--ink-faint)";
              st.opacity = 0.28;
            }
            return (
              <span key={wi} style={{ color, transition: "color .15s", ...st }}>
                {w}{" "}
              </span>
            );
          })}
        </div>
      );
    });

    const display = (
      <div style={{ fontFamily: SERIF, fontSize: 21, lineHeight: 1.5, marginTop: 20 }}>{body}</div>
    );

    const head = (
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 18 }}>
        <div style={{ position: "relative", width: 64, height: 64, flexShrink: 0 }}>
          <svg width={64} height={64} viewBox="0 0 64 64">
            <circle cx={32} cy={32} r={R} fill="none" stroke="var(--track)" strokeWidth={5} />
            <circle cx={32} cy={32} r={R} fill="none" stroke="var(--gold)" strokeWidth={5} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - prog)} transform="rotate(-90 32 32)" style={{ transition: "stroke-dashoffset .25s" }} />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SERIF, fontSize: 17, color: "var(--ink)" }}>
            {Math.round(prog * 100)}%
          </div>
        </div>
        <div>
          <div style={{ fontFamily: SERIF, fontSize: 26, color: "var(--ink)", lineHeight: 1 }}>{p.title}</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 4 }}>
            {s.committed} / {s.tgt.length} words · {acc}% accurate
          </div>
        </div>
      </div>
    );

    const top = (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={() => go("player")} style={glass({ width: 38, height: 38, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center" })}>
          <Icon name="chevleft" size={18} color="var(--ink)" />
        </button>
        <div style={{ letterSpacing: ".22em", textTransform: "uppercase", fontSize: 10.5, color: "var(--ink-faint)", fontWeight: 700 }}>Practice</div>
        <div style={{ width: 38 }} />
      </div>
    );

    if (s.done) {
      const great = acc >= 92;
      return (
        <div style={topPad}>
          {top}
          {head}
          <div style={{ opacity: 0.5 }}>{display}</div>
          <div style={{ marginTop: "auto", textAlign: "center", padding: "24px 0 30px" }}>
            <div style={{ width: 56, height: 56, borderRadius: 999, background: great ? "#5FBD93" : "var(--play-grad)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
              <Icon name="check" size={26} color="#fff" />
            </div>
            <div style={{ fontFamily: SERIF, fontSize: 32, color: "var(--ink)" }}>{great ? "By heart." : "Almost there."}</div>
            <div style={{ color: "var(--ink-soft)", fontSize: 14, marginTop: 2 }}>{acc}% accurate</div>
            <button onClick={() => setTyped("")} style={{ marginTop: 16, background: "var(--play-grad)", color: "var(--gold-text)", borderRadius: 999, padding: "12px 26px", fontWeight: 600, fontSize: 14, boxShadow: "var(--play-glow)" }}>Practice again</button>
          </div>
        </div>
      );
    }

    return (
      <div style={topPad}>
        {top}
        {head}
        {display}
        <div style={{ position: "sticky", bottom: 14, marginTop: "auto", paddingTop: 18, zIndex: 30 }}>
          <div style={{ borderRadius: 22, padding: 14, background: "var(--glass-strong)", border: "1px solid var(--glass-border)", backdropFilter: "blur(20px) saturate(160%)", WebkitBackdropFilter: "blur(20px) saturate(160%)", boxShadow: "0 16px 38px rgba(0,0,0,.4)" }}>
            <textarea
              value={typed}
              placeholder="Recite from memory…"
              rows={2}
              onChange={(e) => setTyped(e.target.value)}
              style={{ width: "100%", resize: "none", background: "var(--glass)", border: "1px solid var(--glass-border)", borderRadius: 12, padding: "11px 13px", fontSize: 15, color: "var(--ink)", lineHeight: 1.4, fontFamily: "var(--font-sans), system-ui, sans-serif" }}
            />
            <div style={{ display: "flex", gap: 9, marginTop: 11 }}>
              <button onClick={reveal} style={{ flex: 1, color: "var(--ink)", border: "1px solid var(--chip-bd)", borderRadius: 999, padding: 9, fontSize: 13, fontWeight: 600, background: "var(--chip-bg)" }}>Reveal word</button>
              <button onClick={() => setTyped("")} style={{ flex: 1, color: "var(--ink)", border: "1px solid var(--chip-bd)", borderRadius: 999, padding: 9, fontSize: 13, fontWeight: 600, background: "var(--chip-bg)" }}>Restart</button>
            </div>
          </div>
        </div>
      </div>
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
          <div style={{ width: 78, height: 78, borderRadius: 999, margin: "0 auto", background: "linear-gradient(135deg,#C99A38,#7E5A1E)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SERIF, fontSize: 34, color: "#0A0C18", border: "2px solid var(--glass-border)" }}>A</div>
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
        {TabBar()}
      </div>
    );
  }

  const screen =
    route === "player" ? Player() : route === "practice" ? Practice() : route === "library" ? Library() : route === "profile" ? Profile() : Home();

  return <div style={{ animation: "fade-up .45s ease-out", minHeight: "100vh" }}>{screen}</div>;
}
