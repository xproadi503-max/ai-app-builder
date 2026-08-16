import AdmZip from "adm-zip";
import fs from "fs";
import path from "path";
import os from "os";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions";

const SKIP_DIRS = ["node_modules", ".git", "build", ".next", "dist", ".expo", ".gradle", "ios/build", "android/build", "android/.gradle"];

function findFileUpward(dir, filenames, maxDepth = 3, depth = 0) {
  if (depth > maxDepth) return null;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const name of filenames) {
    if (fs.existsSync(path.join(dir, name))) return dir;
  }
  for (const entry of entries) {
    if (entry.isDirectory() && !SKIP_DIRS.includes(entry.name)) {
      const found = findFileUpward(path.join(dir, entry.name), filenames, maxDepth, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function detectProjectType(rootDir) {
  const pubspecDir = findFileUpward(rootDir, ["pubspec.yaml"]);
  if (pubspecDir) return { type: "flutter", root: pubspecDir };
  const pkgDir = findFileUpward(rootDir, ["package.json"]);
  if (pkgDir) {
    const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps.expo && !fs.existsSync(path.join(pkgDir, "android"))) return { type: "expo", root: pkgDir };
    if (deps["react-native"]) return { type: "bare-rn", root: pkgDir };
  }
  const gradleDir = findFileUpward(rootDir, ["build.gradle", "build.gradle.kts"]);
  if (gradleDir) return { type: "android-native", root: gradleDir };
  return { type: "unknown", root: rootDir };
}

function scaffoldWebProjectFromSingleFile(workDir, fileContent) {
  fs.mkdirSync(path.join(workDir, "src"), { recursive: true });
  fs.writeFileSync(path.join(workDir, "package.json"), JSON.stringify({
    name: "ai-generated-app", version: "1.0.0", private: true,
    scripts: { dev: "vite", build: "vite build" },
    dependencies: { react: "18.3.1", "react-dom": "18.3.1", "lucide-react": "0.383.0" },
    devDependencies: { vite: "5.4.0", "@vitejs/plugin-react": "4.3.1" },
  }, null, 2));
  fs.writeFileSync(path.join(workDir, "vite.config.js"), `import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\nexport default defineConfig({ plugins: [react()], base: "./" });\n`);
  fs.writeFileSync(path.join(workDir, "index.html"), `<!doctype html>\n<html><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>App</title></head>\n<body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>\n`);
  fs.writeFileSync(path.join(workDir, "src/main.jsx"), `import React from "react";\nimport ReactDOM from "react-dom/client";\nimport App from "./App.jsx";\nReactDOM.createRoot(document.getElementById("root")).render(<App />);\n`);
  let content = fileContent;
  if (!/export\s+default/.test(content)) content += `\n\nexport default function AutoWrappedApp() { return null; }\n`;
  fs.writeFileSync(path.join(workDir, "src/App.jsx"), content);
}

function signStep(apkPathVar, alias, storePass, keyPass) {
  return `      - name: Setup Android SDK tools
        uses: android-actions/setup-android@v3
      - name: Prepare keystore
        run: |
          mkdir -p keystore_out
          if [ -f "keystore/release.keystore" ]; then
            cp keystore/release.keystore keystore_out/release.keystore
          else
            keytool -genkeypair -v -keystore keystore_out/release.keystore -alias ${alias} -keyalg RSA -keysize 2048 -validity 10000 -storepass ${storePass} -keypass ${keyPass} -dname "CN=AI App Builder,O=AI App Builder,C=IN"
          fi
      - name: Sign APK
        run: |
          BUILD_TOOLS=$(ls $ANDROID_HOME/build-tools | sort -V | tail -1)
          $ANDROID_HOME/build-tools/$BUILD_TOOLS/apksigner sign --ks keystore_out/release.keystore --ks-key-alias ${alias} --ks-pass pass:${storePass} --key-pass pass:${keyPass} --out signed-release.apk ${apkPathVar}
      - uses: actions/upload-artifact@v4
        with:
          name: signed-apk
          path: signed-release.apk
      - uses: actions/upload-artifact@v4
        with:
          name: your-keystore-KEEP-SAFE
          path: keystore_out/release.keystore`;
}

function getWorkflow(type, signing) {
  const alias = signing.alias || "appkey";
  const storePass = signing.storePass || "changeit123";
  const keyPass = signing.keyPass || signing.storePass || "changeit123";

  if (type === "web-capacitor") {
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
      - run: npm run build
      - run: npm install @capacitor/core @capacitor/cli @capacitor/android
      - run: npx cap init "AI Generated App" "com.aibuilder.app" --web-dir=dist
      - run: npx cap add android
      - run: npx cap sync android
      - uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '21'
      - run: cd android && chmod +x gradlew && ./gradlew assembleRelease
${signStep("android/app/build/outputs/apk/release/app-release-unsigned.apk", alias, storePass, keyPass)}
`;
  }
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
${signStep("build/app/outputs/flutter-apk/app-release.apk", alias, storePass, keyPass)}
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
          java-version: '21'
      - name: Ensure gradlew exists
        run: |
          cd android
          if [ ! -f "./gradlew" ]; then
            gradle wrapper --gradle-version 8.5
          fi
          cd ..
      - run: cd android && chmod +x gradlew && ./gradlew assembleRelease
${signStep("android/app/build/outputs/apk/release/app-release-unsigned.apk", alias, storePass, keyPass)}
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
          java-version: '21'
      - name: Ensure gradlew exists
        run: |
          cd android
          if [ ! -f "./gradlew" ]; then
            gradle wrapper --gradle-version 8.5
          fi
          cd ..
      - run: cd android && chmod +x gradlew && ./gradlew assembleRelease
${signStep("android/app/build/outputs/apk/release/app-release-unsigned.apk", alias, storePass, keyPass)}
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
          java-version: '21'
      - name: Ensure gradlew exists
        run: |
          if [ ! -f "./gradlew" ]; then
            gradle wrapper --gradle-version 8.5
          fi
      - run: chmod +x gradlew && ./gradlew assembleRelease
${signStep("app/build/outputs/apk/release/app-release-unsigned.apk", alias, storePass, keyPass)}
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

// Sab files ko EK commit me daalne ke liye Git Data API use karte hain (Trees API)
async function batchCommitAllFiles(owner, repo, token, filesMap) {
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const refRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/main`, { headers });
  const refData = await refRes.json();
  const latestCommitSha = refData.object.sha;

  const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits/${latestCommitSha}`, { headers });
  const commitData = await commitRes.json();
  const baseTreeSha = commitData.tree.sha;

  // Har file ka blob banao
  const treeItems = [];
  for (const [filePath, content] of Object.entries(filesMap)) {
    const isBuffer = Buffer.isBuffer(content);
    const blobRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs`, {
      method: "POST", headers,
      body: JSON.stringify({
        content: isBuffer ? content.toString("base64") : Buffer.from(content).toString("base64"),
        encoding: "base64",
      }),
    });
    const blobData = await blobRes.json();
    treeItems.push({ path: filePath, mode: "100644", type: "blob", sha: blobData.sha });
  }

  const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
    method: "POST", headers,
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems }),
  });
  const treeData = await treeRes.json();

  const newCommitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
    method: "POST", headers,
    body: JSON.stringify({ message: "Add all project files (single commit)", tree: treeData.sha, parents: [latestCommitSha] }),
  });
  const newCommitData = await newCommitRes.json();

  // Ref update karo - isi se sirf EK BAAR workflow trigger hoga
  await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/main`, {
    method: "PATCH", headers,
    body: JSON.stringify({ sha: newCommitData.sha }),
  });
}

export async function POST(request) {
  const workDir = path.join(os.tmpdir(), "ghbuild-" + Date.now());
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) return Response.json({ error: "Login nahi hai." }, { status: 401 });
    const ghToken = session.accessToken;
    const contentType = request.headers.get("content-type") || "";
    fs.mkdirSync(workDir, { recursive: true });

    let keystoreBuffer = null;
    let signing = {};
    let isSingleFile = false;

    if (contentType.includes("application/json")) {
      const { owner: srcOwner, repo: srcRepo, branch } = await request.json();
      const zipRes = await fetch(`https://api.github.com/repos/${srcOwner}/${srcRepo}/zipball/${branch || ""}`, {
        headers: { Authorization: `Bearer ${ghToken}` },
      });
      if (!zipRes.ok) return Response.json({ error: "Repo download nahi ho paya" }, { status: 500 });
      const buffer = Buffer.from(await zipRes.arrayBuffer());
      new AdmZip(buffer).extractAllTo(workDir, true);
      const inner = fs.readdirSync(workDir);
      if (inner.length === 1 && fs.statSync(path.join(workDir, inner[0])).isDirectory()) {
        const innerPath = path.join(workDir, inner[0]);
        for (const item of fs.readdirSync(innerPath)) fs.renameSync(path.join(innerPath, item), path.join(workDir, item));
        fs.rmdirSync(innerPath);
      }
    } else {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!file) return Response.json({ error: "Koi file upload nahi hui" }, { status: 400 });

      const isZip = file.name.toLowerCase().endsWith(".zip");
      if (isZip) {
        const buffer = Buffer.from(await file.arrayBuffer());
        new AdmZip(buffer).extractAllTo(workDir, true);
      } else {
        isSingleFile = true;
        const textContent = Buffer.from(await file.arrayBuffer()).toString("utf8");
        scaffoldWebProjectFromSingleFile(workDir, textContent);
      }

      const keystoreFile = formData.get("keystore");
      if (keystoreFile && keystoreFile.size > 0) keystoreBuffer = Buffer.from(await keystoreFile.arrayBuffer());
      signing = {
        alias: formData.get("keyAlias") || "",
        storePass: formData.get("storePassword") || "",
        keyPass: formData.get("keyPassword") || "",
      };
    }

    let type, buildRoot;
    if (isSingleFile) {
      type = "web-capacitor"; buildRoot = workDir;
    } else {
      const detected = detectProjectType(workDir);
      type = detected.type; buildRoot = detected.root;
      if (type === "unknown") return Response.json({ error: "Project type pehchan nahi paye." }, { status: 400 });
    }
    const workflow = getWorkflow(type, signing);

    const userRes = await fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${ghToken}` } });
    const user = await userRes.json();
    const owner = user.login;
    const repoName = "ai-build-" + Date.now();

    const createRepoRes = await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers: { Authorization: `Bearer ${ghToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: repoName, private: true, auto_init: true }),
    });
    if (!createRepoRes.ok) {
      const errData = await createRepoRes.json();
      return Response.json({ error: "Repo nahi ban paya: " + JSON.stringify(errData) }, { status: 500 });
    }

    // Thoda wait karo taaki auto_init ka commit ready ho jaye
    await new Promise((r) => setTimeout(r, 2000));

    // Saari files ek object me jama karo
    const filesMap = { ".github/workflows/build.yml": workflow };
    if (keystoreBuffer) filesMap["keystore/release.keystore"] = keystoreBuffer;

    const allFiles = walkFiles(buildRoot);
    for (const relPath of allFiles) {
      filesMap[relPath] = fs.readFileSync(path.join(buildRoot, relPath));
    }

    // Sab ek sath, EK commit me push karo
    await batchCommitAllFiles(owner, repoName, ghToken, filesMap);

    return Response.json({ owner, repo: repoName, type, hasCustomKeystore: !!keystoreBuffer, isSingleFile, fileCount: Object.keys(filesMap).length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  } finally {
    try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {}
  }
}
