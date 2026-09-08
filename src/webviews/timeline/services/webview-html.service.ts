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
  <button class="cell" id="repoCell" type="button" title="Current repository">
    <span class="cell-ico">${ICON.repo}</span>
    <span class="cell-value" id="repoName">&mdash;</span>
    <span class="cell-caret">${ICON.caret}</span>
  </button>
  <button class="cell" id="branchCell" type="button" title="Current branch">
    <span class="cell-ico">${ICON.branch}</span>
    <span class="cell-value" id="branchName">&mdash;</span>
    <span class="cell-caret">${ICON.caret}</span>
  </button>
  <button class="cell" id="syncCell" type="button">
    <span class="cell-ico" id="syncIco">${ICON.fetch}</span>
    <span class="cell-value" id="syncLabel">Fetch origin</span>
    <span class="cell-label" id="syncSub" hidden></span>
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
      <div id="conflictBar" hidden>
        <div id="conflictText"></div>
        <div id="conflictActions">
          <button id="conflictAbort" type="button">Abort</button>
          <button id="conflictContinue" type="button">Continue</button>
        </div>
      </div>
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
        <input id="coAuthors" type="text" hidden autocomplete="off"
          placeholder="Co-authors: @handle, Name &lt;email&gt;">
        <div id="commitMeta">
          <label id="amendRow"><input type="checkbox" id="amendCheck"> Amend last commit</label>
          <button id="coAuthToggle" type="button" class="linklike">Add co-authors</button>
        </div>
        <button id="commitBtn" type="button" disabled>Commit to <strong id="commitBranch">branch</strong></button>
      </div>
    </div>

    <div class="tabpane" id="pane-history" hidden>
      <div id="undoBar" hidden>
        <span id="undoText">Undo last commit</span>
        <button id="undoBtn" type="button">Undo</button>
      </div>
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
[hidden] { display: none !important; }
:root {
  color-scheme: light dark;
  --gd-accent: var(--vscode-button-background, #1f6feb);
  --gd-accent-fg: var(--vscode-button-foreground, #fff);
  --gd-chrome: var(--vscode-sideBarSectionHeader-background, var(--vscode-sideBar-background));
  --gd-border: var(--vscode-panel-border, rgba(128,128,128,.28));
  --gd-radius: 6px;
}
html, body { height: 100%; }
body {
  display: flex; flex-direction: column;
  font-family: var(--vscode-font-family, -apple-system, "Segoe UI", system-ui, sans-serif);
  font-size: 12px; line-height: 1.4;
  color: var(--vscode-foreground);
  background: var(--vscode-sideBar-background);
  overflow: hidden;
}
button, input, textarea { font: inherit; color: inherit; }
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-thumb { background: var(--vscode-scrollbarSlider-background); border-radius: 5px; background-clip: padding-box; border: 2px solid transparent; }
::-webkit-scrollbar-thumb:hover { background: var(--vscode-scrollbarSlider-hoverBackground); }

/* ---- toolbar ---- */
#toolbar {
  display: flex; flex: 0 0 auto; height: 32px;
  background: var(--gd-chrome);
  border-bottom: 1px solid var(--gd-border);
}
.cell {
  display: flex; align-items: center; gap: 6px;
  flex: 1 1 0; min-width: 0; padding: 0 9px;
  background: transparent; border: 0;
  border-right: 1px solid var(--gd-border);
  cursor: pointer; text-align: left;
}
.cell:last-child { border-right: 0; }
.cell:hover { background: var(--vscode-list-hoverBackground); }
.cell:active { background: var(--vscode-list-activeSelectionBackground); }
.cell-ico { flex: 0 0 auto; display: flex; opacity: .8; }
.cell-ico svg { width: 14px; height: 14px; }
.cell-label { display: none; }
.cell-value {
  flex: 1 1 auto; font-weight: 600; font-size: 11px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.cell-caret { flex: 0 0 auto; opacity: .5; }
.cell-caret svg { width: 10px; height: 10px; }
.cell-count {
  flex: 0 0 auto; display: inline-flex; align-items: center; gap: 2px;
  font-size: 10px; font-weight: 600; padding: 0 5px; border-radius: 9px;
  background: var(--vscode-badge-background); color: var(--vscode-badge-foreground);
}

/* ---- body split ---- */
#body { flex: 1 1 auto; display: flex; min-height: 0; }
#left {
  flex: 0 0 300px; display: flex; flex-direction: column; min-height: 0;
  background: var(--vscode-sideBar-background);
  border-right: 1px solid var(--gd-border);
}
#body.no-diff #left { flex: 1 1 auto; border-right: 0; }
#right { flex: 1 1 auto; display: flex; flex-direction: column; min-width: 0; background: var(--vscode-editor-background); }

/* ---- tabs ---- */
#tabs { display: flex; flex: 0 0 auto; background: var(--gd-chrome); border-bottom: 1px solid var(--gd-border); }
.tab {
  flex: 1 1 0; height: 41px; background: transparent; border: 0;
  border-bottom: 2px solid transparent; cursor: pointer; font-size: 12px;
  color: var(--vscode-descriptionForeground); font-weight: 500;
  display: flex; align-items: center; justify-content: center; gap: 6px;
}
.tab:hover { color: var(--vscode-foreground); }
.tab.is-active { color: var(--vscode-foreground); border-bottom-color: var(--gd-accent); }
.badge {
  font-size: 10px; font-weight: 600; min-width: 16px; padding: 1px 5px; border-radius: 9px;
  background: var(--vscode-badge-background); color: var(--vscode-badge-foreground);
}
.tabpane { flex: 1 1 auto; display: flex; flex-direction: column; min-height: 0; overflow: hidden; }

/* ---- changed files ---- */
#filterWrap { flex: 0 0 auto; padding: 8px 10px 4px; }
#filter {
  width: 100%; padding: 5px 8px; border-radius: var(--gd-radius); font-size: 12px;
  background: var(--vscode-input-background); color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border, var(--gd-border));
}
#filter:focus { outline: 0; border-color: var(--vscode-focusBorder); }
#allRow {
  flex: 0 0 auto; display: flex; align-items: center; gap: 8px;
  padding: 6px 12px; font-size: 11px; color: var(--vscode-descriptionForeground);
  cursor: pointer;
}
#allRow input, .file-row input[type=checkbox] { width: 13px; height: 13px; accent-color: var(--gd-accent); cursor: pointer; }
#fileList { flex: 1 1 0; overflow-y: auto; overflow-x: hidden; min-height: 0; }
.file-row {
  display: flex; align-items: center; gap: 8px; height: 28px; padding: 0 12px; cursor: pointer;
  white-space: nowrap; font-size: 12px;
}
.file-row:hover { background: var(--vscode-list-hoverBackground); }
.file-row.is-selected { background: var(--vscode-list-inactiveSelectionBackground); }
.file-name { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; }
.file-dir { opacity: .55; }
.status-sq {
  flex: 0 0 auto; width: 16px; height: 16px; border-radius: 3px;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700; line-height: 1; color: #fff;
}
.st-M { background: var(--vscode-gitDecoration-modifiedResourceForeground, #d0a215); }
.st-A, .st-U { background: var(--vscode-gitDecoration-untrackedResourceForeground, #2ea043); }
.st-D { background: var(--vscode-gitDecoration-deletedResourceForeground, #d73a49); }
.st-R { background: var(--vscode-gitDecoration-renamedResourceForeground, #8250df); }
.st-C { background: var(--vscode-gitDecoration-conflictingResourceForeground, #e4676b); }
.file-x {
  flex: 0 0 auto; opacity: 0; width: 18px; height: 18px; border: 0; border-radius: 4px;
  background: transparent; cursor: pointer; color: inherit; font-size: 14px; line-height: 1;
}
.file-row:hover .file-x { opacity: .6; }
.file-x:hover { opacity: 1; background: var(--vscode-toolbar-hoverBackground, rgba(128,128,128,.2)); }

/* ---- commit box ---- */
#commitBox {
  flex: 0 0 auto; padding: 8px; border-top: 1px solid var(--gd-border);
  display: flex; flex-direction: column; gap: 6px;
  background: var(--gd-chrome);
}
.commit-summary { display: flex; align-items: center; gap: 8px; }
.avatar {
  flex: 0 0 auto; width: 28px; height: 28px; border-radius: 50%; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  background: var(--gd-accent); color: var(--gd-accent-fg);
}
.avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
#summary, #description {
  width: 100%; padding: 6px 9px; border-radius: var(--gd-radius); font-size: 12px;
  background: var(--vscode-input-background); color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border, var(--gd-border));
}
#summary { font-weight: 600; }
#summary:focus, #description:focus { outline: 0; border-color: var(--vscode-focusBorder); }
#description { resize: vertical; min-height: 44px; max-height: 140px; }
#commitBtn {
  width: 100%; padding: 8px 12px; border: 0; border-radius: var(--gd-radius); cursor: pointer;
  font-size: 12px; font-weight: 600;
  background: var(--gd-accent); color: var(--gd-accent-fg);
}
#commitBtn:hover:not(:disabled) { background: var(--vscode-button-hoverBackground, var(--gd-accent)); filter: brightness(1.08); }
#commitBtn:disabled { opacity: .45; cursor: default; }
#commitBtn strong { font-weight: 700; }

/* ---- history ---- */
#commitList { flex: 1 1 auto; overflow: auto; min-height: 0; }
.commit-row {
  display: flex; flex-direction: column; gap: 3px; padding: 9px 12px; cursor: pointer;
  border-bottom: 1px solid var(--gd-border);
}
.commit-row:hover { background: var(--vscode-list-hoverBackground); }
.commit-row.is-selected { background: var(--vscode-list-inactiveSelectionBackground); box-shadow: inset 2px 0 0 var(--gd-accent); }
.commit-msg { font-weight: 500; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.commit-meta { font-size: 11px; color: var(--vscode-descriptionForeground); display: flex; align-items: center; gap: 6px; }
.unpushed-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--gd-accent); flex: 0 0 auto; }

/* ---- diff ---- */
#diffHeader {
  flex: 0 0 auto; padding: 9px 14px; font-size: 12px; font-weight: 600;
  background: var(--gd-chrome);
  border-bottom: 1px solid var(--gd-border);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
#diffBody {
  flex: 1 1 auto; overflow: auto; min-height: 0;
  background: var(--vscode-editor-background);
  font-family: var(--vscode-editor-font-family, ui-monospace, "SF Mono", Menlo, monospace);
  font-size: var(--vscode-editor-font-size, 12px); line-height: 1.5;
}
.diff-line { display: flex; white-space: pre; }
.diff-gutter {
  flex: 0 0 auto; width: 46px; padding: 0 8px; text-align: right;
  color: var(--vscode-editorLineNumber-foreground); opacity: .6;
  user-select: none;
}
.diff-text { flex: 1 1 auto; padding: 0 10px; }
.diff-add { background: var(--vscode-diffEditor-insertedTextBackground, rgba(46,160,67,.15)); }
.diff-add .diff-gutter { background: var(--vscode-diffEditor-insertedLineBackground, rgba(46,160,67,.1)); }
.diff-del { background: var(--vscode-diffEditor-removedTextBackground, rgba(248,81,73,.15)); }
.diff-del .diff-gutter { background: var(--vscode-diffEditor-removedLineBackground, rgba(248,81,73,.1)); }
.diff-hunk { color: var(--vscode-descriptionForeground); background: var(--vscode-editor-inactiveSelectionBackground); }
.diff-meta { color: var(--vscode-descriptionForeground); }

/* ---- empty states ---- */
.empty-block {
  flex: 1 1 auto; display: flex; flex-direction: column; align-items: center;
  justify-content: center; text-align: center; padding: 32px; gap: 10px;
}
.empty-emoji { opacity: .35; }
.empty-emoji svg { width: 48px; height: 48px; }
.empty-title { font-size: 15px; font-weight: 400; color: var(--vscode-foreground); }
.empty-sub { font-size: 12px; color: var(--vscode-descriptionForeground); max-width: 260px; line-height: 1.5; }

/* ---- popup menu ---- */
.menu {
  position: fixed; z-index: 50; min-width: 240px; max-height: 66vh; overflow: auto;
  background: var(--vscode-menu-background, var(--vscode-dropdown-background, var(--gd-chrome)));
  border: 1px solid var(--vscode-menu-border, var(--gd-border));
  border-radius: 8px; box-shadow: 0 8px 28px rgba(0,0,0,.45); padding: 5px;
}
.menu input.menu-filter {
  width: 100%; margin-bottom: 4px; padding: 6px 8px; border-radius: var(--gd-radius);
  background: var(--vscode-input-background); color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border, var(--gd-border));
}
.menu input.menu-filter:focus { outline: 0; border-color: var(--vscode-focusBorder); }
.menu-item {
  display: flex; align-items: center; gap: 8px; padding: 6px 9px; border-radius: var(--gd-radius);
  cursor: pointer; white-space: nowrap; font-size: 12px;
}
.menu-item:hover { background: var(--vscode-list-hoverBackground); }
.menu-item.is-current { color: var(--vscode-descriptionForeground); }
.menu-sep { height: 1px; margin: 5px 4px; background: var(--gd-border); }
.menu-empty { padding: 7px 9px; color: var(--vscode-descriptionForeground); font-size: 12px; }
.menu-item.is-danger { color: var(--vscode-errorForeground, #f14c4c); }
.menu-btn {
  flex: 1 1 0; padding: 6px 8px; border: 0; border-radius: var(--gd-radius); cursor: pointer; font-size: 11px; font-weight: 600;
  background: var(--vscode-button-secondaryBackground, var(--gd-accent));
  color: var(--vscode-button-secondaryForeground, var(--gd-accent-fg));
}
.menu-btn:hover { background: var(--vscode-button-hoverBackground); }
.load-more {
  width: 100%; padding: 9px; border: 0; background: transparent; cursor: pointer;
  color: var(--vscode-textLink-foreground); font-size: 12px;
}
.load-more:hover:not(:disabled) { background: var(--vscode-list-hoverBackground); }
#conflictBar {
  flex: 0 0 auto; padding: 8px 12px; font-size: 11px; line-height: 1.45;
  display: flex; flex-direction: column; gap: 6px;
  background: var(--vscode-inputValidation-warningBackground, rgba(228,103,107,.15));
  border-bottom: 1px solid var(--vscode-inputValidation-warningBorder, #e4676b);
}
#conflictActions { display: flex; gap: 6px; }
#conflictActions button {
  flex: 1 1 0; padding: 5px 8px; border: 0; border-radius: var(--gd-radius);
  cursor: pointer; font-size: 11px; font-weight: 600;
  background: var(--vscode-button-secondaryBackground, rgba(128,128,128,.25));
  color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
}
#conflictContinue { background: var(--gd-accent); color: var(--gd-accent-fg); }
#conflictActions button:disabled { opacity: .45; cursor: default; }

/* ---- commit meta (amend / co-authors) ---- */
#commitMeta { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
#amendRow { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--vscode-descriptionForeground); cursor: pointer; }
#amendRow input { width: 13px; height: 13px; accent-color: var(--gd-accent); }
.linklike { border: 0; background: transparent; cursor: pointer; font-size: 11px; color: var(--vscode-textLink-foreground); padding: 0; }
.linklike:hover { text-decoration: underline; }
#coAuthors {
  width: 100%; padding: 6px 9px; border-radius: var(--gd-radius); font-size: 12px;
  background: var(--vscode-input-background); color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border, var(--gd-border));
}
#coAuthors:focus { outline: 0; border-color: var(--vscode-focusBorder); }

/* ---- undo bar ---- */
#undoBar {
  flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between;
  gap: 8px; padding: 7px 12px; font-size: 11px;
  background: var(--gd-chrome); border-bottom: 1px solid var(--gd-border);
}
#undoText { color: var(--vscode-descriptionForeground); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#undoBtn {
  flex: 0 0 auto; padding: 4px 12px; border: 1px solid var(--gd-border); border-radius: var(--gd-radius);
  background: transparent; color: var(--vscode-foreground); cursor: pointer; font-size: 11px; font-weight: 600;
}
#undoBtn:hover { background: var(--vscode-list-hoverBackground); }

