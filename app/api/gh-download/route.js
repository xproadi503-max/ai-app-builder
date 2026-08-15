import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions";

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) return new Response("Login chahiye", { status: 401 });

  const { searchParams } = new URL(request.url);
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  const artifactId = searchParams.get("artifactId");

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/artifacts/${artifactId}/zip`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  const buffer = await res.arrayBuffer();

  return new Response(buffer, {
    headers: { "Content-Type": "application/zip", "Content-Disposition": "attachment; filename=app-build.zip" },
  });
}
