const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

function headers() {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
}

// Har successful "repo bana + files push" hone ke baad ek build record save karo
export async function saveBuildRecord({ userLogin, owner, repoName, projectType, sourceName }) {
  if (!SUPABASE_URL || !SERVICE_KEY) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/builds`, {
      method: "POST",
      headers: { ...headers(), Prefer: "return=minimal" },
      body: JSON.stringify({
        user_login: userLogin,
        owner,
        repo_name: repoName,
        project_type: projectType,
        source_name: sourceName || repoName,
      }),
    });
  } catch {}
}

// User ke saare pichle builds list karo (naye pehle)
export async function listBuildRecords(userLogin, limit = 30) {
  if (!SUPABASE_URL || !SERVICE_KEY) return [];
  try {
    const url = `${SUPABASE_URL}/rest/v1/builds?user_login=eq.${encodeURIComponent(userLogin)}&order=created_at.desc&limit=${limit}`;
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}
