async function tryOpenRouter(promptText, model = "openrouter/free") {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OpenRouter key missing");
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: [{ role: "user", content: promptText }], temperature: 0.2 }),
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
  });
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq: " + JSON.stringify(data));
  return text;
}

async function tryOpenRouterBackupModel(promptText) {
  return tryOpenRouter(promptText, "meta-llama/llama-3.3-70b-instruct:free");
}

export async function askAI(promptText) {
  const providers = [
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

// Doosra AI fix ko verify/review karega
export async function askAIWithVerification(promptText, verifyPromptFn) {
  const firstAnswer = await askAI(promptText);
  if (!verifyPromptFn) return firstAnswer;

  const verifyPrompt = verifyPromptFn(firstAnswer);
  let verifyResult;
  try {
    verifyResult = await tryGroq(verifyPrompt); // alag provider se doosri राय
  } catch {
    try { verifyResult = await tryOpenRouterBackupModel(verifyPrompt); }
    catch { return firstAnswer; } // verification na ho paye to bhi original de do
  }

  return { firstAnswer, verifyResult };
}