.file-row.is-conflict .file-name { color: var(--vscode-errorForeground, #f14c4c); }
.file-resolve {
  flex: 0 0 auto; padding: 1px 7px; border: 1px solid var(--gd-border); border-radius: 10px;
  background: transparent; color: inherit; cursor: pointer; font-size: 10px;
}
.file-resolve:hover { background: var(--vscode-toolbar-hoverBackground, rgba(128,128,128,.2)); }
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
  account: null,
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
  hasMore: false,
  loadingMore: false,
  operation: null,
  conflicted: [],
  canUndo: false,
  lastCommitSummary: null,
  stashes: [],
  amend: false,
  coAuthors: "",
};

/* ---------- toolbar ---------- */
function renderToolbar() {
  $("repoName").textContent = state.repository ? state.repository.name : "No repository";
  $("branchName").textContent = state.currentBranch || "—";
  $("commitBranch").textContent = state.currentBranch || "branch";

  const r = state.remote || {};
  const ico = $("syncIco"), label = $("syncLabel"), count = $("syncCount"), cell = $("syncCell");
  const svg = { fetch: ${JSON.stringify(ICON.fetch)}, push: ${JSON.stringify(ICON.push)}, pull: ${JSON.stringify(ICON.pull)}, publish: ${JSON.stringify(ICON.publish)} };
  // Only claim "not published" when we positively know: a remote exists and
  // git reported no upstream. Anything uncertain (status not received yet)
  // defaults to Fetch rather than a misleading "Publish branch".
  let mode = "fetch";
  if (r.hasRemote === true && r.isPublished === false && r.ahead === 0 && r.behind === 0) mode = "publish";
  else if (r.behind > 0) mode = "pull";
  else if (r.ahead > 0) mode = "push";

  ico.innerHTML = svg[mode];
  count.hidden = true;
  const sub = $("syncSub");
  if (mode === "publish") { label.textContent = "Publish branch"; sub.textContent = "This branch is not on GitHub yet"; }
  else if (mode === "pull") { label.textContent = "Pull origin"; sub.textContent = relFetched(r.lastFetched); count.hidden = false; count.textContent = "↓ " + r.behind; }
  else if (mode === "push") { label.textContent = "Push origin"; sub.textContent = relFetched(r.lastFetched); count.hidden = false; count.textContent = "↑ " + r.ahead; }
  else { label.textContent = "Fetch origin"; sub.textContent = relFetched(r.lastFetched); }
  cell.title = sub.textContent;
  cell.dataset.mode = mode;
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
    renderUndoBar();
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
  const has = state.changes.length > 0;
  $("changesBadge").textContent = state.changes.length;
  $("noChanges").hidden = has;
  $("fileList").hidden = !has;
  // The commit box stays visible even with a clean tree so "Amend last commit"
  // is reachable (GitHub Desktop behaviour).
  $("commitBox").hidden = false;
  $("allRow").hidden = !has;
  $("filterWrap").hidden = !has;

  const n = state.selectedFiles.size;
  $("allText").textContent = n + " of " + state.changes.length + " file" + (state.changes.length === 1 ? "" : "s") + " to commit";
  $("allCheck").checked = state.changes.length > 0 && n === state.changes.length;
  $("allCheck").indeterminate = n > 0 && n < state.changes.length;

  list.innerHTML = "";
  for (const c of vis) {
    const parts = fileParts(c.path);
    const L = statusLetter(c.status);
    const isConflict = state.conflicted.indexOf(c.path) >= 0;
    const row = document.createElement("div");
    row.className = "file-row" + (state.selectedPath === c.path ? " is-selected" : "") + (isConflict ? " is-conflict" : "");
    row.innerHTML =
      '<input type="checkbox" ' + (state.selectedFiles.has(c.path) ? "checked" : "") + (isConflict ? " disabled" : "") + '>' +
      '<span class="status-sq st-' + (isConflict ? "C" : L) + '">' + (isConflict ? "C" : L) + '</span>' +
      '<span class="file-name"><span class="file-dir">' + esc(parts.dir) + '</span>' + esc(parts.name) + '</span>' +
      (isConflict
        ? '<button class="file-resolve" type="button">Mark resolved</button>'
        : '<button class="file-x" title="Discard changes" type="button">×</button>');
    const cb = row.querySelector("input");
    cb.onclick = (e) => {
      e.stopPropagation();
      if (isConflict) return;
      if (cb.checked) state.selectedFiles.add(c.path); else state.selectedFiles.delete(c.path);
      renderChanges();
    };
    if (isConflict) {
      row.querySelector(".file-resolve").onclick = (e) => { e.stopPropagation(); post("markResolved", { files: [c.path] }); };
    } else {
      row.querySelector(".file-x").onclick = (e) => { e.stopPropagation(); post("discardFiles", { files: [c.path] }); };
    }
    row.onclick = () => selectFile(c.path);
    list.appendChild(row);
  }
  updateCommitBtn();
}
function updateLayout() {
  const show = !!state.selectedPath;
  $("right").hidden = !show;
  $("body").classList.toggle("no-diff", !show);
}
function selectFile(p) {
  state.selectedPath = p;
  state.selectedCommit = null;
  renderChanges();
  updateLayout();
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
function coAuthorTrailers() {
  const raw = state.coAuthors.trim();
  if (!raw) return "";
  const parts = raw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
  const lines = parts.map((p) => {
    const m = p.match(/^(.*?)\s*<([^>]+)>$/);
    if (m) return "Co-Authored-By: " + m[1].trim() + " <" + m[2].trim() + ">";
    const h = p.replace(/^@/, "");
    return "Co-Authored-By: " + h + " <" + h + "@users.noreply.github.com>";
  });
  return lines.length ? "\n\n" + lines.join("\n") : "";
}
function updateCommitBtn() {
  const n = state.selectedFiles.size;
  const hasMsg = $("summary").value.trim().length > 0;
  const ok = hasMsg && (state.amend || n > 0);
  const btn = $("commitBtn");
  btn.disabled = !ok;
  if (state.amend) {
    btn.innerHTML = "Amend last commit" + (n > 0 ? " (+" + n + " file" + (n === 1 ? "" : "s") + ")" : "");
  } else {
    btn.innerHTML = "Commit " + (n > 0 ? n + " file" + (n === 1 ? "" : "s") + " " : "") +
      "to <strong>" + esc(state.currentBranch || "branch") + "</strong>";
  }
}
$("summary").oninput = updateCommitBtn;
function doCommit() {
  const summary = $("summary").value.trim();
  const n = state.selectedFiles.size;
  if (!summary || (!state.amend && n === 0)) return;
  const desc = $("description").value.trim();
  const message = summary + (desc ? "\n\n" + desc : "") + coAuthorTrailers();
  const files = Array.from(state.selectedFiles);
  post(state.amend ? "amendCommit" : "commitFiles", { message: message, files: files });
  $("commitBtn").disabled = true;
  // Inputs cleared only on the "commitSucceeded" ack.
}
$("commitBtn").onclick = doCommit;
["summary", "description", "coAuthors"].forEach((id) => {
  $(id).addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); doCommit(); }
  });
});
$("coAuthors").oninput = (e) => { state.coAuthors = e.target.value; };
$("coAuthToggle").onclick = () => {
  const el = $("coAuthors");
  el.hidden = !el.hidden;
  $("coAuthToggle").textContent = el.hidden ? "Add co-authors" : "Hide co-authors";
  if (!el.hidden) el.focus();
};
$("amendCheck").onchange = (e) => {
  state.amend = e.target.checked;
  if (state.amend && !$("summary").value.trim() && state.lastCommitSummary) {
    $("summary").value = state.lastCommitSummary;
  }
  updateCommitBtn();
};
$("undoBtn").onclick = () => post("undoLastCommit");
$("conflictAbort").onclick = () => post("abortOperation");
$("conflictContinue").onclick = () => post("continueOperation");

