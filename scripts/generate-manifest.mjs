import { readdirSync, statSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const docsDir = join(scriptsDir, "..", "docs");

// 识别当前仓库身份：优先 Actions 提供的 GITHUB_REPOSITORY，其次解析 origin remote
function detectRepo() {
  const envRepo = process.env.GITHUB_REPOSITORY;
  if (envRepo && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(envRepo)) {
    const parts = envRepo.split("/");
    return { owner: parts[0], repo: parts[1] };
  }
  try {
    const url = execFileSync("git", ["remote", "get-url", "origin"], { encoding: "utf8", cwd: repoRoot() }).trim().replace(/\.git$/, "");
    let m = /github\.com[/:]([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(url);
    if (!m) m = /^[^@]+@[^:]+:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(url);
    if (m) return { owner: m[1], repo: m[2] };
  } catch (e) {
    // 忽略：本地无 origin 时返回 null
  }
  return null;
}

function repoRoot() {
  return join(scriptsDir, "..");
}

const ROOT_HIDDEN = new Set([
  "index.html",
  "viewer.html",
  "mdpreview.html",
  "manifest.json",
  "CNAME",
  ".nojekyll",
  "assets",
  "app",
]);

function build(dir) {
  const entries = readdirSync(dir, { withFileTypes: true })
    .map((e) => ({ name: e.name, isDir: e.isDirectory() }))
    .sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name, "zh-Hans-CN");
    });

  return entries
    .filter((e) => !ROOT_HIDDEN.has(e.name))
    .map((e) => {
      const full = join(dir, e.name);
      if (e.isDir) {
        return { name: e.name, type: "dir", modified: statSync(full).mtime.toISOString(), children: build(full) };
      }
      const st = statSync(full);
      return { name: e.name, type: "file", size: st.size, modified: st.mtime.toISOString() };
    });
}

const manifest = {
  generated: new Date().toISOString(),
  meta: detectRepo(),
  tree: build(docsDir),
};

writeFileSync(join(docsDir, "app", "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

const count = (nodes) =>
  nodes.reduce((n, x) => n + (x.type === "dir" ? count(x.children || []) : 1), 0);
console.log(`manifest.json updated: ${count(manifest.tree)} file(s) in tree`);