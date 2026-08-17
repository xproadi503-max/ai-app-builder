import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions";

export const maxDuration = 60;

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) return Response.json({ error: "Login chahiye" }, { status: 401 });
    const token = session.accessToken;

    const { owner, repo, files, attemptNumber } = await request.json();
    const branchName = `ai-fix-attempt-${attemptNumber || Date.now()}`;

    // Main branch ka latest commit SHA lo
    const refRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/main`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const refData = await refRes.json();
    const mainSha = refData.object.sha;

    // Naya branch banao
    await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: mainSha }),
    });

    // Naye branch pe fix push karo
    for (const f of files) {
      const contentBase64 = Buffer.from(f.content).toString("base64");
      let sha;
      const getRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(f.path)}?ref=${branchName}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (getRes.ok) sha = (await getRes.json()).sha;

      await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(f.path)}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message: `AI fix attempt: ${f.path}`, content: contentBase64, sha, branch: branchName }),
      });
    }

    // Pull Request banao
    const prRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `🤖 AI Auto-Fix Attempt ${attemptNumber || ""}`,
        head: branchName,
        base: "main",
        body: "3-AI council ne yeh fix suggest kiya build error ke liye. Build test hone ke baad, agar successful ho to yeh automatically merge ho jayega.",
      }),
    });
    const prData = await prRes.json();

    return Response.json({ success: true, branch: branchName, prUrl: prData.html_url, prNumber: prData.number });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
