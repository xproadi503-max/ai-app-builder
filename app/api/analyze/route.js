import AdmZip from "adm-zip";
import fetch from "node-fetch";

function readProjectFiles(zipBuffer) {
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();
  let combinedText = "";
  let fileList = [];
  const allowedExt = [".js", ".jsx", ".ts", ".tsx", ".py", ".java", ".kt", ".md", ".json", ".html", ".css", ".dart", ".xml", ".gradle"];
  const maxCharsPerFile = 3000;
  const maxTotalChars = 20000;

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const name = entry.entryName;
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
  const url = "https://openrouter.ai/api/v1/chat/completions";
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "openrouter/free",
      messages: [{ role: "user", content: promptText }],
      temperature: 0.2,
    }),
  });
  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  return text || "AI se response nahi mil paya. Error: " + JSON.stringify(data);
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file) return Response.json({ error: "Koi file upload nahi hui" }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const { combinedText, fileList } = readProjectFiles(buffer);

    const prompt = `Tum ek expert code reviewer ho. Neeche ek project ki files hain.
Apna jawab EXACTLY in yeh headings ke saath do (Hinglish mein, simple bhasha):

## 1. Yeh Project Kya Karta Hai
(2-3 lines mein)

## 2. Technology/Language Use Hui
(list format mein)

## 3. Project Structure
(files/folders ka short overview)

## 4. Bugs Aur Problems (code mein)
Yeh section ALWAYS bharo, khaali mat chhodo. Har bug/problem ko is format mein likho:
- **File:** [file ka naam]
- **Problem:** [kya galat hai]
- **Kyun issue hai:** [1 line mein]
Agar sach me koi bug na mile, to likho: "Koi obvious bug nahi mila, lekin yeh cheezein improve ki ja sakti hain: ..."

## 5. Run Karne Ke Steps
(step by step)

Files list: ${fileList.join(", ")}

Project content:
${combinedText}`;

    const analysis = await askAI(prompt);
    return Response.json({ analysis, fileCount: fileList.length, files: fileList });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
