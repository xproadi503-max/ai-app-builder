"use client";
import { useSession, signIn, signOut } from "next-auth/react";
import { useState } from "react";

export default function Home() {
  const { data: session } = useSession();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function handleAnalyze() {
    if (!file) {
      setError("Pehle ek .zip file select karo");
      return;
    }
    setError("");
    setLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/analyze", { method: "POST", body: formData });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setResult(data);
    } catch (e) {
      setError("Kuch galat ho gaya: " + e.message);
    }
    setLoading(false);
  }

  return (
    <main style={{ maxWidth: 700, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 24 }}>🤖 AI App Builder</h1>

      {!session ? (
        <button
          onClick={() => signIn("github")}
          style={{ padding: "12px 20px", background: "#24292e", color: "#fff", border: "none", borderRadius: 8, fontSize: 16 }}
        >
          🐙 Login with GitHub
        </button>
      ) : (
        <div>
          <p>✅ Logged in as <b>{session.user.name || session.user.email}</b></p>
          <button onClick={() => signOut()} style={{ padding: "8px 14px", marginBottom: 20 }}>Logout</button>

          <div style={{ background: "#1e293b", padding: 16, borderRadius: 12, marginTop: 16 }}>
            <p>📦 Apna project ka <b>.zip</b> upload karo, AI usko analyze karega:</p>
            <input
              type="file"
              accept=".zip"
              onChange={(e) => setFile(e.target.files[0])}
              style={{ margin: "12px 0" }}
            />
            <br />
            <button
              onClick={handleAnalyze}
              disabled={loading}
              style={{ padding: "10px 18px", background: "#22c55e", border: "none", borderRadius: 8, fontSize: 15 }}
            >
              {loading ? "⏳ Analyze ho raha hai..." : "🔍 Analyze Karo"}
            </button>
          </div>

          {error && <p style={{ color: "#f87171", marginTop: 16 }}>⚠️ {error}</p>}

          {result && (
            <div style={{ background: "#1e293b", padding: 16, borderRadius: 12, marginTop: 16 }}>
              <h3>📋 AI ka Analysis ({result.fileCount} files mile)</h3>
              <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.6 }}>{result.analysis}</pre>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
