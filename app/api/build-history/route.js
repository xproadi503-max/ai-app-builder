import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions";
import { listBuildRecords } from "../../../lib/buildHistory";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) return Response.json({ error: "Login chahiye" }, { status: 401 });

    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    const user = await userRes.json();
    const builds = await listBuildRecords(user.login);
    return Response.json({ builds });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