/* ---------- operation / undo bars ---------- */
function renderOperation() {
  const bar = $("conflictBar");
  if (!state.operation) { bar.hidden = true; return; }
  bar.hidden = false;
  const nc = state.conflicted.length;
  $("conflictText").textContent = nc > 0
    ? "⚠ " + state.operation + " paused — " + nc + " file(s) in conflict. Resolve each, then Continue."
    : "✔ All conflicts resolved. Click Continue to finish the " + state.operation + ".";
  $("conflictContinue").disabled = nc > 0;
  if (state.operation) { state.tab = "changes"; $("pane-changes").hidden = false; $("pane-history").hidden = true;
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("is-active", b.dataset.tab === "changes")); }
}
function renderUndoBar() {
  const show = state.tab === "history" && !state.operation && state.canUndo && !!state.lastCommitSummary;
  $("undoBar").hidden = !show;
  if (show) $("undoText").textContent = 'Undo "' + (state.lastCommitSummary || "") + '"';
}

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
    row.oncontextmenu = (e) => { e.preventDefault(); openCommitMenu(e.clientX, e.clientY, c); };
    list.appendChild(row);
  }
  if (state.hasMore) {
    const more = document.createElement("button");
    more.className = "load-more"; more.type = "button";
    more.textContent = state.loadingMore ? "Loading…" : "Load more commits";
    more.disabled = state.loadingMore;
    more.onclick = loadMore;
    list.appendChild(more);
  }
}
function loadMore() {
  if (state.loadingMore || !state.hasMore) return;
  state.loadingMore = true;
  renderHistory();
  post("loadMoreCommits", { offset: state.history.length });
}
$("commitList").addEventListener("scroll", () => {
  const el = $("commitList");
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) loadMore();
});

