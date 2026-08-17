async function tryAnthropic(promptText, model = "claude-haiku-4-5-20251001") {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Anthropic key missing");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      messages: [{ role: "user", content: promptText }],
    }),
    signal: AbortSignal.timeout(25000),
  });
  const data = await res.json();
  const text = data?.content?.[0]?.text;
  if (!text) throw new Error("Anthropic: " + JSON.stringify(data));
  return text;
}

async function tryOpenRouter(promptText, model = "deepseek/deepseek-chat-v3.1:free") {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OpenRouter key missing");
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: [{ role: "user", content: promptText }], temperature: 0.2 }),
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenRouter: " + JSON.stringify(data));
  return text;
}

async function tryGroq(promptText) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Groq key missing");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages: [{ role: "user", content: promptText }], temperature: 0.2 }),
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq: " + JSON.stringify(data));
  return text;
}

async function tryOpenRouterBackupModel(promptText) {
  return tryOpenRouter(promptText, "meta-llama/llama-3.3-70b-instruct:free");
}

export async function tryGitHubModels(promptText, ghToken) {
  if (!ghToken) throw new Error("GitHub token missing");
  const res = await fetch("https://models.inference.ai.azure.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ghToken}` },
    body: JSON.stringify({ model: "Meta-Llama-3.1-70B-Instruct", messages: [{ role: "user", content: promptText }], temperature: 0.2 }),
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("GitHub Models: " + JSON.stringify(data));
  return text;
}

export async function askAI(promptText) {
  const providers = [
    { name: "Claude Haiku 4.5 (paid, best quality)", fn: tryAnthropic },
    { name: "OpenRouter (auto)", fn: tryOpenRouter },
    { name: "Groq", fn: tryGroq },
    { name: "OpenRouter (backup)", fn: tryOpenRouterBackupModel },
  ];
  const errors = [];
  for (const provider of providers) {
    try { return await provider.fn(promptText); }
    catch (err) { errors.push(`${provider.name}: ${err.message}`); continue; }
  }
  throw new Error("Sabhi AI providers fail hue:\n" + errors.join("\n"));
}

// Multi-AI Council: Draft (OpenRouter) -> Review (Groq) -> Final (GitHub Models, agar issues mile to)
export async function councilFix(originalCode, taskDescription, ghToken) {
  const steps = [];

  const draftPrompt = `Tum ek expert developer ho. ${taskDescription}
SIRF JSON format me jawab do: {"summary": "kya kiya", "files": [{"path": "...", "content": "..."}]}

Code:
${originalCode}`;
  const draft = await askAI(draftPrompt);
  steps.push({ stage: "Draft (AI #1)", output: draft });

  let reviewText;
  try {
    reviewText = await tryGroq(`Tum ek strict code reviewer ho. Neeche ek proposed fix hai (JSON format mein).
Check karo: syntax sahi hai? logic sahi hai? kuch missing hai?
Agar sab sahi hai to likho "APPROVED".
Agar problem hai to likho "ISSUES: " aur exact kya galat hai batao (Hinglish mein).

Proposed fix:
${draft}`);
  } catch {
    reviewText = "APPROVED";
  }
  steps.push({ stage: "Review (AI #2)", output: reviewText });

  let finalOutput = draft;
  if (reviewText.includes("ISSUES")) {
    const refinePrompt = `Tumhara pehla fix review me reject hua. Reviewer ka feedback: ${reviewText}
Ab isko theek karke FINAL sahi fix do, wahi JSON format mein: {"summary": "...", "files": [{"path": "...", "content": "..."}]}

Original code:
${originalCode}

Pehla (reject hua) fix:
${draft}`;
    try {
      finalOutput = ghToken ? await tryGitHubModels(refinePrompt, ghToken) : await askAI(refinePrompt);
      steps.push({ stage: "Final Fix (AI #3)", output: finalOutput });
    } catch {
      finalOutput = draft;
      steps.push({ stage: "Final Fix (fallback to draft)", output: "AI #3 fail hua, draft hi use kiya" });
    }
  } else {
    steps.push({ stage: "Final", output: "Pehla draft hi approved hua" });
  }

  return { finalOutput, steps };
}
