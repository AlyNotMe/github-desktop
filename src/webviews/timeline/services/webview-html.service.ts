import * as path from "path";
import * as vscode from "vscode";
import { RepositoryManager } from "../../../core/repositories/repository-manager";
import { getPrimaryRepository } from "../../../shared/utils/repo-selection";

/**
 * Renders the timeline webview as a self-contained GitHub Desktop-style UI:
 * a three-cell toolbar (repository / branch / sync), a left column with the
 * Changes and History tabs plus the commit box, and a diff pane on the right.
 *
 * Everything is inlined (no bundle, no CDN, nonce-based CSP) so the view keeps
 * working regardless of the webview module loader.
 */
export class WebviewHtmlService {
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly repositories: RepositoryManager,
  ) {}

  generateHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const repository = getPrimaryRepository(this.repositories);
    const initialData = {
      repository: repository
        ? {
            name: path.basename(repository.localPath),
            path: repository.localPath,
            remote: repository.remoteUrl,
          }
        : null,
    };

    const csp = [
      `default-src 'none'`,
      `style-src 'nonce-${nonce}'`,
      `script-src 'nonce-${nonce}'`,
      `img-src ${webview.cspSource} https: data:`,
      `font-src ${webview.cspSource}`,
    ].join("; ");

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>GitHub Desktop</title>
<style nonce="${nonce}">
${STYLES}
</style>
</head>
<body>
<div id="toolbar">
  <button class="cell" id="repoCell" type="button">
    <span class="cell-ico">${ICON.repo}</span>
    <span class="cell-text">
      <span class="cell-label">Current repository</span>
      <span class="cell-value" id="repoName">&mdash;</span>
    </span>
    <span class="cell-caret">${ICON.caret}</span>
  </button>
  <button class="cell" id="branchCell" type="button">
    <span class="cell-ico">${ICON.branch}</span>
    <span class="cell-text">
      <span class="cell-label">Current branch</span>
      <span class="cell-value" id="branchName">&mdash;</span>
    </span>
    <span class="cell-caret">${ICON.caret}</span>
  </button>
  <button class="cell" id="syncCell" type="button">
    <span class="cell-ico" id="syncIco">${ICON.fetch}</span>
    <span class="cell-text">
      <span class="cell-label" id="syncLabel">Fetch origin</span>
      <span class="cell-value cell-sub" id="syncSub">Never fetched</span>
    </span>
    <span class="cell-count" id="syncCount" hidden></span>
  </button>
</div>

<div id="body">
  <div id="left">
    <div id="tabs">
      <button class="tab is-active" data-tab="changes" type="button">Changes <span class="badge" id="changesBadge">0</span></button>
      <button class="tab" data-tab="history" type="button">History</button>
    </div>

    <div class="tabpane" id="pane-changes">
      <div id="filterWrap">
        <input id="filter" type="text" placeholder="Filter changed files" autocomplete="off" spellcheck="false">
      </div>
      <label id="allRow">
        <input type="checkbox" id="allCheck">
        <span id="allText">0 changed files</span>
      </label>
      <div id="fileList"></div>
      <div id="noChanges" class="empty-block">
        <div class="empty-emoji">${ICON.check}</div>
        <div class="empty-title">No local changes</div>
        <div class="empty-sub">There are no uncommitted changes in this repository.</div>
      </div>
      <div id="commitBox">
        <div class="commit-summary">
          <span class="avatar" id="avatar">?</span>
          <input id="summary" type="text" placeholder="Summary (required)" autocomplete="off">
        </div>
        <textarea id="description" placeholder="Description"></textarea>
        <button id="commitBtn" type="button" disabled>Commit to <strong id="commitBranch">branch</strong></button>
      </div>
    </div>

    <div class="tabpane" id="pane-history" hidden>
      <div id="commitList"></div>
      <div id="noHistory" class="empty-block" hidden>
        <div class="empty-title">No history</div>
      </div>
    </div>
  </div>

  <div id="right">
    <div id="diffHeader" hidden><span id="diffPath"></span></div>
    <div id="diffBody">
      <div class="empty-block">
        <div class="empty-emoji">${ICON.file}</div>
        <div class="empty-title">No file selected</div>
        <div class="empty-sub">Select a file on the left to see its diff.</div>
      </div>
    </div>
  </div>