const COMMIT_MENU = [
  ["checkout", "Checkout this commit"],
  ["createBranch", "Create branch from commit…"],
  ["createTag", "Create tag…"],
  ["sep"],
  ["cherryPick", "Cherry-pick to current branch"],
  ["revert", "Revert this commit"],
  ["reset", "Reset current branch to here"],
  ["sep"],
  ["copySha", "Copy SHA"],
  ["viewOnGitHub", "View on GitHub"],
];
function openCommitMenu(x, y, commit) {
  openMenuAt(x, y, (m) => {
    for (const entry of COMMIT_MENU) {
      if (entry[0] === "sep") { const s = document.createElement("div"); s.className = "menu-sep"; m.appendChild(s); continue; }
      const it = document.createElement("div");
      it.className = "menu-item" + (entry[0] === "reset" ? " is-danger" : "");
      it.textContent = entry[1];
      it.onclick = () => { closeMenu(); runCommitAction(entry[0], commit); };
      m.appendChild(it);
    }
  });
}
function runCommitAction(action, commit) {
  const h = commit.hash;
  switch (action) {
    case "checkout": post("checkoutCommit", { hash: h }); break;
    case "createBranch": post("createBranchFromCommit", { hash: h }); break;
    case "createTag": post("createTagFromCommit", { hash: h }); break;
    case "cherryPick": post("cherryPickCommit", { hash: h }); break;
    case "revert": post("revertCommit", { hash: h }); break;
    case "reset": post("resetToCommit", { hash: h }); break;
    case "copySha": navigator.clipboard && navigator.clipboard.writeText(h); break;
    case "viewOnGitHub": post("viewCommitOnGitHub", { hash: h }); break;
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
function openMenuAt(x, y, build) {
  menu.innerHTML = ""; build(menu);
  menu.hidden = false;
  menu.style.visibility = "hidden";
  requestAnimationFrame(() => {
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    let nx = x, ny = y;
    if (nx + mw > window.innerWidth - 8) nx = window.innerWidth - 8 - mw;
    if (ny + mh > window.innerHeight - 8) ny = Math.max(8, window.innerHeight - 8 - mh);
    menu.style.left = Math.max(8, nx) + "px";
    menu.style.top = Math.max(8, ny) + "px";
    menu.style.visibility = "";
  });
  setTimeout(() => document.addEventListener("mousedown", onDocDown, true), 0);
}

$("branchCell").onclick = () => {
  openMenu($("branchCell"), (m) => {
    const mkAction = (label, fn) => {
      const it = document.createElement("div");
      it.className = "menu-item"; it.textContent = label;
      it.onclick = () => { closeMenu(); fn(); };
      m.appendChild(it);
    };
    mkAction("＋  New branch…", startNewBranch);
    if (state.currentBranch) mkAction("⇡  Create pull request…", () => post("createPullRequest", { branch: state.currentBranch }));
    if (state.changes.length > 0) mkAction("⇩  Stash all changes", () => post("stashPush", { message: "" }));
    for (const s of state.stashes) {
      const it = document.createElement("div");
      it.className = "menu-item";
      it.innerHTML = '<span style="flex:1;overflow:hidden;text-overflow:ellipsis">↤ ' + esc(s.message || ("stash@{" + s.index + "}")) + '</span>' +
        '<button class="file-resolve" data-a="pop">Pop</button><button class="file-resolve" data-a="drop">✕</button>';
      it.querySelector('[data-a=pop]').onclick = (e) => { e.stopPropagation(); closeMenu(); post("stashApply", { index: s.index, drop: true }); };
      it.querySelector('[data-a=drop]').onclick = (e) => { e.stopPropagation(); closeMenu(); post("stashDrop", { index: s.index }); };
      m.appendChild(it);
    }
    const sep = document.createElement("div"); sep.className = "menu-sep"; m.appendChild(sep);

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

function startNewBranch() {
  openMenu($("branchCell"), (m) => {
    const input = document.createElement("input");
    input.className = "menu-filter"; input.placeholder = "New branch name";
    m.appendChild(input);
    const dirty = state.changes.length > 0;
    const hint = document.createElement("div");
    hint.className = "menu-empty";
    hint.textContent = dirty
      ? "You have uncommitted changes — choose what to do:"
      : "Press Enter to create from " + (state.currentBranch || "HEAD");
    m.appendChild(hint);
    const submit = (bringChanges) => {
      const name = input.value.trim();
      if (!name) return;
      closeMenu();
      if (dirty) post("createBranchWithChanges", { branchName: name, bringChanges: bringChanges });
      else post("createBranch", { branchName: name });
    };
    if (dirty) {
      const row = document.createElement("div"); row.style.display = "flex"; row.style.gap = "4px"; row.style.padding = "4px";
      const a = document.createElement("button"); a.className = "menu-btn"; a.type = "button"; a.textContent = "Bring changes";
      a.onclick = () => submit(true);
      const b = document.createElement("button"); b.className = "menu-btn"; b.type = "button"; b.textContent = "Stash them";
      b.onclick = () => submit(false);
      row.appendChild(a); row.appendChild(b); m.appendChild(row);
    }
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submit(true); } });
    setTimeout(() => input.focus(), 0);
  });
}

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
      const prevPaths = new Set(state.changes.map((c) => c.path));
      state.changes = msg.changes || [];
      const paths = new Set(state.changes.map((c) => c.path));
      // Auto-check newly appeared files (GitHub Desktop checks everything by default),
      // keep the user's choices for files that were already listed.
      state.selectedFiles = new Set(
        Array.from(state.selectedFiles).filter((p) => paths.has(p)),
      );
      state.changes.forEach((c) => {
        if (!prevPaths.has(c.path)) state.selectedFiles.add(c.path);
      });
      if (state.selectedPath && !paths.has(state.selectedPath)) {
        state.selectedPath = null;
        $("diffHeader").hidden = true;
      }
      if (!state.changes.some((c) => /[UC]/.test(c.status || ""))) $("conflictBar").hidden = true;
      renderChanges();
      updateLayout();
      break;
    }
    case "updateHistory":
      state.history = msg.history || [];
      state.hasMore = !!msg.hasMoreCommits;
      state.loadingMore = false;
      renderHistory();
      break;
    case "loadMoreCommitsResponse": {
      const seen = new Set(state.history.map((c) => c.hash));
      state.history = state.history.concat((msg.history || []).filter((c) => !seen.has(c.hash)));
      state.hasMore = !!msg.hasMoreCommits;
      state.loadingMore = false;
      renderHistory();
      break;
    }
    case "commitSucceeded":
      $("summary").value = ""; $("description").value = ""; $("coAuthors").value = "";
      state.coAuthors = "";
      state.selectedFiles.clear();
      state.amend = false; $("amendCheck").checked = false;
      updateCommitBtn();
      break;
    case "mergeConflict":
      // Detailed state arrives via updateOperation on the following refresh;
      // this just flips to the Changes tab immediately.
      state.tab = "changes";
      $("pane-changes").hidden = false; $("pane-history").hidden = true;
      document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("is-active", b.dataset.tab === "changes"));
      break;
    case "updateOperation":
      state.operation = msg.operation || null;
      state.conflicted = msg.conflicted || [];
      state.canUndo = !!msg.canUndo;
      state.lastCommitSummary = msg.lastCommitSummary || null;
      renderOperation(); renderChanges(); renderUndoBar();
      break;
    case "updateStashes":
      state.stashes = msg.stashes || [];
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
    case "updateAccounts":
      state.account = msg.activeAccount || null;
      setAvatar();
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
  const a = state.account;
  const el = $("avatar");
  if (a && a.avatarUrl) {
    el.innerHTML = '<img alt="" src="' + esc(a.avatarUrl) + '">';
    el.title = a.login || "";
    return;
  }
  const s = (a && (a.name || a.login)) || (state.repository && state.repository.name) || "?";
  el.textContent = s.slice(0, 2);
  el.title = (a && a.login) || "";
}
setAvatar();
renderToolbar();
renderOperation();
renderUndoBar();
updateLayout();
post("ready");
`;
