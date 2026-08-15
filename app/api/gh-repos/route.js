import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) return Response.json({ error: "Login chahiye" }, { status: 401 });

  const res = await fetch("https://api.github.com/user/repos?sort=updated&per_page=30", {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  const repos = await res.json();

  const simplified = (repos || []).map((r) => ({
    name: r.name,
    owner: r.owner.login,
    fullName: r.full_name,
    private: r.private,
    updatedAt: r.updated_at,
    defaultBranch: r.default_branch,
  }));

  return Response.json({ repos: simplified });
}