</div>

<div id="menu" class="menu" hidden></div>

<script nonce="${nonce}">
window.__INITIAL__ = ${JSON.stringify(initialData)};
${SCRIPT}
</script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

const ICON = {
  repo: `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.5 2.5 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.5 2.5 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.25.25 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z"/></svg>`,
  branch: `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm8.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z"/></svg>`,
  fetch: `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0Zm.5 4.75a.75.75 0 0 0-1.5 0v3.5c0 .414.336.75.75.75h2.5a.75.75 0 0 0 0-1.5H8.5Z"/></svg>`,
  push: `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M8 1.5 3.75 5.75l1.06 1.06L7.25 4.4v7.35h1.5V4.4l2.44 2.41 1.06-1.06Z"/></svg>`,
  pull: `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M8 14.5 3.75 10.25l1.06-1.06L7.25 11.6V4.25h1.5v7.35l2.44-2.41 1.06 1.06Z"/></svg>`,
  publish: `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M8 1 4 5h2.5v5h3V5H12ZM3 12.5h10V14H3Z"/></svg>`,
  caret: `<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M4 6l4 4 4-4Z"/></svg>`,
  check: `<svg viewBox="0 0 16 16" width="28" height="28" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/></svg>`,
  file: `<svg viewBox="0 0 16 16" width="28" height="28" fill="currentColor"><path d="M2 1.75C2 .784 2.784 0 3.75 0h5.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 12.25 16h-8.5A1.75 1.75 0 0 1 2 14.25Zm7.5-.25v2.75c0 .414.336.75.75.75h2.75Z"/></svg>`,
};

