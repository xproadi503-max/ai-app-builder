import AdmZip from "adm-zip";
import fetch from "node-fetch";

// Yeh function project ki important files padhta hai (code + README/MD files)
function readProjectFiles(zipBuffer) {
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();

  let combinedText = "";
  let fileList = [];
  const allowedExt = [".js", ".jsx", ".ts", ".tsx", ".py", ".java", ".md", ".json", ".html", ".css"];
  const maxCharsPerFile = 3000; // bahut badi files ko truncate karte hain taaki AI ko sab fit ho jaye
  const maxTotalChars = 20000; // total limit taaki free AI request ke andar rahe

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
  // OpenRouter use kar rahe hain - DeepSeek jaisa strong coding model, bilkul free, card nahi chahiye
  const apiKey = process.env.OPENROUTER_API_KEY;
  const url = "https://openrouter.ai/api/v1/chat/completions";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek/deepseek-chat-v3.1:free", // strong coding quality, free tier
      messages: [{ role: "user", content: promptText }],
      temperature: 0.2, // low temperature = precise, kam galti
    }),
  });

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  return text || "AI se response nahi mil paya. API key check karo. Error: " + JSON.stringify(data);
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return Response.json({ error: "Koi file upload nahi hui" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { combinedText, fileList } = readProjectFiles(buffer);

    const prompt = `Tum ek expert code reviewer ho. Neeche ek project ki files hain (README/MD files aur code).
Isko analyze karo aur SIMPLE HINDI-ENGLISH (Hinglish) mein explain karo:
1. Yeh project kya karta hai
2. Kaunsi technology/language use hui hai
3. Project ka structure kaisa hai
4. Agar koi obvious problem/error dikh raha ho code mein to bhi batao
5. Isko run karne ke steps kya honge

Files list: ${fileList.join(", ")}

Project content:
${combinedText}`;

    const analysis = await askAI(prompt);

    return Response.json({ analysis, fileCount: fileList.length, files: fileList });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
