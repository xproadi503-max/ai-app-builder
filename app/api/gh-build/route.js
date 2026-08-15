import AdmZip from "adm-zip";
import fs from "fs";
import path from "path";
import os from "os";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/authOptions";

const SKIP_DIRS = ["node_modules", ".git", "build", ".next", "dist", ".expo", ".gradle", "ios/build", "android/build", "android/.gradle"];

function detectProjectType(dir) {
  if (fs.existsSync(path.join(dir, "pubspec.yaml"))) return "flutter";
  const pkgPath = path.join(dir, "package.json");
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps.expo && !fs.existsSync(path.join(dir, "android"))) return "expo";
    if (deps["react-native"]) return "bare-rn";
  }
  if (fs.existsSync(path.join(dir, "build.gradle")) || fs.existsSync(path.join(dir, "build.gradle.kts"))) return "android-native";
  return "unknown";
}

function getWorkflow(type) {
  const upload = (p) => `      - uses: actions/upload-artifact@v4\n        with:\n          name: app-release-apk\n          path: ${p}`;
  if (type === "flutter") {
    return `name: Build APK
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: subosito/flutter-action@v2
        with:
          flutter-version: '3.24.0'
      - run: flutter pub get
      - run: flutter build apk --release
${upload("build/app/outputs/flutter-apk/app-release.apk")}
`;
  }
  if (type === "expo") {
    return `name: Build APK
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install
      - run: npx expo prebuild --platform android --non-interactive
      - uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'
      - run: cd android && chmod +x gradlew && ./gradlew assembleRelease
${upload("android/app/build/outputs/apk/release/app-release.apk")}
`;
  }
  if (type === "bare-rn") {
    return `name: Build APK
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install
      - uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'
      - run: cd android && chmod +x gradlew && ./gradlew assembleRelease
${upload("android/app/build/outputs/apk/release/app-release.apk")}
`;
  }
  if (type === "android-native") {
    return `name: Build APK
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'
      - run: chmod +x gradlew && ./gradlew assembleRelease
${upload("app/build/outputs/apk/release/app-release.apk")}
`;
  }
  return null;
}

function shouldSkip(relPath) {
  return SKIP_DIRS.some((d) => relPath.startsWith(d + "/") || relPath === d);
}

function walkFiles(dir, base = "") {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const relPath = path.join(base, entry.name).replace(/\\/g, "/");
    if (shouldSkip(relPath)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results = results.concat(walkFiles(full, relPath));
    else results.push(relPath);
  }
  return results;
}

export async function POST(request) {
  const workDir = path.join(os.tmpdir(), "ghbuild-" + Date.now());
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return Response.json({ error: "Login nahi hai ya token missing. Logout karke dobara login karo." }, { status: 401 });
    }
    const ghToken = session.accessToken;

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file) return Response.json({ error: "Koi file upload nahi hui" }, { status: 400 });

    fs.mkdirSync(workDir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    new AdmZip(buffer).extractAllTo(workDir, true);

    const type = detectProjectType(workDir);
    if (type === "unknown") {
      return Response.json({ error: "Project type pehchan nahi paye (Flutter/RN/Android nahi lagta)." }, { status: 400 });
    }
    const workflow = getWorkflow(type);

    // GitHub user info
    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${ghToken}` },
    });
    const user = await userRes.json();
    const owner = user.login;

    const repoName = "ai-build-" + Date.now();

    // Repo banao
    const createRepoRes = await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers: { Authorization: `Bearer ${ghToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: repoName, private: true, auto_init: true }),
    });
    if (!createRepoRes.ok) {
      const errData = await createRepoRes.json();
      return Response.json({ error: "Repo nahi ban paya: " + JSON.stringify(errData) }, { status: 500 });
    }

    // Workflow file push
    await pushFile(owner, repoName, ghToken, ".github/workflows/build.yml", workflow);

    // Baaki saari project files push karo
    const allFiles = walkFiles(workDir);
    for (const relPath of allFiles) {
      const fullPath = path.join(workDir, relPath);
      const content = fs.readFileSync(fullPath);
      await pushFile(owner, repoName, ghToken, relPath, content, true);
    }

    return Response.json({ owner, repo: repoName, type });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  } finally {
    try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {}
  }
}

async function pushFile(owner, repo, token, filePath, content, isBinaryBuffer = false) {
  const contentBase64 = isBinaryBuffer ? content.toString("base64") : Buffer.from(content).toString("base64");
  // Existing file ho to uska sha chahiye hoga update ke liye
  let sha;
  const getRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (getRes.ok) {
    const data = await getRes.json();
    sha = data.sha;
  }

  await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: sha ? `Update ${filePath}` : `Add ${filePath}`,
      content: contentBase64,
      sha,
    }),
  });
}
