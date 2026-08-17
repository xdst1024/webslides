# WebSlides

基于 GitHub Pages 托管在 `docs/` 目录下，在浏览器中直接在线浏览 PPT 演示文稿（.pptx）与 HTML 幻灯片。

## 浏览方式

站点实现文件统一放在 `docs/app/` 下；`docs/` 根目录仅保留一个 `index.html` 自动跳转到 `app/`。查看器/预览页直接使用 `app/` 内的页面：`app/viewer.html?doc=…`、`app/mdpreview.html?doc=…`。

- **首页**：https://slides.99se.cn/ 三种视图（所有文件·默认 / 按文件树 / 按文件类型），并支持搜索文件名、按类型多选筛选、按名称/大小/修改时间升降序排序。支持在线预览的类型带「在线预览」按钮（.pptx/.pptm 走 pptx 查看器；.md/.markdown 走 Markdown 预览页；.html 及图片/PDF/文本等浏览器原生可打开的类型直接打开），其余文件仅提供「下载」；所有文件均可下载。
- **Markdown 预览**：`app/mdpreview.html?doc=<相对路径>.md`，支持 GitHub 风格表格/任务清单/删除线/自动链接、代码块语法高亮（highlight.js）、LaTeX 数学公式（KaTeX）；渲染后经 DOMPurify 清洗（放行常见 iframe 内嵌）。页面提供「原文」「下载」。
- **查看器**：`viewer.html?doc=<相对路径>.pptx`（如 `viewer.html?doc=dir/a.pptx`），支持：
  - 键盘：`←` `→` 翻页、`Space` 下一页、`Home`/`End` 跳转首末页、`F` 全屏、`Esc` 退出全屏
  - 底部缩略图导航栏，点击跳页
  - 每页独立链接：`viewer.html?doc=<相对路径>.pptx#slide=3`
  - 手机触摸左右滑动翻页
  - 图表、嵌入对象、音视频、SmartArt 等网页端无法 100% 还原的元素会明示提示，并可在工具栏下载原件

## 新增文件（两种方式，任选）

**方式一：GitHub 网页上传（零本地操作，日常推荐）**
1. 打开仓库网页 → `Add file` → `Upload files` → 把文件（可多选）拖进来。
2. 直接点提交（提交发生在远端，无需先 pull）。
3. GitHub Actions 会自动重建文件树 manifest，首页/预览随之更新。
4. 注意：网页单文件上限 25MB；超大文件请在本地用方式二。

**方式二：本地一条命令发布（自动 pull+拷贝+提交+推送）**

```bash
node scripts/publish-file.mjs <文件或目录> [--as <docs内相对路径>] [--msg <提交信息>] [--force]
```

- 自动执行 `git pull --rebase` → 拷贝进 `docs/` → `git add`（只暂存本次拷贝的文件）→ 提交 → `push`
- 示例：
  - `node scripts/publish-file.mjs ~/Desktop/report.md`
  - `node scripts/publish-file.mjs report.pdf --as papers/report.pdf`
  - `node scripts/publish-file.mjs mydeck/ --as mydeck`
- 默认提交信息为 `feat: add docs/<路径>`，可用 `--msg` 自定义；目标已存在时需 `--force`
- 会拒绝覆盖站点实现文件（index/viewer/mdpreview/manifest/assets 等），并提示其它未提交改动

**方式三：Web 页面上传（自用隐藏入口）**

打开 `https://slides.99se.cn/app/upload.html?up=<Token>` 即可在浏览器里上传文件到指定目录（默认 `docs/uploads/`，可手动填子目录），上传即提交，Actions 自动刷新列表；同名文件自动覆盖。

- 文件选择：支持点击 `input` 弹出选择、也可直接把文件拖入上传卡片；可多选，**再次选择会并入现有待传列表**；每行可单独 ✕ 移除。
- 目标仓库：自动识别——fork 的 Actions 构建时会把自身 `owner/repo` 写入 `app/manifest.json`，上传页读取它即可，**自定义域名也无需手动设置**；`&repo=owner/repo` 仍可手动覆盖；主仓无需任何操作。
- Token：建议使用「仅本仓库 + Contents 读写 + 不限定时间久但可轮换」的 fine-grained Personal Access Token。Token 只临时存在于浏览器会话内存（sessionStorage），**不会写入代码库**，也不要把它放进任何提交。
- **安全边界**：该页面对任何知道入口 URL 参数的人开放。前端 Token 对懂技术的人可见，请务必用最小权限 Token 并定期轮换；本功能定位为“自用”，不要用于多人生开放投稿。

