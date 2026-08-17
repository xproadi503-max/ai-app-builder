"use client";
import LivePreviewFrame from "./LivePreviewFrame";
import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";

/* ---------------------------------------------------------
   Design tokens — dark IDE / build-console aesthetic
--------------------------------------------------------- */
const c = {
  bg: "#0B0F17",
  panel: "#131A27",
  panelSunken: "#0E1420",
  border: "#232C3D",
  borderLight: "#2D3748",
  text: "#ECEDEE",
  textDim: "#8B92A5",
  textMute: "#5B6472",
  accent: "#F26207",
  accentHover: "#FF7A24",
  accentSoft: "rgba(242,98,7,0.13)",
  info: "#58A6FF",
  infoSoft: "rgba(88,166,255,0.13)",
  success: "#3FB950",
  successSoft: "rgba(63,185,80,0.13)",
  error: "#F85149",
  errorSoft: "rgba(248,81,73,0.13)",
  warning: "#E3B341",
  warningSoft: "rgba(227,179,65,0.13)",
};
const mono = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace';
const sans = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const styles = {
  page: { minHeight: "100vh", background: c.bg, color: c.text, fontFamily: sans },
  topbar: {
    position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "12px 18px", borderBottom: `1px solid ${c.border}`, background: "rgba(11,15,23,0.85)", backdropFilter: "blur(8px)",
  },
  brandRow: { display: "flex", alignItems: "center", gap: 10 },
  brandMark: {
    width: 34, height: 34, borderRadius: 9, background: c.accentSoft, border: `1px solid ${c.accent}55`,
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0,
  },
  brandTitle: { fontSize: 15, fontWeight: 700, lineHeight: 1.15 },
  brandSub: { fontSize: 10.5, color: c.textMute, fontFamily: mono, letterSpacing: 0.5, textTransform: "uppercase" },
  userRow: { display: "flex", alignItems: "center", gap: 10 },
  avatar: { width: 26, height: 26, borderRadius: "50%", border: `1px solid ${c.borderLight}` },
  userName: { fontSize: 13, color: c.textDim, display: "none" },
  logoutBtn: {
    width: 30, height: 30, borderRadius: 8, background: "transparent", border: `1px solid ${c.border}`,
    color: c.textDim, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  },

  main: { maxWidth: 760, margin: "0 auto", padding: "24px 16px 60px" },

  hero: { textAlign: "center", padding: "64px 12px 40px" },
  heroTitle: { fontSize: 30, fontWeight: 800, lineHeight: 1.25, letterSpacing: -0.5, margin: 0 },
  heroAccent: { color: c.accent },
  heroSub: { fontSize: 14.5, color: c.textDim, marginTop: 12, maxWidth: 420, marginLeft: "auto", marginRight: "auto", lineHeight: 1.6 },
  ghBtn: {
    marginTop: 28, padding: "13px 26px", background: "#20262f", color: "#fff", border: `1px solid ${c.borderLight}`,
    borderRadius: 10, fontSize: 14.5, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 10,
  },
  featRow: { display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 36 },
  featPill: {
    fontFamily: mono, fontSize: 11.5, color: c.textDim, border: `1px solid ${c.border}`, borderRadius: 20,
    padding: "6px 12px", display: "flex", alignItems: "center", gap: 6,
  },

  greetRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 18, fontSize: 13, color: c.textDim },

  panel: { background: c.panel, border: `1px solid ${c.border}`, borderRadius: 12, marginBottom: 16, overflow: "hidden" },
  panelHead: {
    display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px",
    borderBottom: `1px solid ${c.border}`,
  },
  panelHeadLeft: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: c.text },
  panelBody: { padding: 16 },

  tabStrip: { display: "flex", gap: 4, padding: "10px 10px 0" },
  tab: (active) => ({
    padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", borderRadius: "8px 8px 0 0",
    background: active ? c.panelSunken : "transparent", color: active ? c.text : c.textMute,
    borderBottom: active ? `2px solid ${c.accent}` : "2px solid transparent",
  }),

  fileDrop: {
    border: `1.5px dashed ${c.borderLight}`, borderRadius: 10, padding: "18px 14px", textAlign: "center",
    background: c.panelSunken, color: c.textDim, fontSize: 12.5, cursor: "pointer",
  },
  select: {
    width: "100%", padding: "11px 12px", borderRadius: 9, border: `1px solid ${c.borderLight}`,
    background: c.panelSunken, color: c.text, fontSize: 13.5,
  },

  btnRow: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 },
  btn: (kind, disabled) => {
    const map = {
      primary: { bg: c.accent, bgHover: c.accentHover, fg: "#fff", border: "transparent" },
      info: { bg: c.info, bgHover: "#79b8ff", fg: "#08172b", border: "transparent" },
      ghost: { bg: "transparent", fg: c.text, border: c.borderLight },
      successFull: { bg: c.success, fg: "#04240c", border: "transparent" },
    };
    const k = map[kind];
    return {
      flex: kind === "successFull" ? "1 0 100%" : "1 1 160px",
      padding: "11px 16px", borderRadius: 9, fontSize: 13.5, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
      background: disabled ? "#2a3242" : k.bg, color: disabled ? c.textMute : k.fg,
      border: `1px solid ${disabled ? "#2a3242" : k.border}`,
      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    };
  },

  badge: (color) => ({
    fontFamily: mono, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase",
    padding: "3px 9px", borderRadius: 20, background: color + "22", color,
  }),
  dot: (color, pulse) => ({
    width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0,
    boxShadow: pulse ? `0 0 0 0 ${color}` : "none", animation: pulse ? "pulseDot 1.4s ease-out infinite" : "none",
  }),

  console: {
    background: c.panelSunken, border: `1px solid ${c.border}`, borderRadius: 8, padding: "12px 14px",
    fontFamily: mono, fontSize: 12.8, lineHeight: 1.7, color: "#c3cad6", whiteSpace: "pre-wrap",
    maxHeight: 360, overflowY: "auto",
  },

  alert: (kind) => {
    const map = { error: [c.error, c.errorSoft], warn: [c.warning, c.warningSoft], ok: [c.success, c.successSoft] };
    const [color, bg] = map[kind];
    return {
      display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color, background: bg,
      border: `1px solid ${color}33`, borderRadius: 8, padding: "10px 12px", marginBottom: 14,
    };
  },

  tagRow: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 },
  tag: (color) => ({
    fontFamily: mono, fontSize: 11, padding: "2px 8px", borderRadius: 6, background: color + "1c", color, border: `1px solid ${color}33`,
  }),

  link: { color: c.info, textDecoration: "none", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 },

  browserChrome: {
    display: "flex", gap: 6, padding: "9px 12px", background: c.panelSunken, borderBottom: `1px solid ${c.border}`,
  },
  chromeDot: (color) => ({ width: 9, height: 9, borderRadius: "50%", background: color }),

  timelineItem: (color) => ({
    borderLeft: `3px solid ${color}`, background: c.panelSunken, borderRadius: "0 8px 8px 0",
    padding: "10px 14px", marginBottom: 10,
  }),
  attemptBadge: {
    display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "50%",
    background: c.borderLight, fontFamily: mono, fontSize: 10.5, fontWeight: 700, marginRight: 8,
  },
};

