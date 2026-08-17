"use client";
import LivePreviewFrame from "./LivePreviewFrame";
import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";

const styles = {
  main: { maxWidth: 720, margin: "0 auto", padding: "32px 20px", fontFamily: "system-ui, sans-serif" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 },
  title: { fontSize: 26, fontWeight: 700, display: "flex", alignItems: "center", gap: 10 },
  card: { background: "#1e293b", padding: 20, borderRadius: 14, marginTop: 18, boxShadow: "0 2px 8px rgba(0,0,0,0.2)" },
  sectionTitle: { fontSize: 16, fontWeight: 600, marginBottom: 12, color: "#e2e8f0" },
  tabRow: { display: "flex", gap: 8, marginBottom: 16 },
  tabBtn: (active) => ({
    flex: 1, padding: "10px 14px", borderRadius: 10, border: "none", cursor: "pointer",
    background: active ? "#3b82f6" : "#334155", color: "#fff", fontSize: 14, fontWeight: 600,
  }),
  primaryBtn: (disabled) => ({
    padding: "12px 20px", background: disabled ? "#475569" : "#22c55e", border: "none", borderRadius: 10,
    fontSize: 15, fontWeight: 600, color: "#fff", cursor: disabled ? "not-allowed" : "pointer", width: "100%", marginTop: 8,
  }),
  blueBtn: (disabled) => ({
    padding: "12px 20px", background: disabled ? "#475569" : "#3b82f6", border: "none", borderRadius: 10,
    fontSize: 15, fontWeight: 600, color: "#fff", cursor: disabled ? "not-allowed" : "pointer", width: "100%", marginTop: 12,
  }),
  select: { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #334155", background: "#0f172a", color: "#fff", fontSize: 14, marginBottom: 4 },
  fileInput: { width: "100%", padding: "10px", borderRadius: 10, border: "1px dashed #475569", background: "#0f172a", color: "#94a3b8", fontSize: 13, marginBottom: 4 },
  badge: (color) => ({ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: color + "22", color }),
  divider: { border: "none", borderTop: "1px solid #334155", margin: "22px 0" },
  pre: { whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.7, fontSize: 14.5, color: "#cbd5e1" },
  logoutBtn: { padding: "8px 16px", background: "#334155", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, cursor: "pointer" },
  loginBtn: { padding: "14px 24px", background: "#24292e", color: "#fff", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 },
};

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
    if (currentRetry >= MAX_RETRIES || validFiles.length === 0) { setBuildLoading(false); return; }
    try {
      const prRes = await fetch("/api/gh-apply-fix", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ owner, repo, files: validFiles, attemptNumber: currentRetry + 1 }) });
      const prData = await prRes.json();
      retryCountRef.current = currentRetry + 1;
      setRetryCount(currentRetry + 1);
      if (prData.branch) {
        setTimeout(() => pollBuildStatus(owner, repo, prData.branch), 20000);
      } else {
        setBuildLoading(false);
      }
    } catch { setBuildLoading(false); }
  }

  function downloadUrl() {
    if (!repoInfo || !buildInfo?.artifactId) return "#";
    return `/api/gh-download?owner=${repoInfo.owner}&repo=${repoInfo.repo}&artifactId=${buildInfo.artifactId}`;
  }

  return (
    <main style={styles.main}>
      <div style={styles.header}>
        <div style={styles.title}>🤖 AI App Builder</div>
        {session && <button onClick={() => signOut()} style={styles.logoutBtn}>Logout</button>}
      </div>

      {!session ? (
        <button onClick={() => signIn("github")} style={styles.loginBtn}>🐙 Login with GitHub</button>
      ) : (
        <div>
          <p style={{ color: "#94a3b8", marginBottom: 0 }}>✅ Logged in as <b style={{ color: "#fff" }}>{session.user.name || session.user.email}</b></p>

          <div style={styles.card}>
            <div style={styles.sectionTitle}>📦 Project Source</div>
            <div style={styles.tabRow}>
              <button style={styles.tabBtn(sourceMode === "zip")} onClick={() => setSourceMode("zip")}>📁 Upload Zip</button>
              <button style={styles.tabBtn(sourceMode === "repo")} onClick={() => setSourceMode("repo")}>🐙 GitHub Repo</button>
            </div>

            {sourceMode === "zip" ? (
              <input type="file" accept=".zip,.jsx,.tsx,.js" onChange={handleFileSelect} style={styles.fileInput} />
            ) : (
              <select style={styles.select} value={selectedRepo} onChange={(e) => setSelectedRepo(e.target.value)}>
                <option value="">-- Repo select karo --</option>
                {repos.map((r) => (
                  <option key={r.fullName} value={r.fullName}>{r.fullName}{r.private ? " (private)" : ""}</option>
                ))}
              </select>
            )}

            <button onClick={handleAnalyze} disabled={loading} style={styles.primaryBtn(loading)}>
              {loading ? "⏳ Analyze ho raha hai..." : "🔍 Analyze Karo"}
            </button>
            <button onClick={handleBuildApk} disabled={buildLoading} style={styles.blueBtn(buildLoading)}>
              {buildLoading ? "⏳ Build ho raha hai..." : "📱 Build APK (GitHub Actions)"}
            </button>
          </div>

          {livePreviewCode && (
            <div style={styles.card}>
              <div style={styles.sectionTitle}>👁️ Live Preview</div>
              <LivePreviewFrame code={livePreviewCode} />
            </div>
          )}
          {error && <p style={{ color: "#f87171", marginTop: 14 }}>⚠️ {error}</p>}

          {result && (
            <div style={styles.card}>
              <div style={styles.sectionTitle}>📋 AI ka Analysis <span style={styles.badge("#60a5fa")}>{result.fileCount} files</span></div>
              <pre style={styles.pre}>{result.analysis}</pre>
            </div>
          )}

          {result && (
            <button onClick={handleFixBugs} disabled={bugFixLoading} style={styles.blueBtn(bugFixLoading)}>
              {bugFixLoading ? "⏳ Bugs Fix ho rahe hain..." : "🔧 Bugs Fix Karo (AI se)"}
            </button>
          )}
          {bugFixError && <p style={{ color: "#f87171", marginTop: 14 }}>⚠️ {bugFixError}</p>}
          {bugFixResult && (
            <div style={styles.card}>
              <div style={styles.sectionTitle}>🔧 Bug-Fix Result</div>
              <p style={{ color: "#cbd5e1" }}>{bugFixResult.summary}</p>
              {bugFixResult.fixedFiles?.length > 0 && <p style={{ color: "#4ade80", fontSize: 14 }}>✅ Fix hui files: {bugFixResult.fixedFiles.join(", ")}</p>}
              {bugFixResult.rejectedFiles?.length > 0 && <p style={{ color: "#fbbf24", fontSize: 14 }}>⚠️ Invalid fix, ignore ki: {bugFixResult.rejectedFiles.join(", ")}</p>}
              {bugFixResult.owner && (
                <p style={{ marginTop: 8 }}><a href={`https://github.com/${bugFixResult.owner}/${bugFixResult.repo}`} target="_blank" rel="noreferrer" style={{ color: "#60a5fa" }}>📂 Fixed code yaha dekho: {bugFixResult.owner}/{bugFixResult.repo}</a></p>
              )}
            </div>
          )}
          {buildError && <p style={{ color: "#f87171", marginTop: 14 }}>⚠️ {buildError}</p>}

          {repoInfo && (
            <div style={styles.card}>
              <div style={styles.sectionTitle}>📱 Build Status</div>
              <p style={{ color: "#cbd5e1" }}>Type: <span style={styles.badge("#4ade80")}>{repoInfo.type}</span></p>
              <p style={{ color: "#cbd5e1" }}>Repo: <a href={`https://github.com/${repoInfo.owner}/${repoInfo.repo}`} target="_blank" rel="noreferrer" style={{ color: "#60a5fa" }}>{repoInfo.owner}/{repoInfo.repo}</a></p>
              {buildInfo && (
                <>
                  <p style={{ color: "#cbd5e1" }}>Status: <b>{buildInfo.status}</b> {buildInfo.conclusion && `(${buildInfo.conclusion})`} {retryCount > 0 && `— Try ${retryCount}/${MAX_RETRIES}`}</p>
                  {buildInfo.runUrl && <p><a href={buildInfo.runUrl} target="_blank" rel="noreferrer" style={{ color: "#60a5fa" }}>🔗 Live logs dekho GitHub pe</a></p>}
                  {buildInfo.status === "completed" && buildInfo.conclusion === "success" && buildInfo.artifactId && (
                    <p><a href={downloadUrl()} style={{ color: "#4ade80", fontWeight: 700 }}>✅ APK Download Karo</a></p>
                  )}
                </>
              )}
            </div>
          )}

          {fixLog.length > 0 && (
            <div style={styles.card}>
              <div style={styles.sectionTitle}>🔧 Auto-Fix History</div>
              {fixLog.map((log, i) => (
                <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: i < fixLog.length - 1 ? "1px solid #334155" : "none" }}>
                  <p style={{ color: "#e2e8f0" }}><b>Try {log.attempt}:</b> {log.explanation}</p>
                  {log.appliedFiles.length > 0 && <p style={{ color: "#4ade80", fontSize: 14 }}>✅ Fix apply hui: {log.appliedFiles.join(", ")}</p>}
                  {log.rejectedFiles.length > 0 && <p style={{ color: "#fbbf24", fontSize: 14 }}>⚠️ AI ka code invalid tha: {log.rejectedFiles.join(", ")}</p>}
                  {log.appliedFiles.length === 0 && <p style={{ color: "#f87171", fontSize: 14 }}>❌ AI koi valid fix nahi de paya.</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
