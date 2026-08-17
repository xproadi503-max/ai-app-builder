import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions";

export const maxDuration = 60;

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) return Response.json({ error: "Login chahiye" }, { status: 401 });
    const token = session.accessToken;
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    const { owner, repo, files, attemptNumber } = await request.json();
    if (!files || files.length === 0) return Response.json({ error: "AI ne koi fix file di hi nahi" }, { status: 400 });

    // Har attempt ka apna unique branch — attemptNumber + timestamp dono, taaki
    // retry pe purana branch clash na kare ("Reference already exists" 422 error).
    const branchName = `ai-fix-attempt-${attemptNumber || 1}-${Date.now()}`;

    // Main branch ka latest commit SHA lo — pehle check karo ke ref mila bhi ya nahi.
    const refRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/main`, { headers });
    if (!refRes.ok) {
      const errBody = await refRes.text();
      return Response.json({ error: `Main branch ka ref nahi mila: ${errBody}` }, { status: 500 });
    }
    const refData = await refRes.json();
    const mainSha = refData.object.sha;

    // Naya branch banao — is step ko bhi check karo.
    const createBranchRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: mainSha }),
    });
    if (!createBranchRes.ok) {
      const errBody = await createBranchRes.text();
      return Response.json({ error: `Fix branch nahi ban paya: ${errBody}` }, { status: 500 });
    }

    // Naye branch pe fix push karo — har file ke PUT ko bhi check karo.
    const failedFiles = [];
    for (const f of files) {
      const contentBase64 = Buffer.from(f.content).toString("base64");
      let sha;
      const getRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(f.path)}?ref=${branchName}`, { headers });
      if (getRes.ok) sha = (await getRes.json()).sha;

      const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(f.path)}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ message: `AI fix attempt: ${f.path}`, content: contentBase64, sha, branch: branchName }),
      });
      if (!putRes.ok) {
        const errBody = await putRes.text();
        failedFiles.push(`${f.path}: ${errBody}`);
      }
    }
    if (failedFiles.length === files.length) {
      return Response.json({ error: `Koi bhi file push nahi ho payi:\n${failedFiles.join("\n")}` }, { status: 500 });
    }

    // Pull Request banao — response bhi check karo, GitHub error JSON me "message" field deta hai.
    const prRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: `🤖 AI Auto-Fix Attempt ${attemptNumber || ""}`,
        head: branchName,
        base: "main",
        body: "3-AI council ne yeh fix suggest kiya build error ke liye. Build test hone ke baad, agar successful ho to yeh automatically merge ho jayega." + (failedFiles.length ? `\n\n⚠️ Kuch files push nahi ho payi:\n${failedFiles.join("\n")}` : ""),
      }),
    });
    const prData = await prRes.json();
    if (!prRes.ok || !prData.html_url) {
      return Response.json({ error: `Branch "${branchName}" ban gaya (files push ho gayi) lekin Pull Request nahi ban paya: ${prData.message || JSON.stringify(prData)}`, branch: branchName }, { status: 500 });
    }

    return Response.json({ success: true, branch: branchName, prUrl: prData.html_url, prNumber: prData.number, failedFiles });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
