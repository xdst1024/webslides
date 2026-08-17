(function () {
  "use strict";

  // 所属仓库与默认分支（fork 后一般无需改这里，页面会自动推导或用 &repo= 覆盖）
  var DEFAULT_OWNER = "ChaosJohn";
  var DEFAULT_REPO = "webslides";
  var BRANCH = "main";
  var MAX_BYTES = 50 * 1024 * 1024;

  var RESERVED = new Set(["index.html", "viewer.html", "mdpreview.html", "upload.html", "manifest.json", "CNAME", ".nojekyll"]);

  function byId(id) {
    return document.getElementById(id);
  }

  function param(key) {
    var m = new RegExp("[?&]" + key + "=([^&]*)").exec(location.search);
    return m ? decodeURIComponent(m[1]) : "";
  }

  // 在 replaceState 清掉 URL 参数前，先记住 &repo= 手动覆盖
  var repoOverride = param("repo");

  // ---------- 仓库归属解析 ----------
  // 1) &repo=owner/repo 优先；2) 服务端 manifest 内嵌的仓库身份；3) <owner>.github.io/<repo> 推导；4) 兜底默认值
  function resolveRepo() {
    var ov = repoOverride;
    if (ov) {
      var parts = ov.split("/");
      if (parts.length === 2 && parts[0] && parts[1]) return [parts[0], parts[1]];
    }
    var host = location.hostname;
    if (host.indexOf("github.io") !== -1 && host.endsWith("github.io")) {
      var hostOwner = host.split(".")[0];
      var seg = location.pathname.split("/").filter(Boolean);
      var repoName = seg.length && seg[0] !== "app" ? seg[0] : DEFAULT_REPO;
      if (hostOwner) return [hostOwner, repoName];
    }
    return [DEFAULT_OWNER, DEFAULT_REPO];
  }

  function validRepoPair(o, r) {
    return o && r && /^[A-Za-z0-9_.-]+$/.test(o) && /^[A-Za-z0-9_.-]+$/.test(r);
  }

  var repo = resolveRepo();
  var OWNER = repo[0];
  var REPO = repo[1];

  function renderRepoLine() {
    var el = byId("upRepo");
    if (el) {
      el.textContent = "上传目标仓库：" + OWNER + "/" + REPO + "（可用 &repo=owner/repo 手动覆盖）";
    }
  }

  // 读本仓构建产物里的仓库身份（自定义域名 fork 无需手动 &repo=）
  function applyManifestRepo() {
    fetch("./manifest.json", { cache: "no-cache" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (m) {
        var meta = m && m.meta;
        if (meta && !repoOverride && validRepoPair(meta.owner, meta.repo)) {
          OWNER = meta.owner;
          REPO = meta.repo;
          renderRepoLine();
        }
      })
      .catch(function () {
        // 首次部署等场景 manifest 可能暂缺 meta，保持现状
      });
  }

  // ---------- 门禁 ----------
  var token = param("up") || sessionStorage.getItem("wsUpToken") || "";
  if (!token) {
    byId("upLocked").hidden = false;
    return;
  }
  sessionStorage.setItem("wsUpToken", token);
  try {
    history.replaceState(null, "", location.pathname);
  } catch (e) {}

  var form = byId("upForm");
  var fileInput = byId("upFiles");
  var dirInput = byId("upDir");
  var goBtn = byId("upGo");
  var resList = byId("upRes");
  var msgEl = byId("upMsg");
  var barWrap = byId("upBar");
  var barFill = byId("upBarFill");
  var selList = byId("upSel");

  var pending = [];

  form.hidden = false;

  renderRepoLine();
  applyManifestRepo();

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1024 / 1024).toFixed(2) + " MB";
  }

  function renderSel() {
    selList.innerHTML = "";
    var has = pending.length > 0;
    selList.hidden = !has;
    if (!has) return;
    pending.forEach(function (f, idx) {
      var li = document.createElement("li");
      var nm = document.createElement("span");
      nm.className = "nm";
      nm.textContent = f.name;
      nm.title = f.name;
      var sz = document.createElement("span");
      sz.className = "sz";
      sz.textContent = formatSize(f.size);
      var rm = document.createElement("button");
      rm.className = "rm";
      rm.type = "button";
      rm.setAttribute("aria-label", "移除 " + f.name);
      rm.textContent = "\u2715";
      rm.addEventListener("click", function () {
        pending.splice(idx, 1);
        renderSel();
        setMsg(pending.length ? "已选择 " + pending.length + " 个文件。" : "", "ok");
      });
      li.appendChild(nm);
      li.appendChild(sz);
      li.appendChild(rm);
      selList.appendChild(li);
    });
    setMsg("已选择 " + pending.length + " 个文件，点击「上传」开始。", "ok");
  }

  function setPending(files) {
    pending = files.slice();
    renderSel();
  }

  function addPending(files) {
    var merged = pending.slice();
    files.forEach(function (f) {
      if (!merged.some(function (m) {
        return m.name === f.name && m.size === f.size;
      })) {
        merged.push(f);
      }
    });
    pending = merged;
    renderSel();
  }

  // ---------- 工具 ----------
  function setMsg(text, cls) {
    msgEl.textContent = text;
    msgEl.className = "up-msg" + (cls ? " " + cls : "");
  }

  function setBusy(on) {
    goBtn.disabled = on;
    barWrap.style.display = on ? "block" : "none";
    if (!on) barFill.style.width = "0%";
  }

  function setProgress(pct) {
    barFill.style.width = pct + "%";
  }

  function normalizeDir(raw) {
    var d = String(raw || "").split(/[?#]/)[0].replace(/\\/g, "/").trim().replace(/^\/+|\/+$/g, "");
    var parts = d.split("/").filter(function (s) {
      return s && s !== "." && s !== "..";
    });
    return parts.join("/");
  }

  function buildTarget(name, dir) {
    var parts = [];
    if (dir) parts.push(dir);
    parts.push(name);
    var relPath = parts.join("/");
    var head = relPath.split("/")[0];
    if (head === "app" || head === "assets" || RESERVED.has(head)) {
      throw new Error("目标路径与站点实现/保留文件冲突：" + relPath);
    }
    return "docs/" + relPath;
  }

  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      if (file.size > MAX_BYTES) {
        reject(new Error("文件超过 50MB 上限： " + file.name));
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result).split(",")[1] || "");
      };
      reader.onerror = function () {
        reject(new Error("读取失败：" + file.name));
      };
      reader.readAsDataURL(file);
    });
  }

  function uploadViaXhr(path, content, sha) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open("PUT", "https://api.github.com/repos/" + OWNER + "/" + REPO + "/contents/" + path);
      xhr.setRequestHeader("Accept", "application/vnd.github+json");
      xhr.setRequestHeader("Authorization", "Bearer " + token);
      xhr.setRequestHeader("X-GitHub-Api-Version", "2022-11-28");
      xhr.responseType = "json";

      xhr.upload.onprogress = function (e) {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };

      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          var msg = (xhr.response && (xhr.response.message || xhr.response.errors && xhr.response.errors.map(function (x) { return x.message; }).join("; "))) || ("HTTP " + xhr.status);
          reject(new Error(msg));
        }
      };
      xhr.onerror = function () {
        reject(new Error("网络错误"));
      };

      var body = { message: "feat: upload " + path + " via web", branch: BRANCH, content: content };
      if (sha) body.sha = sha;
      xhr.send(JSON.stringify(body));
    });
  }

  function getFileSha(path) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", "https://api.github.com/repos/" + OWNER + "/" + REPO + "/contents/" + path + "?ref=" + BRANCH);
      xhr.setRequestHeader("Accept", "application/vnd.github+json");
      xhr.setRequestHeader("Authorization", "Bearer " + token);
      xhr.setRequestHeader("X-GitHub-Api-Version", "2022-11-28");
      xhr.responseType = "json";
      xhr.onload = function () {
        if (xhr.status === 200 && xhr.response && xhr.response.sha) {
          resolve(xhr.response.sha);
        } else {
          reject(new Error("查询已存在文件失败（HTTP " + xhr.status + "）"));
        }
      };
      xhr.onerror = function () {
        reject(new Error("网络错误"));
      };
      xhr.send();
    });
  }

  function pushEntry(li, cls, text) {
    var b = document.createElement("b");
    b.className = cls;
    b.textContent = text;
    li.appendChild(b);
  }

  async function uploadOne(file, dir) {
    var path;
    try {
      path = buildTarget(file.name, dir);
    } catch (e) {
      var li0 = document.createElement("li");
      pushEntry(li0, "bad", "跳过");
      li0.appendChild(document.createTextNode("  " + file.name + " — " + e.message));
      resList.appendChild(li0);
      return false;
    }

    var li = document.createElement("li");
    li.textContent = file.name + " → " + path + "  ";
    resList.appendChild(li);

    try {
      var content = await fileToBase64(file);
      setMsg("上传 " + file.name);
      try {
        await uploadViaXhr(path, content, null);
      } catch (err) {
        // 已存在 -> 取 sha 更新
        var sha = await getFileSha(path);
        await uploadViaXhr(path, content, sha);
      }
      pushEntry(li, "ok", "完成");
      return true;
    } catch (err) {
      pushEntry(li, "bad", "失败");
      var note = document.createTextNode(" — " + (err && err.message || String(err)));
      li.appendChild(note);
      return false;
    }
  }

  async function handleUpload() {
    var dir = normalizeDir(dirInput.value);
    if (!pending.length) {
      setMsg("请先选择文件", "bad");
      return;
    }
    setBusy(true);
    setMsg("");
    resList.innerHTML = "";
    var okN = 0;
    for (var i = 0; i < pending.length; i++) {
      if (await uploadOne(pending[i], dir)) okN++;
    }
    setBusy(false);
    setMsg("完成：" + okN + "/" + pending.length + " 个文件；文件列表稍后自动更新（含同名覆盖）。", okN === pending.length ? "ok" : "bad");
    if (okN === pending.length) {
      setPending([]);
      fileInput.value = "";
    }
  }

  goBtn.addEventListener("click", handleUpload);
  dirInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleUpload();
    }
  });

  // 拖拽选择文件
  var dragDepth = 0;
  var dropTarget = form;

  function setDrag(on) {
    if (on) {
      dropTarget.classList.add("dragover");
    } else {
      dragDepth = 0;
      dropTarget.classList.remove("dragover");
    }
  }

  function isLikelyFolder(f) {
    return f.size === 0 && !f.type;
  }

  document.addEventListener("dragover", function (e) {
    e.preventDefault();
  });
  document.addEventListener("drop", function (e) {
    e.preventDefault();
  });
  dropTarget.addEventListener("dragenter", function (e) {
    e.preventDefault();
    dragDepth++;
    setDrag(true);
  });
  dropTarget.addEventListener("dragleave", function (e) {
    e.preventDefault();
    dragDepth--;
    if (dragDepth <= 0) setDrag(false);
  });
  dropTarget.addEventListener("drop", function (e) {
    e.preventDefault();
    setDrag(false);
    var dropped = Array.prototype.slice.call(e.dataTransfer.files || []);
    if (dropped.some(isLikelyFolder)) {
      setMsg("不支持拖拽文件夹，请展开后选择文件", "bad");
      return;
    }
    addPending(dropped);
  });
  fileInput.addEventListener("change", function () {
    var picked = Array.prototype.slice.call(fileInput.files || []);
    fileInput.value = "";
    if (!picked.length) return;
    addPending(picked);
  });
})();