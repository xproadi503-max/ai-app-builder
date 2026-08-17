"use client";
import { useEffect, useRef, useState } from "react";

function preprocessCode(rawCode) {
  let code = rawCode;

  // Lucide-react se jo icons import ho rahe hain unke naam nikalo (alias "as" bhi handle karo)
  let lucideNames = [];
  const lucideMatch = code.match(/import\s*\{([\s\S]*?)\}\s*from\s*["']lucide-react["']/);
  if (lucideMatch) {
    lucideNames = lucideMatch[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const asMatch = s.match(/(\w+)\s+as\s+(\w+)/);
        return asMatch ? asMatch[2] : s; // "Image as ImageIcon" -> "ImageIcon"
      });
  }

  // Saari import statements poori tarah hata do (multi-line bhi, semicolon tak)
  code = code.replace(/import\s+[\s\S]*?;/g, "");

  // "export default function Name" -> "function Name", naam yaad rakho
  let componentName = "App";
  const fnMatch = code.match(/export\s+default\s+function\s+(\w+)/);
  const classMatch = code.match(/export\s+default\s+class\s+(\w+)/);
  const identMatch = code.match(/export\s+default\s+(\w+)\s*;?\s*$/m);

  if (fnMatch) componentName = fnMatch[1];
  else if (classMatch) componentName = classMatch[1];
  else if (identMatch) componentName = identMatch[1];

  code = code.replace(/export\s+default\s+/g, "");

  const lucideStub = lucideNames.length
    ? `const { ${lucideNames.join(", ")} } = new Proxy({}, { get: (_, name) => (props) => React.createElement('span', { style: { fontSize: 11, opacity: 0.6, border: "1px solid #ccc", borderRadius: 4, padding: "1px 4px" } }, '[' + String(name) + ']') });`
    : "";

  return { code, componentName, lucideStub };
}

export default function LivePreviewFrame({ code: rawCode }) {
  const iframeRef = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!rawCode || !iframeRef.current) return;

    function tryRender() {
      if (!window.Babel) {
        setTimeout(tryRender, 200);
        return;
      }
      try {
        const { code, componentName, lucideStub } = preprocessCode(rawCode);
        const compiled = window.Babel.transform(code, { presets: ["react"] }).code;

        const html = `<!DOCTYPE html>
<html>
<head>
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>body { margin: 0; font-family: sans-serif; }</style>
</head>
<body>
  <div id="root"></div>
  <script>
    window.React = React;
    const { useState, useEffect, useRef, useCallback, useMemo, useReducer, useContext } = React;
    ${lucideStub}
    try {
      ${compiled}
      ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(${componentName}));
    } catch (e) {
      document.getElementById('root').innerHTML = '<pre style="padding:20px;color:#dc2626;white-space:pre-wrap;font-size:13px;">Preview Error: ' + e.message + '</pre>';
    }
  </script>
</body>
</html>`;

        iframeRef.current.srcdoc = html;
        setError("");
      } catch (e) {
        setError(e.message);
      }
    }

    tryRender();
  }, [rawCode]);

  return (
    <div>
      {error && <p style={{ color: "#f87171", fontSize: 13 }}>⚠️ Preview compile error: {error}</p>}
      <iframe
        ref={iframeRef}
        title="Live Preview"
        style={{ width: "100%", height: 450, border: "1px solid #334155", borderRadius: 10, background: "#fff" }}
        sandbox="allow-scripts"
      />
    </div>
  );
}