const STYLES = `
* { box-sizing: border-box; margin: 0; padding: 0; }
:root { color-scheme: light dark; }
html, body { height: 100%; }
body {
  display: flex; flex-direction: column;
  font-family: var(--vscode-font-family, "Segoe UI", system-ui, sans-serif);
  font-size: var(--vscode-font-size, 13px);
  color: var(--vscode-foreground);
  background: var(--vscode-editor-background);
  overflow: hidden;
}
button, input, textarea { font: inherit; color: inherit; }

/* ---- toolbar ---- */
#toolbar {
  display: flex; flex: 0 0 auto; height: 50px;
  background: var(--vscode-sideBar-background);
  border-bottom: 1px solid var(--vscode-panel-border);
}
.cell {
  display: flex; align-items: center; gap: 8px;
  flex: 1 1 0; min-width: 0; padding: 0 12px;
  background: transparent; border: 0;
  border-right: 1px solid var(--vscode-panel-border);
  cursor: pointer; text-align: left;
}
.cell:last-child { border-right: 0; }
.cell:hover { background: var(--vscode-list-hoverBackground); }
.cell-ico { flex: 0 0 auto; display: flex; opacity: .8; }
.cell-text { display: flex; flex-direction: column; min-width: 0; line-height: 1.3; }
.cell-label { font-size: 11px; color: var(--vscode-descriptionForeground); }
.cell-value { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cell-sub { font-weight: 400; font-size: 11px; color: var(--vscode-descriptionForeground); }
.cell-caret { flex: 0 0 auto; opacity: .6; }
.cell-count {
  flex: 0 0 auto; font-size: 11px; padding: 1px 5px; border-radius: 8px;
  background: var(--vscode-badge-background); color: var(--vscode-badge-foreground);
}

/* ---- body split ---- */
#body { flex: 1 1 auto; display: flex; min-height: 0; }
#left {
  flex: 0 0 272px; display: flex; flex-direction: column; min-height: 0;
  background: var(--vscode-sideBar-background);
  border-right: 1px solid var(--vscode-panel-border);
}
#right { flex: 1 1 auto; display: flex; flex-direction: column; min-width: 0; }

/* ---- tabs ---- */
#tabs { display: flex; flex: 0 0 auto; border-bottom: 1px solid var(--vscode-panel-border); }
.tab {
  flex: 1 1 0; padding: 8px 4px; background: transparent; border: 0;
  border-bottom: 2px solid transparent; cursor: pointer;
  color: var(--vscode-descriptionForeground); font-weight: 500;
}
.tab:hover { background: var(--vscode-list-hoverBackground); }
.tab.is-active { color: var(--vscode-foreground); border-bottom-color: var(--vscode-focusBorder); }
.badge {
  font-size: 11px; padding: 0 5px; border-radius: 8px;
  background: var(--vscode-badge-background); color: var(--vscode-badge-foreground);
}
.tabpane { flex: 1 1 auto; display: flex; flex-direction: column; min-height: 0; }

/* ---- changed files ---- */
#filterWrap { flex: 0 0 auto; padding: 8px; }
#filter {
  width: 100%; padding: 4px 8px; border-radius: 2px;
  background: var(--vscode-input-background); color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border, transparent);
}
#filter:focus { outline: 1px solid var(--vscode-focusBorder); border-color: var(--vscode-focusBorder); }
#allRow {
  flex: 0 0 auto; display: flex; align-items: center; gap: 8px;
  padding: 5px 10px; font-size: 12px; color: var(--vscode-descriptionForeground);
  border-bottom: 1px solid var(--vscode-panel-border); cursor: pointer;
}
#fileList { flex: 1 1 auto; overflow: auto; min-height: 0; }
.file-row {
  display: flex; align-items: center; gap: 8px; padding: 3px 10px; cursor: pointer;
  white-space: nowrap;
}
.file-row:hover { background: var(--vscode-list-hoverBackground); }
.file-row.is-selected { background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }
.file-name { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; }
.file-dir { opacity: .6; }
.status-sq {
  flex: 0 0 auto; width: 14px; height: 14px; border-radius: 2px;
  display: flex; align-items: center; justify-content: center;
  font-size: 9px; font-weight: 700; line-height: 1;
  border: 1px solid currentColor;
}
.st-M { color: var(--vscode-gitDecoration-modifiedResourceForeground, #e2c08d); }
.st-A, .st-U { color: var(--vscode-gitDecoration-untrackedResourceForeground, #73c991); }
.st-D { color: var(--vscode-gitDecoration-deletedResourceForeground, #f14c4c); }
.st-R { color: var(--vscode-gitDecoration-renamedResourceForeground, #73c991); }
.st-C { color: var(--vscode-gitDecoration-conflictingResourceForeground, #e4676b); }
.file-x {
  flex: 0 0 auto; opacity: 0; padding: 0 2px; border: 0; background: transparent;
  cursor: pointer; color: inherit; font-size: 13px;
}
.file-row:hover .file-x { opacity: .7; }
.file-x:hover { opacity: 1; }

/* ---- commit box ---- */
#commitBox {
  flex: 0 0 auto; padding: 8px; border-top: 1px solid var(--vscode-panel-border);
  display: flex; flex-direction: column; gap: 6px;
}
.commit-summary { display: flex; align-items: center; gap: 6px; }
.avatar {
  flex: 0 0 auto; width: 22px; height: 22px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  background: var(--vscode-button-background); color: var(--vscode-button-foreground);
}
#summary, #description {
  width: 100%; padding: 5px 8px; border-radius: 2px;
  background: var(--vscode-input-background); color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border, transparent);
}
#summary:focus, #description:focus { outline: 1px solid var(--vscode-focusBorder); border-color: var(--vscode-focusBorder); }
#description { resize: vertical; min-height: 48px; max-height: 140px; }
#commitBtn {
  width: 100%; padding: 6px 10px; border: 0; border-radius: 2px; cursor: pointer;
  background: var(--vscode-button-background); color: var(--vscode-button-foreground);
}
#commitBtn:hover:not(:disabled) { background: var(--vscode-button-hoverBackground); }
#commitBtn:disabled { opacity: .5; cursor: default; }
#commitBtn strong { font-weight: 700; }

/* ---- history ---- */
#commitList { flex: 1 1 auto; overflow: auto; min-height: 0; }
.commit-row {
  display: flex; flex-direction: column; gap: 2px; padding: 7px 12px; cursor: pointer;
  border-bottom: 1px solid var(--vscode-panel-border);
}
.commit-row:hover { background: var(--vscode-list-hoverBackground); }
.commit-row.is-selected { background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }
.commit-msg { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.commit-meta { font-size: 11px; color: var(--vscode-descriptionForeground); display: flex; align-items: center; gap: 6px; }
.unpushed-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--vscode-charts-blue, #4daafc); flex: 0 0 auto; }

/* ---- diff ---- */
#diffHeader {
  flex: 0 0 auto; padding: 6px 12px; font-size: 12px;
  background: var(--vscode-sideBar-background);
  border-bottom: 1px solid var(--vscode-panel-border);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
#diffBody {
  flex: 1 1 auto; overflow: auto; min-height: 0;
  background: var(--vscode-editor-background);
  font-family: var(--vscode-editor-font-family, ui-monospace, monospace);
  font-size: var(--vscode-editor-font-size, 12px);
}
.diff-line { display: flex; white-space: pre; }
.diff-gutter {
  flex: 0 0 auto; width: 44px; padding: 0 6px; text-align: right;
  color: var(--vscode-editorLineNumber-foreground); opacity: .6;
  user-select: none; border-right: 1px solid var(--vscode-panel-border);
}
.diff-text { flex: 1 1 auto; padding: 0 8px; }
.diff-add { background: var(--vscode-diffEditor-insertedTextBackground, rgba(63,185,80,.15)); }
.diff-del { background: var(--vscode-diffEditor-removedTextBackground, rgba(248,81,73,.15)); }
.diff-hunk { color: var(--vscode-descriptionForeground); background: var(--vscode-editor-inactiveSelectionBackground); }
.diff-meta { color: var(--vscode-descriptionForeground); }

/* ---- empty states ---- */
.empty-block {
  flex: 1 1 auto; display: flex; flex-direction: column; align-items: center;
  justify-content: center; text-align: center; padding: 24px; gap: 6px;
}
.empty-emoji { opacity: .5; }
.empty-title { font-size: 14px; }
.empty-sub { font-size: 12px; color: var(--vscode-descriptionForeground); max-width: 240px; }

/* ---- popup menu ---- */
.menu {
  position: fixed; z-index: 50; min-width: 220px; max-height: 60vh; overflow: auto;
  background: var(--vscode-menu-background, var(--vscode-sideBar-background));
  border: 1px solid var(--vscode-menu-border, var(--vscode-panel-border));
  border-radius: 4px; box-shadow: 0 4px 14px rgba(0,0,0,.4); padding: 4px;
}
.menu input.menu-filter {
  width: 100%; margin-bottom: 4px; padding: 4px 6px; border-radius: 2px;
  background: var(--vscode-input-background); color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border, transparent);
}
.menu-item {
  display: flex; align-items: center; gap: 8px; padding: 5px 8px; border-radius: 2px;
  cursor: pointer; white-space: nowrap;
}
.menu-item:hover { background: var(--vscode-list-hoverBackground); }
.menu-item.is-current { color: var(--vscode-descriptionForeground); }
.menu-sep { height: 1px; margin: 4px 0; background: var(--vscode-panel-border); }
.menu-empty { padding: 6px 8px; color: var(--vscode-descriptionForeground); }
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-thumb { background: var(--vscode-scrollbarSlider-background); border-radius: 5px; }
::-webkit-scrollbar-thumb:hover { background: var(--vscode-scrollbarSlider-hoverBackground); }
`;