function StatusDot({ color, pulse, label }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: mono, fontSize: 12, color, fontWeight: 600 }}>
      <span style={styles.dot(color, pulse)} />
      {label}
    </span>
  );
}

function buildStatusMeta(buildInfo) {
  if (!buildInfo) return { color: c.textMute, pulse: false, label: "IDLE" };
  if (buildInfo.status === "completed" && buildInfo.conclusion === "success") return { color: c.success, pulse: false, label: "SUCCESS" };
  if (buildInfo.status === "completed" && buildInfo.conclusion === "failure") return { color: c.error, pulse: false, label: "FAILED" };
  if (buildInfo.status === "queued") return { color: c.warning, pulse: true, label: "QUEUED" };
  return { color: c.accent, pulse: true, label: (buildInfo.status || "running").toUpperCase() };
}

export default function Home() {
  const { data: session } = useSession();
  const [sourceMode, setSourceMode] = useState("zip"); // "zip" | "repo"
  const [file, setFile] = useState(null);
  const [repos, setRepos] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const [buildLoading, setBuildLoading] = useState(false);
  const [buildInfo, setBuildInfo] = useState(null);
  const [buildError, setBuildError] = useState("");
  const [repoInfo, setRepoInfo] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [fixLog, setFixLog] = useState([]);
  const [buildHistory, setBuildHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [bugFixLoading, setBugFixLoading] = useState(false);
  const [bugFixResult, setBugFixResult] = useState(null);
  const [bugFixError, setBugFixError] = useState("");
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;

  useEffect(() => {
    if (session && sourceMode === "repo" && repos.length === 0) {
      fetch("/api/gh-repos").then((r) => r.json()).then((d) => {
        if (d.repos) setRepos(d.repos);
      });
    }
  }, [session, sourceMode]);

  function currentSourcePayload() {
    if (sourceMode === "repo") {
      const r = repos.find((x) => x.fullName === selectedRepo);
      if (!r) return null;
      return { type: "repo", owner: r.owner, repo: r.name, branch: r.defaultBranch };
    }
    return { type: "zip" };
  }

  const [livePreviewCode, setLivePreviewCode] = useState(null);
  const [buildScreenshot, setBuildScreenshot] = useState(null);

  function handleFileSelect(e) {
    const f = e.target.files[0];
    setFile(f);
    setLivePreviewCode(null);
    if (f && !f.name.toLowerCase().endsWith(".zip")) {
      const reader = new FileReader();
      reader.onload = () => setLivePreviewCode(reader.result);
      reader.readAsText(f);
    }
  }

  async function handleAnalyze() {
    setError(""); setLoading(true); setResult(null);
    try {
      let res;
      if (sourceMode === "repo") {
        const payload = currentSourcePayload();
        if (!payload) { setError("Pehle ek repo select karo"); setLoading(false); return; }
        res = await fetch("/api/analyze", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ owner: payload.owner, repo: payload.repo, branch: payload.branch }),
        });
      } else {
        if (!file) { setError("Pehle ek .zip file select karo"); setLoading(false); return; }
        const formData = new FormData();
        formData.append("file", file);
        res = await fetch("/api/analyze", { method: "POST", body: formData });
      }
      const data = await res.json();
      if (data.error) setError(data.error); else setResult(data);
    } catch (e) { setError("Kuch galat ho gaya: " + e.message); }
    setLoading(false);
  }

  async function handleFixBugs() {
    setBugFixError(""); setBugFixResult(null); setBugFixLoading(true);
    try {
      let res;
      if (sourceMode === "repo") {
        const payload = currentSourcePayload();
        if (!payload) { setBugFixError("Pehle ek repo select karo"); setBugFixLoading(false); return; }
        res = await fetch("/api/fix-bugs", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ owner: payload.owner, repo: payload.repo, branch: payload.branch }),
        });
      } else {
        if (!file) { setBugFixError("Pehle .zip file select karo"); setBugFixLoading(false); return; }
        const formData = new FormData();
        formData.append("file", file);
        res = await fetch("/api/fix-bugs", { method: "POST", body: formData });
      }
      const data = await res.json();
      if (data.error) { setBugFixError(data.error); setBugFixLoading(false); return; }
      setBugFixResult(data);
    } catch (e) { setBugFixError("Kuch galat ho gaya: " + e.message); }
    setBugFixLoading(false);
  }

  async function handleBuildApk() {
    setBuildError(""); setBuildInfo(null); setRepoInfo(null); setFixLog([]);
    setRetryCount(0); retryCountRef.current = 0; setBuildLoading(true);
    try {
      let res;
      if (sourceMode === "repo") {
        const payload = currentSourcePayload();
        if (!payload) { setBuildError("Pehle ek repo select karo"); setBuildLoading(false); return; }
        res = await fetch("/api/gh-build", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ owner: payload.owner, repo: payload.repo, branch: payload.branch }),
        });
      } else {
        if (!file) { setBuildError("Pehle .zip file select karo"); setBuildLoading(false); return; }
        const formData = new FormData();
        formData.append("file", file);
        res = await fetch("/api/gh-build", { method: "POST", body: formData });
      }
      const data = await res.json();
      if (data.error) { setBuildError(data.error); setBuildLoading(false); return; }
      setRepoInfo(data);
      setBuildInfo({ status: "queued" });
      setTimeout(() => pollBuildStatus(data.owner, data.repo), 20000);
    } catch (e) { setBuildError("Kuch galat ho gaya: " + e.message); setBuildLoading(false); }
  }

  function pollBuildStatus(owner, repo, branch = "main") {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/gh-build-status?owner=${owner}&repo=${repo}&branch=${branch}`);
        const data = await res.json();
        if (data.error) return;
        setBuildInfo(data);
        if (data.status === "completed" && data.conclusion === "success") { clearInterval(interval); setBuildLoading(false); }
        if (data.status === "completed" && data.conclusion === "failure") { clearInterval(interval); handleBuildFailure(owner, repo, data); }
      } catch {}
    }, 15000);
  }

  async function handleBuildFailure(owner, repo, data) {
    const currentRetry = retryCountRef.current;
    const validFiles = data.aiFixFiles || [];
    const rejected = data.aiRejectedFiles || [];
    setFixLog((prev) => [...prev, { attempt: currentRetry + 1, explanation: data.aiExplanation || "", appliedFiles: validFiles.map((f) => f.path), rejectedFiles: rejected, councilSteps: data.councilSteps || [] }]);
    if (currentRetry >= MAX_RETRIES) {
      setBuildError(`Build ${MAX_RETRIES} baar fail hua, AI se auto-fix ki max koshish khatam ho gayi. Neeche "Auto-Fix History" me dekho AI ne kya try kiya, aur "Live logs" me asli GitHub Actions error dekho — manually fix karna padega.`);
      setBuildLoading(false);
      return;
    }
    if (validFiles.length === 0) {
      setBuildError("Build fail hua, aur AI ko koi bharosemand fix nahi mila (ya jo mila woh syntax check me reject ho gaya) — isliye koi naya commit nahi hua. Neeche \"Auto-Fix History\" me AI ka explanation aur \"Live logs\" me asli error dekho.");
      setBuildLoading(false);
      return;
    }
    try {
      const prRes = await fetch("/api/gh-apply-fix", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ owner, repo, files: validFiles, attemptNumber: currentRetry + 1 }) });
      const prData = await prRes.json();
      if (prData.error) {
        setBuildError("AI ne fix socha, lekin commit push karte waqt error aaya: " + prData.error);
        setBuildLoading(false);
        return;
      }
      retryCountRef.current = currentRetry + 1;
      setRetryCount(currentRetry + 1);
      if (prData.branch) {
        setTimeout(() => pollBuildStatus(owner, repo, prData.branch), 20000);
      } else {
        setBuildError("AI ne fix socha lekin commit branch info nahi mili — dobara try karo.");
        setBuildLoading(false);
      }
    } catch (e) {
      setBuildError("Fix apply karte waqt error: " + e.message);
      setBuildLoading(false);
    }
  }

  async function toggleHistory() {
    if (buildHistory !== null) { setBuildHistory(null); return; } // toggle band karo
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/build-history");
      const data = await res.json();
      setBuildHistory(data.builds || []);
    } catch {
      setBuildHistory([]);
    }
    setHistoryLoading(false);
  }

  function downloadUrl() {
    if (!repoInfo || !buildInfo?.artifactId) return "#";
    return `/api/gh-download?owner=${repoInfo.owner}&repo=${repoInfo.repo}&artifactId=${buildInfo.artifactId}`;
  }

  const bs = buildStatusMeta(buildInfo);

  return (
    <div style={styles.page}>
      <style jsx global>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: ${c.bg}; }
        ::selection { background: ${c.accentSoft}; }
        input[type="file"]::file-selector-button {
          background: ${c.borderLight}; color: ${c.text}; border: none; border-radius: 6px;
          padding: 6px 10px; font-size: 12px; margin-right: 10px; cursor: pointer;
        }
        select { outline: none; }
        button:focus-visible, select:focus-visible, input:focus-visible { outline: 2px solid ${c.accent}; outline-offset: 1px; }
        @keyframes pulseDot {
          0%   { box-shadow: 0 0 0 0 currentColor44; }
          70%  { box-shadow: 0 0 0 6px transparent; }
          100% { box-shadow: 0 0 0 0 transparent; }
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; }
        }
      `}</style>

      <div style={styles.topbar}>
        <div style={styles.brandRow}>
          <div style={styles.brandMark}>🤖</div>
          <div>
            <div style={styles.brandTitle}>AI App Builder</div>
            <div style={styles.brandSub}>Android · self-fixing builds</div>
          </div>
        </div>
        {session && (
          <div style={styles.userRow}>
            {session.user.image && <img src={session.user.image} alt="" style={styles.avatar} />}
            <span style={{ fontSize: 12.5, color: c.textDim }}>{session.user.name || session.user.email}</span>
            <button onClick={() => signOut()} style={styles.logoutBtn} title="Logout">⏻</button>
          </div>
        )}
      </div>

      <main style={styles.main}>
        {!session ? (
          <div style={styles.hero}>
            <h1 style={styles.heroTitle}>Upload a project.<br />Let <span style={styles.heroAccent}>AI ship the APK</span>.</h1>
            <p style={styles.heroSub}>Zip file ya GitHub repo se, auto project-detect, self-fixing GitHub Actions builds, aur har build se seekhta hua system.</p>
            <button onClick={() => signIn("github")} style={styles.ghBtn}>
              <span style={{ fontSize: 17 }}>🐙</span> Continue with GitHub
            </button>
            <div style={styles.featRow}>
              <span style={styles.featPill}><span style={styles.dot(c.info)} /> Auto-detects project type</span>
              <span style={styles.featPill}><span style={styles.dot(c.accent)} /> Self-fixing builds</span>
              <span style={styles.featPill}><span style={styles.dot(c.success)} /> Learns from every build</span>
            </div>
          </div>
        ) : (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
            <div style={{ ...styles.greetRow, justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <StatusDot color={c.success} pulse={false} label="ONLINE" />
                <span>·</span>
                <span>signed in as {session.user.name || session.user.email}</span>
              </div>
              <button onClick={toggleHistory} style={{ ...styles.btn("ghost", false), flex: "0 0 auto", padding: "6px 12px", fontSize: 12 }}>
                🕘 {historyLoading ? "Loading…" : buildHistory !== null ? "Hide History" : "Build History"}
              </button>
            </div>

            {buildHistory !== null && (
              <div style={styles.panel}>
                <div style={styles.panelHead}>
                  <div style={styles.panelHeadLeft}>🕘 Build History</div>
                  <span style={styles.badge(c.info)}>{buildHistory.length}</span>
                </div>
                <div style={styles.panelBody}>
                  {buildHistory.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 13, color: c.textMute }}>Abhi tak koi build nahi hui.</p>
                  ) : (
                    buildHistory.map((b) => (
                      <div key={b.id} style={styles.timelineItem(c.info)}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                          <a href={`https://github.com/${b.owner}/${b.repo_name}`} target="_blank" rel="noreferrer" style={styles.link}>
                            🔗 {b.owner}/{b.repo_name}
                          </a>
                          <span style={styles.badge(c.warning)}>{b.project_type}</span>
                        </div>
                        <div style={{ fontSize: 11.5, color: c.textMute, fontFamily: mono, marginTop: 6 }}>
                          {b.source_name} · {new Date(b.created_at).toLocaleString("en-IN")}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Source panel */}
            <div style={styles.panel}>
              <div style={styles.tabStrip}>
                <div style={styles.tab(sourceMode === "zip")} onClick={() => setSourceMode("zip")}>📁 Upload Zip</div>
                <div style={styles.tab(sourceMode === "repo")} onClick={() => setSourceMode("repo")}>🐙 GitHub Repo</div>
              </div>
              <div style={styles.panelBody}>
                {sourceMode === "zip" ? (
                  <label style={styles.fileDrop}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>📦</div>
                    {file ? file.name : "Zip / single file chuno"}
                    <input type="file" accept=".zip,.jsx,.tsx,.js" onChange={handleFileSelect} style={{ display: "none" }} />
                  </label>
                ) : (
                  <select style={styles.select} value={selectedRepo} onChange={(e) => setSelectedRepo(e.target.value)}>
                    <option value="">-- Repo select karo --</option>
                    {repos.map((r) => (
                      <option key={r.fullName} value={r.fullName}>{r.fullName}{r.private ? " (private)" : ""}</option>
                    ))}
                  </select>
                )}

                <div style={styles.btnRow}>
                  <button onClick={handleAnalyze} disabled={loading} style={styles.btn("ghost", loading)}>
                    {loading ? <><StatusDot color={c.accent} pulse label="" /> Analyzing…</> : <>🔍 Analyze</>}
                  </button>
                  <button onClick={handleBuildApk} disabled={buildLoading} style={styles.btn("primary", buildLoading)}>
                    {buildLoading ? <><StatusDot color="#fff" pulse label="" /> Building…</> : <>▶ Build APK</>}
                  </button>
                </div>
              </div>
            </div>

            {livePreviewCode && (
              <div style={styles.panel}>
                <div style={styles.browserChrome}>
                  <span style={styles.chromeDot(c.error)} /><span style={styles.chromeDot(c.warning)} /><span style={styles.chromeDot(c.success)} />
                  <span style={{ marginLeft: 8, fontSize: 11.5, color: c.textMute, fontFamily: mono }}>Preview</span>
                </div>
                <div style={styles.panelBody}>
                  <LivePreviewFrame code={livePreviewCode} />
                </div>
              </div>
            )}

            {error && <div style={styles.alert("error")}>⚠️ <span>{error}</span></div>}

            {result && (
              <div style={styles.panel}>
                <div style={styles.panelHead}>
                  <div style={styles.panelHeadLeft}>📋 Analysis</div>
                  <span style={styles.badge(c.info)}>{result.fileCount} files</span>
                </div>
                <div style={styles.panelBody}>
                  <div style={styles.console}>{result.analysis}</div>
                  <div style={styles.btnRow}>
                    <button onClick={handleFixBugs} disabled={bugFixLoading} style={styles.btn("info", bugFixLoading)}>
                      {bugFixLoading ? <><StatusDot color="#08172b" pulse label="" /> Fixing bugs…</> : <>🔧 Fix Bugs (AI)</>}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {bugFixError && <div style={styles.alert("error")}>⚠️ <span>{bugFixError}</span></div>}

            {bugFixResult && (
              <div style={styles.panel}>
                <div style={styles.panelHead}><div style={styles.panelHeadLeft}>🔧 Bug-Fix Result</div></div>
                <div style={styles.panelBody}>
                  <p style={{ margin: 0, fontSize: 13.5, color: c.textDim, lineHeight: 1.6 }}>{bugFixResult.summary}</p>
                  <div style={styles.tagRow}>
                    {bugFixResult.fixedFiles?.map((f) => <span key={f} style={styles.tag(c.success)}>✓ {f}</span>)}
                    {bugFixResult.rejectedFiles?.map((f) => <span key={f} style={styles.tag(c.warning)}>⚠ {f}</span>)}
                  </div>
                  {bugFixResult.owner && (
                    <div style={{ marginTop: 12 }}>
                      <a href={`https://github.com/${bugFixResult.owner}/${bugFixResult.repo}`} target="_blank" rel="noreferrer" style={styles.link}>
                        📂 {bugFixResult.owner}/{bugFixResult.repo}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {buildError && <div style={styles.alert("error")}>⚠️ <span>{buildError}</span></div>}

            {repoInfo && (
              <div style={styles.panel}>
                <div style={styles.panelHead}>
                  <div style={styles.panelHeadLeft}>📱 Build</div>
                  <span style={styles.badge(c.info)}>{repoInfo.type}</span>
                </div>
                <div style={styles.panelBody}>
                  <a href={`https://github.com/${repoInfo.owner}/${repoInfo.repo}`} target="_blank" rel="noreferrer" style={styles.link}>
                    🔗 {repoInfo.owner}/{repoInfo.repo}
                  </a>
                  {buildInfo && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <StatusDot color={bs.color} pulse={bs.pulse} label={bs.label} />
                        {retryCount > 0 && <span style={styles.badge(c.warning)}>Attempt {retryCount}/{MAX_RETRIES}</span>}
                      </div>
                      {buildInfo.runUrl && (
                        <div style={{ marginTop: 10 }}>
                          <a href={buildInfo.runUrl} target="_blank" rel="noreferrer" style={styles.link}>🔗 Live logs (GitHub Actions)</a>
                        </div>
                      )}
                      {buildInfo.status === "completed" && buildInfo.conclusion === "success" && buildInfo.artifactId && (
                        <a href={downloadUrl()} style={{ ...styles.btn("successFull", false), marginTop: 14, textDecoration: "none" }}>
                          ⬇ Download APK
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {fixLog.length > 0 && (
              <div style={styles.panel}>
                <div style={styles.panelHead}><div style={styles.panelHeadLeft}>🧠 Auto-Fix History</div></div>
                <div style={styles.panelBody}>
                  {fixLog.map((log, i) => {
                    const ok = log.appliedFiles.length > 0;
                    const color = ok ? c.success : c.error;
                    return (
                      <div key={i} style={styles.timelineItem(color)}>
                        <div style={{ fontSize: 13, color: c.text }}>
                          <span style={styles.attemptBadge}>{log.attempt}</span>
                          {log.explanation || "—"}
                        </div>
                        <div style={styles.tagRow}>
                          {log.appliedFiles.map((f) => <span key={f} style={styles.tag(c.success)}>✓ {f}</span>)}
                          {log.rejectedFiles.map((f) => <span key={f} style={styles.tag(c.warning)}>⚠ {f}</span>)}
                          {log.appliedFiles.length === 0 && <span style={styles.tag(c.error)}>✗ no valid fix</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
