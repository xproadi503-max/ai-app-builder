"use client";
import { useEffect, useRef, useState } from "react";

export default function LivePreviewFrame({ code }) {
  const iframeRef = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!code || !iframeRef.current) return;

    try {
      // JSX ko Babel se browser mein hi compile karte hain
      // @ts-ignore
      const compiled = window.Babel.transform(code, { presets: ["react"] }).code;

      const html = `<!DOCTYPE html>
<html>
<head>
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <style>body { margin: 0; font-family: sans-serif; }</style>
</head>
<body>
  <div id="root"></div>
  <script>
    window.React = React;
    try {
      ${compiled}
      const componentName = Object.keys(window).find(k => k.startsWith('_')) || null;
      const Comp = (typeof App !== 'undefined') ? App : (typeof exports !== 'undefined' && exports.default) ? exports.default : null;
      if (Comp) {
        ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Comp));
      } else {
        document.getElementById('root').innerHTML = '<p style="padding:20px;color:#888">Preview render nahi ho paya - component export sahi se nahi mila. Actual build me theek chalega.</p>';
      }
    } catch (e) {
      document.getElementById('root').innerHTML = '<pre style="padding:20px;color:#f87171;white-space:pre-wrap;">' + e.message + '</pre>';
    }
  </script>
</body>
</html>`;

      iframeRef.current.srcdoc = html;
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, [code]);

  return (
    <div>
      {error && <p style={{ color: "#f87171", fontSize: 13 }}>⚠️ Preview error: {error}</p>}
      <iframe
        ref={iframeRef}
        title="Live Preview"
        style={{ width: "100%", height: 400, border: "1px solid #334155", borderRadius: 10, background: "#fff" }}
        sandbox="allow-scripts"
      />
    </div>
  );
}