const SCRIPT = String.raw`
const vscode = acquireVsCodeApi();
const post = (command, extra) => vscode.postMessage(Object.assign({ command }, extra || {}));
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]
));

const state = {
  repository: (window.__INITIAL__ && window.__INITIAL__.repository) || null,
  changes: [],
  history: [],
  branches: [],
  currentBranch: null,
  branchActivity: {},
  remote: null,
  tab: "changes",
  selectedFiles: new Set(),
  selectedPath: null,
  selectedCommit: null,
  filter: "",
};

/* ---------- toolbar ---------- */
function renderToolbar() {
  $("repoName").textContent = state.repository ? state.repository.name : "No repository";
  $("branchName").textContent = state.currentBranch || "—";
  $("commitBranch").textContent = state.currentBranch || "branch";

  const r = state.remote || {};
  const ico = $("syncIco"), label = $("syncLabel"), sub = $("syncSub"), count = $("syncCount");
  const svg = { fetch: ${JSON.stringify(ICON.fetch)}, push: ${JSON.stringify(ICON.push)}, pull: ${JSON.stringify(ICON.pull)}, publish: ${JSON.stringify(ICON.publish)} };
  let mode = "fetch";
  if (!r.hasRemote || r.isPublished === false) mode = "publish";
  else if (r.behind > 0) mode = "pull";
  else if (r.ahead > 0) mode = "push";

  ico.innerHTML = svg[mode];
  count.hidden = true;
  if (mode === "publish") { label.textContent = "Publish branch"; sub.textContent = "This branch is not on the remote yet"; }
  else if (mode === "pull") { label.textContent = "Pull origin"; sub.textContent = relFetched(r.lastFetched); count.hidden = false; count.textContent = "↓ " + r.behind; }
  else if (mode === "push") { label.textContent = "Push origin"; sub.textContent = relFetched(r.lastFetched); count.hidden = false; count.textContent = "↑ " + r.ahead; }
  else { label.textContent = "Fetch origin"; sub.textContent = relFetched(r.lastFetched); }
  $("syncCell").dataset.mode = mode;
}
function relFetched(d) {
  if (!d) return "Never fetched";
  const t = new Date(d).getTime();
  if (isNaN(t)) return "Last fetched recently";
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return "Last fetched just now";
  if (mins < 60) return "Last fetched " + mins + "m ago";
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return "Last fetched " + hrs + "h ago";
  return "Last fetched " + Math.round(hrs / 24) + "d ago";
}

$("syncCell").onclick = () => {
  const mode = $("syncCell").dataset.mode;
  if (mode === "publish") post("publish");
  else if (mode === "pull") post("pull");
  else if (mode === "push") post("push");
  else post("fetch");
};

/* ---------- tabs ---------- */
document.querySelectorAll(".tab").forEach((btn) => {
  btn.onclick = () => {
    state.tab = btn.dataset.tab;
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("is-active", b === btn));
    $("pane-changes").hidden = state.tab !== "changes";
    $("pane-history").hidden = state.tab !== "history";
  };
});

/* ---------- changed files ---------- */
function fileParts(p) {
  const i = p.lastIndexOf("/");
  return i < 0 ? { dir: "", name: p } : { dir: p.slice(0, i + 1), name: p.slice(i + 1) };
}
function statusLetter(st) {
  const s = (st || "").replace(/\s/g, "");
  if (s.indexOf("D") >= 0) return "D";
  if (s.indexOf("A") >= 0 || s === "??" || s.indexOf("?") >= 0) return "A";
  if (s.indexOf("R") >= 0) return "R";
  if (s.indexOf("U") >= 0 || s.indexOf("C") >= 0) return "C";
  return "M";
}
function visibleChanges() {
  const f = state.filter.trim().toLowerCase();
  return state.changes.filter((c) => !f || c.path.toLowerCase().indexOf(f) >= 0);
}
function renderChanges() {
  const list = $("fileList");
  const vis = visibleChanges();
  $("changesBadge").textContent = state.changes.length;
  $("noChanges").hidden = state.changes.length > 0;
  $("commitBox").style.display = state.changes.length > 0 ? "" : "none";
  $("allRow").style.display = state.changes.length > 0 ? "" : "none";
  $("filterWrap").style.display = state.changes.length > 0 ? "" : "none";

  const n = state.selectedFiles.size;
  $("allText").textContent = n + " of " + state.changes.length + " file" + (state.changes.length === 1 ? "" : "s") + " to commit";
  $("allCheck").checked = state.changes.length > 0 && n === state.changes.length;
  $("allCheck").indeterminate = n > 0 && n < state.changes.length;

  list.innerHTML = "";
  for (const c of vis) {
    const parts = fileParts(c.path);
    const L = statusLetter(c.status);
    const row = document.createElement("div");
    row.className = "file-row" + (state.selectedPath === c.path ? " is-selected" : "");
    row.innerHTML =
      '<input type="checkbox" ' + (state.selectedFiles.has(c.path) ? "checked" : "") + '>' +
      '<span class="status-sq st-' + L + '">' + L + '</span>' +
      '<span class="file-name"><span class="file-dir">' + esc(parts.dir) + '</span>' + esc(parts.name) + '</span>' +
      '<button class="file-x" title="Discard changes" type="button">×</button>';
    const cb = row.querySelector("input");
    cb.onclick = (e) => {
      e.stopPropagation();
      if (cb.checked) state.selectedFiles.add(c.path); else state.selectedFiles.delete(c.path);
      renderChanges();
    };
    row.querySelector(".file-x").onclick = (e) => {
      e.stopPropagation();
      post("discardFiles", { files: [c.path] });
    };
    row.onclick = () => selectFile(c.path);
    list.appendChild(row);
  }
  updateCommitBtn();
}
function selectFile(p) {
  state.selectedPath = p;
  state.selectedCommit = null;
  renderChanges();
  $("diffHeader").hidden = false;
  $("diffPath").textContent = p;
  $("diffBody").innerHTML = '<div class="diff-meta" style="padding:8px">Loading…</div>';
  post("getWorkingDiff", { filePath: p });
}
$("allCheck").onclick = () => {
  if ($("allCheck").checked) state.changes.forEach((c) => state.selectedFiles.add(c.path));
  else state.selectedFiles.clear();
  renderChanges();
};
$("filter").oninput = (e) => { state.filter = e.target.value; renderChanges(); };

/* ---------- commit ---------- */
function updateCommitBtn() {
  const ok = state.selectedFiles.size > 0 && $("summary").value.trim().length > 0;
  const btn = $("commitBtn");
  btn.disabled = !ok;
  const n = state.selectedFiles.size;
  btn.innerHTML = "Commit " + (n > 0 ? n + " file" + (n === 1 ? "" : "s") + " " : "") +
    "to <strong>" + esc(state.currentBranch || "branch") + "</strong>";
}
$("summary").oninput = updateCommitBtn;
function doCommit() {
  const summary = $("summary").value.trim();
  if (!summary || state.selectedFiles.size === 0) return;
  const desc = $("description").value.trim();
  const message = desc ? summary + "\n\n" + desc : summary;
  post("commitFiles", { message: message, files: Array.from(state.selectedFiles) });
  $("summary").value = ""; $("description").value = "";
  state.selectedFiles.clear();
  updateCommitBtn();
}
$("commitBtn").onclick = doCommit;
["summary", "description"].forEach((id) => {
  $(id).addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); doCommit(); }
  });
});

/* ---------- history ---------- */
function renderHistory() {
  const list = $("commitList");
  $("noHistory").hidden = state.history.length > 0;
  list.innerHTML = "";
  for (const c of state.history) {
    const row = document.createElement("div");
    row.className = "commit-row" + (state.selectedCommit === c.hash ? " is-selected" : "");
    row.innerHTML =
      '<div class="commit-msg">' + esc((c.message || "").split("\n")[0]) + "</div>" +
      '<div class="commit-meta">' + (c.isPushed === false ? '<span class="unpushed-dot"></span>' : "") +
      esc(c.authorName || c.author || "") + " · " + esc(c.relativeTime || "") + "</div>";
    row.onclick = () => {
      state.selectedCommit = c.hash;
      state.selectedPath = null;
      renderHistory();
      post("openCommitDetail", { hash: c.hash });
    };
    list.appendChild(row);
  }
}

/* ---------- diff rendering ---------- */
function renderDiff(text) {
  const body = $("diffBody");
  if (!text || !text.trim()) {
    body.innerHTML = '<div class="diff-meta" style="padding:8px">No textual changes (binary file or whitespace only).</div>';
    return;
  }
  const lines = text.split("\n");
  let out = "";
  let oldNo = 0, newNo = 0;
  for (const raw of lines) {
    let cls = "", gutter = "";
    if (raw.indexOf("@@") === 0) {
      const m = raw.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (m) { oldNo = +m[1]; newNo = +m[2]; }
      cls = "diff-hunk";
    } else if (/^(diff |index |--- |\+\+\+ |new file|deleted file|similarity |rename )/.test(raw)) {
      cls = "diff-meta";
    } else if (raw.charAt(0) === "+") {
      cls = "diff-add"; gutter = "+" + (newNo++);
    } else if (raw.charAt(0) === "-") {
      cls = "diff-del"; gutter = "-" + (oldNo++);
    } else {
      gutter = String(newNo); oldNo++; newNo++;
    }
    out += '<div class="diff-line ' + cls + '"><span class="diff-gutter">' + esc(gutter) +
      '</span><span class="diff-text">' + esc(raw || " ") + "</span></div>";
  }
  body.innerHTML = out;
  body.scrollTop = 0;
}

/* ---------- dropdown menus ---------- */
const menu = $("menu");
function closeMenu() { menu.hidden = true; menu.innerHTML = ""; document.removeEventListener("mousedown", onDocDown, true); }
function onDocDown(e) { if (!menu.contains(e.target)) closeMenu(); }
function openMenu(anchor, build) {
  menu.innerHTML = ""; build(menu);
  menu.hidden = false;
  const r = anchor.getBoundingClientRect();
  menu.style.visibility = "hidden";
  requestAnimationFrame(() => {
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    let x = r.left, y = r.bottom + 2;
    if (x + mw > window.innerWidth - 8) x = window.innerWidth - 8 - mw;
    if (y + mh > window.innerHeight - 8) y = Math.max(8, r.top - 2 - mh);
    menu.style.left = Math.max(8, x) + "px";
    menu.style.top = Math.max(8, y) + "px";
    menu.style.visibility = "";
  });
  setTimeout(() => document.addEventListener("mousedown", onDocDown, true), 0);
}

$("branchCell").onclick = () => {
  openMenu($("branchCell"), (m) => {
    const filter = document.createElement("input");
    filter.className = "menu-filter"; filter.placeholder = "Find a branch…";
    m.appendChild(filter);
    const holder = document.createElement("div");
    m.appendChild(holder);
    const draw = () => {
      const q = filter.value.trim().toLowerCase();
      holder.innerHTML = "";
      const items = state.branches.filter((b) => !q || b.toLowerCase().indexOf(q) >= 0);
      if (!items.length) { holder.innerHTML = '<div class="menu-empty">No branches</div>'; return; }
      for (const b of items) {
        const it = document.createElement("div");
        it.className = "menu-item" + (b === state.currentBranch ? " is-current" : "");
        it.textContent = b + (b === state.currentBranch ? "  (current)" : "");
        it.onclick = () => { closeMenu(); if (b !== state.currentBranch) post("checkoutBranch", { branch: b }); };
        holder.appendChild(it);
      }
    };
    filter.oninput = draw; draw();
    setTimeout(() => filter.focus(), 0);
  });
};

$("repoCell").onclick = () => {
  openMenu($("repoCell"), (m) => {
    const it = document.createElement("div");
    it.className = "menu-item is-current";
    it.textContent = state.repository ? state.repository.path : "No repository open";
    m.appendChild(it);
  });
};

/* ---------- inbound messages ---------- */
window.addEventListener("message", (ev) => {
  const msg = ev.data || {};
  switch (msg.command || msg.type) {
    case "updateChanges": {
      state.changes = msg.changes || [];
      const paths = new Set(state.changes.map((c) => c.path));
      if (state.selectedFiles.size === 0) state.changes.forEach((c) => state.selectedFiles.add(c.path));
      else state.selectedFiles = new Set(Array.from(state.selectedFiles).filter((p) => paths.has(p)));
      if (state.selectedPath && !paths.has(state.selectedPath)) {
        state.selectedPath = null;
        $("diffHeader").hidden = true;
        $("diffBody").innerHTML = '<div class="empty-block"><div class="empty-title">No file selected</div></div>';
      }
      renderChanges();
      break;
    }
    case "updateHistory":
      state.history = msg.history || [];
      renderHistory();
      break;
    case "updateBranches":
      state.branches = msg.branches || [];
      state.currentBranch = msg.currentBranch || null;
      state.branchActivity = msg.branchActivity || {};
      renderToolbar(); updateCommitBtn();
      break;
    case "updateRepository":
      state.repository = msg.repository || null;
      renderToolbar(); setAvatar();
      break;
    case "updateRemoteStatus":
      state.remote = msg.remoteStatus || null;
      renderToolbar();
      break;
    case "workingDiff":
      if (msg.payload && msg.payload.path === state.selectedPath) renderDiff(msg.payload.diff);
      break;
    case "fileDiff":
      if (msg.payload) renderDiff(msg.payload.diff);
      break;
    case "error":
      if (state.selectedPath) $("diffBody").innerHTML = '<div class="diff-meta" style="padding:8px">' + esc(msg.message || "Error") + "</div>";
      break;
  }
});

/* ---------- avatar ---------- */
function setAvatar() {
  const s = (state.repository && state.repository.name) || "?";
  $("avatar").textContent = s.slice(0, 2);
}
setAvatar();
renderToolbar();
post("ready");
`;
