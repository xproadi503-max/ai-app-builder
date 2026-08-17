import AdmZip from "adm-zip";
import { askAI } from "../../../lib/ai";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions";

export const maxDuration = 60; // AI providers ko fallback try karne ke liye poora time do

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
    name = name.split("/").slice(1).join("/") || name;
    fileList.push(name);
    const ext = "." + name.split(".").pop();
    if (allowedExt.includes(ext) && combinedText.length < maxTotalChars) {
      const content = entry.getData().toString("utf8").slice(0, maxCharsPerFile);
      combinedText += `\n\n--- FILE: ${name} ---\n${content}`;
    }
  }
  return { combinedText, fileList };
}

// Pre-flight scan: build fail hone se PEHLE hi in patterns ko pakadta hai jo
// compile to ho jaate hai lekin runtime pe silently todte hai (build error nahi dete
// isliye normal auto-fix loop inhe kabhi nahi pakadta).
function preFlightScan(combinedText, isReactNative) {
  const warnings = [];
  if (/window\.storage\s*\.\s*(get|set)/.test(combinedText)) {
    warnings.push("`window.storage` use ho raha hai — yeh sirf Claude artifact ke andar kaam karta hai, standalone app me data save nahi hoga. Fix: web ho to `localStorage`, React Native ho to `@react-native-async-storage/async-storage` use karo.");
  }
  if (/api\.anthropic\.com/.test(combinedText) && !/Authorization|x-api-key/.test(combinedText)) {
    warnings.push("Anthropic API seedha bina apni key/header ke call ho raha hai — yeh sirf artifact ke andar free proxy se chalta hai, standalone deployed app me fail hoga. Apni key backend route ke peeche rakho.");
  }
  if (isReactNative && /\blocalStorage\b/.test(combinedText)) {
    warnings.push("`localStorage` use ho raha hai lekin yeh React Native project hai — localStorage native runtime me exist hi nahi karta, app crash karega. Fix: `@react-native-async-storage/async-storage` use karo.");
  }
  const secretPatterns = [/["']sk-[a-zA-Z0-9]{20,}["']/, /["']AIza[a-zA-Z0-9_-]{30,}["']/, /["']AKIA[A-Z0-9]{16}["']/];
  if (secretPatterns.some((p) => p.test(combinedText))) {
    warnings.push("Code me kahi hardcoded API key/secret directly dikh rahi hai — isse turant hata ke .env / GitHub Secrets me daalo, warna leak ho sakti hai.");
  }
  if (/Constants\.expoConfig\??\.extra|process\.env\.[A-Z_]*KEY/.test(combinedText) && isReactNative) {
    warnings.push("Ek API key .env/GitHub Secrets se aa rahi hai (achha), lekin agar wo seedha app ke andar (client-side) use ho rahi hai, to build ke baad bhi wo APK ke andar bake ho jaati hai — koi bhi APK reverse-engineer karke nikaal sakta hai. Sensitive/paid keys (jaise AI provider keys) ke liye apna backend/serverless route banao, key sirf server pe rakho.");
  }
  if (isReactNative) {
    const riskyNativeModules = ["react-native-razorpay", "react-native-iap", "react-native-maps", "react-native-fbsdk-next", "@react-native-google-signin/google-signin", "@react-native-firebase/app", "react-native-ble-plx"];
    const found = riskyNativeModules.filter((m) => combinedText.includes(`"${m}"`));
    if (found.length) {
      warnings.push(`Ye native module(s) use ho rahe hai: ${found.join(", ")} — inhe kabhi Expo config plugin ki zarurat padti hai. Agar app.config.js me "plugins" list nahi hai in packages ke liye, "expo prebuild" ke baad build fail ho sakta hai ya feature runtime pe crash ho sakta hai. Package ke docs me "Expo config plugin" check karo.`);
    }
  }
  return warnings;
}

function buildPrompt(fileList, combinedText) {
  return `Tum ek expert code reviewer ho. Neeche ek project ki files hain.
Apna jawab EXACTLY in yeh headings ke saath do (Hinglish mein, simple bhasha):

## 1. Yeh Project Kya Karta Hai
## 2. Technology/Language Use Hui
## 3. Project Structure
## 4. Bugs Aur Problems (code mein)
Yeh section ALWAYS bharo, khaali mat chhodo.
## 5. Security Check (API Keys/Secrets)
Agar code mein koi hardcoded API key, password, ya secret token dikhe, to yaha WARNING do. Agar kuch na mile to likho "Koi hardcoded secret nahi mila, achha hai!"
## 6. Run Karne Ke Steps

Files list: ${fileList.join(", ")}

Project content:
${combinedText}`;
}

export async function POST(request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let fileList, combinedText;

    if (contentType.includes("application/json")) {
      const session = await getServerSession(authOptions);
      if (!session?.accessToken) return Response.json({ error: "Login chahiye" }, { status: 401 });

      const { owner, repo, branch } = await request.json();
      const zipRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/zipball/${branch || ""}`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      if (!zipRes.ok) return Response.json({ error: "Repo download nahi ho paya" }, { status: 500 });
      const buffer = Buffer.from(await zipRes.arrayBuffer());
      const result = readZipFiles(buffer);
      fileList = result.fileList; combinedText = result.combinedText;
    } else {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!file) return Response.json({ error: "Koi file upload nahi hui" }, { status: 400 });

      const isZip = file.name.toLowerCase().endsWith(".zip");
      if (isZip) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const result = readZipFiles(buffer);
        fileList = result.fileList; combinedText = result.combinedText;
      } else {
        // Single file - seedha content padho, unzip mat karo
        const textContent = Buffer.from(await file.arrayBuffer()).toString("utf8");
        fileList = [file.name];
        combinedText = `\n\n--- FILE: ${file.name} ---\n${textContent.slice(0, 20000)}`;
      }
    }

    const isReactNative = /"react-native"|"expo"/.test(combinedText);
    const preFlightWarnings = preFlightScan(combinedText, isReactNative);
    const preflightSection = preFlightWarnings.length
      ? `## 0. ⚠️ Pre-Flight Warnings (Build se pehle fix karo)\n${preFlightWarnings.map((w) => "- " + w).join("\n")}\n\n`
      : "";

    // Safety net: agar askAI() kisi wajah se maxDuration (60s) ke bahar chala jaaye,
    // to Vercel function ko silently kill karega aur frontend ko khaali/invalid
    // response milega ("Unexpected end of JSON input"). Isliye yaha khud 50s ka
    // hard deadline lagate hai taaki hamesha ek valid JSON error waapas jaaye.
    const aiResult = await Promise.race([
      askAI(buildPrompt(fileList, combinedText)),
      new Promise((_, reject) => setTimeout(() => reject(new Error("AI response 50s me nahi aaya, sabhi providers slow/down lag rahe hai. Dobara try karo.")), 50000)),
    ]);

    const analysis = preflightSection + aiResult;
    return Response.json({ analysis, fileCount: fileList.length, files: fileList, preFlightWarnings });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
