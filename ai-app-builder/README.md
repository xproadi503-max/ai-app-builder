# 🤖 AI App Builder (Starter Project)

Yeh ek starter project hai jisme:
- GitHub Login (OAuth)
- Project (.zip) upload karke AI se analyze karwana (Gemini free API)

Mobile se GitHub + Codespaces use karke isko chalane ke steps neeche hain.

---

## Step 1: Naya GitHub Repository banao

1. GitHub app/website kholo → **New Repository**
2. Naam do (jaise `ai-app-builder`) → Create
3. Is repo ki saari files (jo tumhe zip me mili hain) usme **upload** kar do
   (GitHub app me: repo kholo → "Add file" → "Upload files" → sab files select karo → Commit)

---

## Step 2: GitHub OAuth App banao (Login ke liye)

1. GitHub website kholo → Settings → Developer settings → **OAuth Apps** → **New OAuth App**
2. Fill karo:
   - **Application name**: AI App Builder
   - **Homepage URL**: `http://localhost:3000` (Codespaces me baad me update karenge)
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
3. Create karne ke baad tumhe **Client ID** aur **Client Secret** milega — inko copy karke rakh lo

> ⚠️ Codespaces me chalate waqt URL badal jayega (jaise `https://xxxxx.app.github.dev`), tab OAuth App me callback URL update karna hoga us naye URL se.

---

## Step 3: OpenRouter API Key lo (Free, better code quality)

1. Jao: https://openrouter.ai/keys
2. Sign up karo (Google account se, **koi credit card nahi maangega**)
3. **Create Key** button dabao → copy kar lo (jaise `sk-or-...`)
4. Yeh free hai — model use ho raha hai `deepseek-chat-v3.1:free`, jo coding explain/analyze karne me Llama se better hai

---

## Step 4: Codespaces me project kholo

1. Apni GitHub repo kholo
2. Green button **"Code"** → **"Codespaces"** tab → **"Create codespace on main"**
3. Thodi der me ek VS Code jaisa editor browser/mobile me khul jayega (yeh already terminal ke saath aata hai)

---

## Step 5: Environment variables set karo

Codespaces ke terminal me:

```bash
cp .env.example .env
```

Phir `.env` file kholo aur apni values daal do:

```
GH_CLIENT_ID=<tumhara client id>
GH_CLIENT_SECRET=<tumhara client secret>
NEXTAUTH_SECRET=koi_bhi_random_lambi_string
NEXTAUTH_URL=<codespace ka url, jaise https://xxxxx.app.github.dev>
OPENROUTER_API_KEY=<tumhari openrouter api key>
```

---

## Step 6: Install + Run

Codespaces terminal me yeh commands chalao:

```bash
npm install
npm run dev
```

Codespaces automatically ek popup dega "Open in Browser" — uspe click karo. App khul jayega!

---

## Step 7: Use karo

1. "Login with GitHub" pe click karo
2. Apna project ka `.zip` file upload karo
3. "Analyze Karo" dabao
4. AI tumhe Hinglish me explain karega project kya hai, kaise kaam karta hai

---

## Agla Kaam (Roadmap)

- [ ] Terminal add karna (xterm.js) taaki AI khud commands chala sake
- [ ] Error auto-fix loop (AI command chalaye → error dekhe → khud fix kare)
- [ ] Multiple AI fallback (Gemini limit khatam ho to DeepSeek/Groq pe switch ho)
- [ ] Git auto-commit before AI edits (safety backup)
- [ ] GitHub repo directly clone karna (sirf zip nahi, seedha repo se bhi kaam kare)

---

## Free Rahega Kab Tak?

Yeh sab (GitHub OAuth, OpenRouter API, Codespaces free hours, Vercel hosting) hamesha free hai, koi card nahi chahiye kabhi bhi:
- OpenRouter free tier: shuru me ~50 requests/day (bina credit purchase ke), kaafi hai testing ke liye
- Codespaces: GitHub free tier me ~60 hours/month milte hain
- Zyada users aane par Codespaces ki jagah Vercel + Railway pe deploy karna padega (tab bhi OpenRouter free model free rahega)
