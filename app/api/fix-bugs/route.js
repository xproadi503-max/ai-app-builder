import AdmZip from "adm-zip";
import fs from "fs";
import path from "path";
import os from "os";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions";
import { askAI } from "../../../lib/ai";
import * as acorn from "acorn";
import jsx from "acorn-jsx";

const JSXParser = acorn.Parser.extend(jsx());
const SKIP_DIRS = ["node_modules", ".git", "build", ".next", "dist"];

function validateSyntax(content) {
  try { JSXParser.parse(content, { ecmaVersion: "latest", sourceType: "module" }); return true; }
  catch { return false; }
}

function extractJson(text) {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  try { return JSON.parse(cleaned); } catch {}
  const s = cleaned.indexOf("{"), e = cleaned.lastIndexOf("}");
  if (s !== -1 && e !== -1) { try { return JSON.parse(cleaned.slice(s, e + 1)); } catch {} }
  return null;
}

function walkFiles(dir, base = "") {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const relPath = path.join(base, entry.name).replace(/\\/g, "/");
    if (SKIP_DIRS.some((d) => relPath.startsWith(d + "/") || relPath === d)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results = results.concat(walkFiles(full, relPath));
    else results.push(relPath);
  }
  return results;
}

async function pushFile(owner, repo, token, filePath, content) {
  const contentBase64 = Buffer.from(content).toString("base64");
  let sha;
  const getRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (getRes.ok) sha = (await getRes.json()).sha;
  return fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: sha ? `Fix ${filePath}` : `Add ${filePath}`, content: contentBase64, sha }),
  });
}

export async function POST(request) {
  const workDir = path.join(os.tmpdir(), "fixbugs-" + Date.now());
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) return Response.json({ error: "Login chahiye" }, { status: 401 });
    const ghToken = session.accessToken;

    const contentType = request.headers.get("content-type") || "";
    fs.mkdirSync(workDir, { recursive: true });

    if (contentType.includes("application/json")) {
      const { owner: srcOwner, repo: srcRepo, branch } = await request.json();
      const zipRes = await fetch(`https://api.github.com/repos/${srcOwner}/${srcRepo}/zipball/${branch || ""}`, {
        headers: { Authorization: `Bearer ${ghToken}` },
      });
      const buffer = Buffer.from(await zipRes.arrayBuffer());
      new AdmZip(buffer).extractAllTo(workDir, true);
      const inner = fs.readdirSync(workDir);
      if (inner.length === 1 && fs.statSync(path.join(workDir, inner[0])).isDirectory()) {
        const innerPath = path.join(workDir, inner[0]);
        for (const item of fs.readdirSync(innerPath)) fs.renameSync(path.join(innerPath, item), path.join(workDir, item));
        fs.rmdirSync(innerPath);
      }
    } else {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!file) return Response.json({ error: "File missing" }, { status: 400 });
      const buffer = Buffer.from(await file.arrayBuffer());
      new AdmZip(buffer).extractAllTo(workDir, true);
    }

    const allFiles = walkFiles(workDir).filter((f) => /\.(js|jsx|ts|tsx|java|kt|dart)$/.test(f));
    let combinedText = "";
    for (const f of allFiles.slice(0, 15)) {
      const content = fs.readFileSync(path.join(workDir, f), "utf8").slice(0, 2500);
      combinedText += `\n\n--- FILE: ${f} ---\n${content}`;
    }

    const prompt = `Tum expert developer ho. Neeche project code hai. Isme jo bhi bugs/problems hain unhe DHOOND kar FIX karo.
SIRF JSON format me jawab do:
{"summary": "Hinglish mein kya fix kiya", "files": [{"path": "relative/path", "content": "poori nayi fixed file"}]}
Agar koi bug na mile to files: [] rakho.

Code:
${combinedText}`;

    const aiRaw = await askAI(prompt);
    const parsed = extractJson(aiRaw);
    if (!parsed || !Array.isArray(parsed.files)) {
      return Response.json({ summary: "AI se structured fix nahi mila.", fixedFiles: [], rejectedFiles: [] });
    }

    const validFiles = [];
    const rejected = [];
    for (const f of parsed.files) {
      if (!f.path || typeof f.content !== "string") continue;
      if (validateSyntax(f.content) || !/\.(js|jsx|ts|tsx)$/.test(f.path)) validFiles.push(f);
      else rejected.push(f.path);
    }

    const userRes = await fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${ghToken}` } });
    const user = await userRes.json();
    const owner = user.login;
    const repoName = "ai-fixed-" + Date.now();

    await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers: { Authorization: `Bearer ${ghToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: repoName, private: true, auto_init: true }),
    });

    const allProjectFiles = walkFiles(workDir);
    for (const relPath of allProjectFiles) {
      const fixed = validFiles.find((f) => f.path === relPath);
      const content = fixed ? fixed.content : fs.readFileSync(path.join(workDir, relPath));
      await pushFile(owner, repoName, ghToken, relPath, content);
    }

    return Response.json({
      summary: parsed.summary || "",
      fixedFiles: validFiles.map((f) => f.path),
      rejectedFiles: rejected,
      owner, repo: repoName,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  } finally {
    try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {}
  }
}
