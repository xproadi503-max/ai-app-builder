const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

function headers() {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
}

// Purana similar error dhoondo - agar mil jaye to AI se poochna hi nahi padta
export async function searchSimilarLearning(errorSnippet, projectType) {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  try {
    const keywords = errorSnippet.slice(0, 200).replace(/[^a-zA-Z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 4).slice(0, 5).join(" | ");
    if (!keywords) return null;

    const url = `${SUPABASE_URL}/rest/v1/learnings?error_snippet=fts.${encodeURIComponent(keywords)}&project_type=eq.${encodeURIComponent(projectType || "")}&order=success_count.desc&limit=1`;
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.[0] || null;
  } catch {
    return null;
  }
}

// Naya fix seekha - save karo taaki agli baar turant mil jaye
export async function saveLearning(errorSnippet, fixSummary, fixFiles, projectType) {
  if (!SUPABASE_URL || !SERVICE_KEY) return;
  try {
    const signature = errorSnippet.slice(0, 100);
    await fetch(`${SUPABASE_URL}/rest/v1/learnings`, {
      method: "POST",
      headers: { ...headers(), Prefer: "return=minimal" },
      body: JSON.stringify({
        error_signature: signature,
        error_snippet: errorSnippet.slice(0, 3000),
        fix_summary: fixSummary,
        fix_files: fixFiles,
        project_type: projectType || "unknown",
      }),
    });
  } catch {}
}

// Jab purana fix dobara kaam aaye, uska success_count badha do (taaki woh aur trusted ban jaye)
export async function incrementLearningSuccess(learningId) {
  if (!SUPABASE_URL || !SERVICE_KEY || !learningId) return;
  try {
    const getRes = await fetch(`${SUPABASE_URL}/rest/v1/learnings?id=eq.${learningId}&select=success_count`, { headers: headers() });
    const data = await getRes.json();
    const current = data?.[0]?.success_count || 1;
    await fetch(`${SUPABASE_URL}/rest/v1/learnings?id=eq.${learningId}`, {
      method: "PATCH",
      headers: { ...headers(), Prefer: "return=minimal" },
      body: JSON.stringify({ success_count: current + 1 }),
    });
  } catch {}
}
