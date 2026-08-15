import AdmZip from "adm-zip";
import fetch from "node-fetch";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions";

function readZipFiles(zipBuffer) {
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();
  let combinedText = "";
  let fileList = [];
  const allowedExt = [".js", ".jsx", ".ts", ".tsx", ".py", ".java", ".kt", ".md", ".json", ".html", ".css", ".dart", ".xml", ".gradle"];
  const maxCharsPerFile = 3000;
  const maxTotalChars = 20000;

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    let name = entry.entryName;
    name = name.split("/").slice(1).join("/") || name; // GitHub zip me top-level extra folder hota hai
    fileList.push(name);
    const ext = "." + name.split(".").pop();
    if (allowedExt.includes(ext) && combinedText.length < maxTotalChars) {
      const content = entry.getData().toString("utf8").slice(0, maxCharsPerFile);
      combinedText += `\n\n--- FILE: ${name} ---\n${content}`;
    }
  }
  return { combinedText, fileList };
}

async function askAI(promptText) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: "openrouter/free", messages: [{ role: "user", content: promptText }], temperature: 0.2 }),
  });
  const data = await response.json();
  return data?.choices?.[0]?.message?.content || "AI se response nahi mil paya. Error: " + JSON.stringify(data);
}

function buildPrompt(fileList, combinedText) {
  return `Tum ek expert code reviewer ho. Neeche ek project ki files hain.
Apna jawab EXACTLY in yeh headings ke saath do (Hinglish mein, simple bhasha):

## 1. Yeh Project Kya Karta Hai
## 2. Technology/Language Use Hui
## 3. Project Structure
## 4. Bugs Aur Problems (code mein)
Yeh section ALWAYS bharo, khaali mat chhodo.
## 5. Run Karne Ke Steps

Files list: ${fileList.join(", ")}

Project content:
${combinedText}`;
}

export async function POST(request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let buffer;

    if (contentType.includes("application/json")) {
      // GitHub repo se source
      const session = await getServerSession(authOptions);
      if (!session?.accessToken) return Response.json({ error: "Login chahiye" }, { status: 401 });

      const { owner, repo, branch } = await request.json();
      const zipRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/zipball/${branch || ""}`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      if (!zipRes.ok) return Response.json({ error: "Repo download nahi ho paya" }, { status: 500 });
      buffer = Buffer.from(await zipRes.arrayBuffer());
    } else {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!file) return Response.json({ error: "Koi file upload nahi hui" }, { status: 400 });
      buffer = Buffer.from(await file.arrayBuffer());
    }

    const { combinedText, fileList } = readZipFiles(buffer);
    const analysis = await askAI(buildPrompt(fileList, combinedText));
    return Response.json({ analysis, fileCount: fileList.length, files: fileList });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