### 获取并配置上传 Token（fine-grained PAT）

1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
2. **Token name**：如 `webslides-upload`；**Expiration**：建议 30~90 天
3. **Resource owner**：选仓库所属账号（fork 后选你自己的账号）
4. **Repository access**：`Only select repositories` → 勾选你的仓库
5. **Permissions → Repository permissions → Contents**：`Read and write`（其余保持 No access；Metadata 自动给只读）
6. 生成后复制 `github_pat_…`（只显示一次），拼进上传页 URL：
   `https://<你的域名>/app/upload.html?up=github_pat_xxx[&repo=owner/repo]`

### Fork 之后：运行与自动同步

1. **让 fork 可运行**：仓库 **Settings → Pages**：Source 选 `main` 分支、目录 `/docs`；**Actions** 保持启用（默认开启）。
2. **上传配置**：用自己的 Token。仓库归属自动识别（Actions 构建时把 fork 的 `owner/repo` 写进 `app/manifest.json`，自定义域名同样生效）；如确需手动，可用 `&repo=你的owner/你的repo` 覆盖。每个 fork 用各自的 Token，不要共用。
3. **自动同步上游 app/scripts/actions**：仓库自带工作流 `.github/workflows/sync-fork-app.yml`——每周一 04:00（UTC）自动运行，也可在 **Actions** 页手动 **Run workflow**。它会把上游的 `docs/app`、`scripts`、`generate-index.yml` 同步覆盖到你的 fork，**不影响**你的内容文件（docs 根、uploads 子目录等）。上游演进（如本仓更新 app 实现或 Actions）后，fork 只要跑一次该工作流即可跟进。
4. 备用手动方式：GitHub 自带的 **Sync fork** 按钮（合并全部上游改动，包括内容；谨慎使用）。
5. 请在 fork 后自查：首次运行该工作流前，fork 里的 `docs/app/` 即 fork 时点的上游快照，可直接使用。

## 本地预览

```bash
# 生成 manifest（本地未跑 Actions 时手动执行一次）
node scripts/generate-manifest.mjs

# 起一个静态服务器预览（注意须用 http 协议，直接 file:// 打开无法 fetch）
python3 -m http.server 8000 --directory docs
# 打开 http://localhost:8000/
```

## 实现说明

- 渲染引擎：[PPTXJS](https://github.com/meshesha/PPTXJS)（前端运行时解析渲染，无需构建步骤），及其依赖 jQuery / JSZip v2 / d3 / nv.d3，均通过 jsDelivr CDN 引入。
- 高保真范围：文字、形状、颜色、表格按原版式渲染；动画、过渡及原生图表等不做支持，采用降级提示 + 原件下载。
- `.nojekyll` 位于 `docs/`，关闭 Jekyll 处理以确保静态文件原样托管。

## 缓存说明

GitHub Pages 会对所有静态文件返回 `Cache-Control: max-age=600`（10 分钟浏览器缓存）。因此刚发布新版本后，个别浏览器（尤其是手机端）可能继续加载旧 JS/HTML，导致“别人好了自己还报错”。

- 各 HTML 页面已加入 `Cache-Control: no-cache` 元标签，且本地资源（`assets/*`）在引用时带内容哈希版本参数（如 `?v=452dc840d2`）。版本参数由 GitHub Actions 中的 `scripts/bump-asset-version.mjs` 根据 `assets/` 文件内容**自动生成**，JS/CSS 一改，部署时版本号自动更新，无需手动维护；
- 若手机端仍看到旧版本：等待约 10 分钟重试，或使用无痕窗口 / 清除该站点缓存后重新访问；
- CDN（jsDelivr）脚本已固定在具体 tag，不会随时间漂移。

## 目录结构

```
docs/
  index.html               # 根入口：自动跳转到 app/
  CNAME, .nojekyll         # GitHub Pages 所需（须留在根目录）
  app/                     # 站点实现
    index.html             # 首页（三种视图 + 搜索/筛选/排序）
    viewer.html            # PPT 查看器
    mdpreview.html         # Markdown 预览页
    manifest.json          # 文件树清单（由 GitHub Actions 自动生成）
    assets/                # 样式与脚本（ws-style.css / ws-index.js / ws-viewer.js / ws-mdviewer.js）
  ...                      # 待托管的文件（可放子目录，会自动递归进文件树）
scripts/generate-manifest.mjs    # 生成 manifest.json 的脚本（写入 app/)
scripts/bump-asset-version.mjs   # 按资源内容哈希自动更新版本号
scripts/publish-file.mjs         # 一条命令发布文件
.github/workflows/generate-index.yml
```