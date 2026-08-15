"use client";
import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useRef } from "react";

export default function Home() {
  const { data: session } = useSession();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const [buildLoading, setBuildLoading] = useState(false);
  const [buildInfo, setBuildInfo] = useState(null);
  const [buildError, setBuildError] = useState("");
  const [repoInfo, setRepoInfo] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [fixLog, setFixLog] = useState([]);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;

  async function handleAnalyze() {
    if (!file) { setError("Pehle ek .zip file select karo"); return; }
    setError(""); setLoading(true); setResult(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/analyze", { method: "POST", body: formData });
      const data = await res.json();
      if (data.error) setError(data.error); else setResult(data);
    } catch (e) { setError("Kuch galat ho gaya: " + e.message); }
    setLoading(false);
  }

  async function handleBuildApk() {
    if (!file) { setBuildError("Pehle .zip file select karo"); return; }
    setBuildError(""); setBuildInfo(null); setRepoInfo(null); setFixLog([]);
    setRetryCount(0); retryCountRef.current = 0; setBuildLoading(true);

    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/gh-build", { method: "POST", body: formData });
      const data = await res.json();
      if (data.error) { setBuildError(data.error); setBuildLoading(false); return; }
      setRepoInfo(data);
      setBuildInfo({ status: "queued" });
      setTimeout(() => pollBuildStatus(data.owner, data.repo), 20000); // pehli baar 20s wait (Action start hone ka time)
    } catch (e) { setBuildError("Kuch galat ho gaya: " + e.message); setBuildLoading(false); }
  }

  function pollBuildStatus(owner, repo) {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/gh-build-status?owner=${owner}&repo=${repo}`);
        const data = await res.json();
        if (data.error) return;
        setBuildInfo(data);

        if (data.status === "completed" && data.conclusion === "success") {
          clearInterval(interval); setBuildLoading(false);
        }
        if (data.status === "completed" && data.conclusion === "failure") {
          clearInterval(interval);
          handleBuildFailure(owner, repo, data);
        }
      } catch {}
    }, 15000);
  }

  async function handleBuildFailure(owner, repo, data) {
    const currentRetry = retryCountRef.current;
    const validFiles = data.aiFixFiles || [];
    const rejected = data.aiRejectedFiles || [];

    setFixLog((prev) => [...prev, {
      attempt: currentRetry + 1,
      explanation: data.aiExplanation || "",
      appliedFiles: validFiles.map((f) => f.path),
      rejectedFiles: rejected,
    }]);

    if (currentRetry >= MAX_RETRIES || validFiles.length === 0) {
      setBuildLoading(false);
      return;
    }

    try {
      await fetch("/api/gh-apply-fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo, files: validFiles }),
      });
      retryCountRef.current = currentRetry + 1;
      setRetryCount(currentRetry + 1);
      setTimeout(() => pollBuildStatus(owner, repo), 20000);
    } catch {
      setBuildLoading(false);
    }
  }

  function downloadUrl() {
    if (!repoInfo || !buildInfo?.artifactId) return "#";
    return `/api/gh-download?owner=${repoInfo.owner}&repo=${repoInfo.repo}&artifactId=${buildInfo.artifactId}`;
  }

  return (
    <main style={{ maxWidth: 700, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 24 }}>🤖 AI App Builder</h1>
      {!session ? (
        <button onClick={() => signIn("github")} style={{ padding: "12px 20px", background: "#24292e", color: "#fff", border: "none", borderRadius: 8, fontSize: 16 }}>
          🐙 Login with GitHub
        </button>
      ) : (
        <div>
          <p>✅ Logged in as <b>{session.user.name || session.user.email}</b></p>
          <button onClick={() => signOut()} style={{ padding: "8px 14px", marginBottom: 20 }}>Logout</button>

          <div style={{ background: "#1e293b", padding: 16, borderRadius: 12, marginTop: 16 }}>
            <p>📦 Apna project ka <b>.zip</b> upload karo (Flutter / React Native / Expo / Native Android):</p>
            <input type="file" accept=".zip" onChange={(e) => setFile(e.target.files[0])} style={{ margin: "12px 0" }} />
            <br />
            <button onClick={handleAnalyze} disabled={loading} style={{ padding: "10px 18px", background: "#22c55e", border: "none", borderRadius: 8, fontSize: 15, marginRight: 10 }}>
              {loading ? "⏳ Analyze ho raha hai..." : "🔍 Analyze Karo"}
            </button>
            <button onClick={handleBuildApk} disabled={buildLoading} style={{ padding: "10px 18px", background: "#3b82f6", border: "none", borderRadius: 8, fontSize: 15, color: "#fff" }}>
              {buildLoading ? "⏳ Build ho raha hai..." : "📱 Build APK (GitHub Actions)"}
            </button>
          </div>

          {error && <p style={{ color: "#f87171", marginTop: 16 }}>⚠️ {error}</p>}
          {result && (
            <div style={{ background: "#1e293b", padding: 16, borderRadius: 12, marginTop: 16 }}>
              <h3>📋 AI ka Analysis ({result.fileCount} files mile)</h3>
              <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.6 }}>{result.analysis}</pre>
            </div>
          )}

          {buildError && <p style={{ color: "#f87171", marginTop: 16 }}>⚠️ {buildError}</p>}

          {repoInfo && (
            <div style={{ background: "#1e293b", padding: 16, borderRadius: 12, marginTop: 16 }}>
              <h3>📱 Build Status</h3>
              <p>Type detect hua: <b>{repoInfo.type}</b></p>
              <p>Repo: <a href={`https://github.com/${repoInfo.owner}/${repoInfo.repo}`} target="_blank" rel="noreferrer" style={{ color: "#60a5fa" }}>{repoInfo.owner}/{repoInfo.repo}</a></p>
              {buildInfo && (
                <>
                  <p>Status: <b>{buildInfo.status}</b> {buildInfo.conclusion && `(${buildInfo.conclusion})`} {retryCount > 0 && `— Try ${retryCount}/${MAX_RETRIES}`}</p>
                  {buildInfo.runUrl && <p><a href={buildInfo.runUrl} target="_blank" rel="noreferrer" style={{ color: "#60a5fa" }}>🔗 Live logs dekho GitHub pe</a></p>}
                  {buildInfo.status === "completed" && buildInfo.conclusion === "success" && buildInfo.artifactId && (
                    <p><a href={downloadUrl()} style={{ color: "#4ade80", fontWeight: "bold" }}>✅ APK Download Karo (zip me hoga)</a></p>
                  )}
                </>
              )}
            </div>
          )}

          {fixLog.length > 0 && (
            <div style={{ background: "#1e293b", padding: 16, borderRadius: 12, marginTop: 16 }}>
              <h4>🔧 Auto-Fix History</h4>
              {fixLog.map((log, i) => (
                <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid #334155" }}>
                  <p><b>Try {log.attempt}:</b> {log.explanation}</p>
                  {log.appliedFiles.length > 0 && <p style={{ color: "#4ade80" }}>✅ Fix apply hui: {log.appliedFiles.join(", ")}</p>}
                  {log.rejectedFiles.length > 0 && <p style={{ color: "#fbbf24" }}>⚠️ AI ka code invalid tha, ignore kiya: {log.rejectedFiles.join(", ")}</p>}
                  {log.appliedFiles.length === 0 && <p style={{ color: "#f87171" }}>❌ AI koi valid fix nahi de paya.</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
