import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions";

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) return Response.json({ error: "Login chahiye" }, { status: 401 });
    const token = session.accessToken;

    const { owner, repo, files } = await request.json();

    for (const f of files) {
      const contentBase64 = Buffer.from(f.content).toString("base64");
      let sha;
      const getRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(f.path)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (getRes.ok) sha = (await getRes.json()).sha;

      await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(f.path)}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message: `AI fix: ${f.path}`, content: contentBase64, sha }),
      });
    }

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
