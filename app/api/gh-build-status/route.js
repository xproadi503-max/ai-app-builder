import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions";
import { councilFix } from "../../../lib/ai";
import * as acorn from "acorn";
import jsx from "acorn-jsx";

const JSXParser = acorn.Parser.extend(jsx());

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

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) return Response.json({ error: "Login chahiye" }, { status: 401 });
    const token = session.accessToken;

    const { searchParams } = new URL(request.url);
    const owner = searchParams.get("owner");
    const repo = searchParams.get("repo");
    const branch = searchParams.get("branch") || "main";

    const runsRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=1&branch=${branch}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const runsData = await runsRes.json();
    const run = runsData.workflow_runs?.[0];
    if (!run) return Response.json({ status: "waiting" });

    const result = { status: run.status, conclusion: run.conclusion, runId: run.id, runUrl: run.html_url };

    if (run.status === "completed" && run.conclusion === "success") {
      const artRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/runs/${run.id}/artifacts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const artData = await artRes.json();
      const apkArtifact = artData.artifacts?.find((a) => a.name === "signed-apk") || artData.artifacts?.[0];
      if (apkArtifact) result.artifactId = apkArtifact.id;
    }

    if (run.status === "completed" && run.conclusion === "failure") {
      const jobsRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/runs/${run.id}/jobs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const jobsData = await jobsRes.json();
      const failedJob = jobsData.jobs?.find((j) => j.conclusion === "failure");

      if (failedJob) {
        const logsRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/jobs/${failedJob.id}/logs`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const logsText = (await logsRes.text()).slice(-4000);

        const { finalOutput, steps } = await councilFix(
          logsText,
          "Neeche GitHub Actions build fail hone ka error LOG hai (poora project code nahi hai, sirf log hai). Isse samjho kya galat hai aur agar koi specific file ka fix pata chal sakta hai to do, warna files: [] rakho.",
          token
        );
        const parsed = extractJson(finalOutput);

        if (parsed && Array.isArray(parsed.files)) {
          const validFiles = [];
          const rejected = [];
          for (const f of parsed.files) {
            if (!f.path || typeof f.content !== "string") continue;
            if (/\.(js|jsx|ts|tsx)$/.test(f.path)) {
              if (validateSyntax(f.content)) validFiles.push(f); else rejected.push(f.path);
            } else if (f.path.endsWith(".json")) {
              try { JSON.parse(f.content); validFiles.push(f); } catch { rejected.push(f.path); }
            } else validFiles.push(f);
          }
          result.aiExplanation = parsed.explanation || parsed.summary || "";
          result.aiFixFiles = validFiles;
          result.aiRejectedFiles = rejected;
          result.councilSteps = steps;
        } else {
          result.aiExplanation = "3 AI ne mil ke socha, lekin structured fix nahi mila.";
          result.aiFixFiles = [];
          result.councilSteps = steps;
        }
      }
    }

    return Response.json(result);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
