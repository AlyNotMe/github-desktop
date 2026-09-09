import * as path from "path";
import { promises as fs } from "fs";
import * as vscode from "vscode";
import simpleGit from "simple-git";
import { RepositoryManager } from "../../../core/repositories/repository-manager";
import { getPrimaryRepository } from "../../../shared/utils/repo-selection";
import { TrackedRepository } from "../../../shared/types";
import { OutboundMessage } from "../messages";
import { Browser, Notifier, RepositoryContext, WebviewChannel } from "../ports";

/**
 * @description {@link RepositoryContext} backed by the extension's
 * {@link RepositoryManager} and the VS Code workspace. Holds an in-memory
 * "active repository" override so the user can switch repos from the picker
 * without changing the VS Code workspace folder.
 */
export class WorkspaceRepositoryContext implements RepositoryContext {
  private activePath: string | undefined;

  constructor(private readonly repositories: RepositoryManager) {}

  getPrimary(): TrackedRepository | undefined {
    if (this.activePath) {
      const pinned = this.repositories.findByPath(this.activePath);
      if (pinned) {
        return pinned;
      }
    }
    return getPrimaryRepository(this.repositories);
  }

  list(): TrackedRepository[] {
    return this.repositories.getRepositories();
  }

  setActive(localPath: string): void {
    this.activePath = localPath;
  }

  async addLocal(): Promise<void> {
    const picked = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: "Add repository",
    });
    const folder = picked?.[0]?.fsPath;
    if (!folder) {
      return;
    }
    if (!(await exists(path.join(folder, ".git")))) {
      void vscode.window.showErrorMessage(
        "That folder is not a git repository.",
      );
      return;
    }
    let owner = "local";
    let name = path.basename(folder);
    let remoteUrl: string | undefined;
    try {
      const remotes = await simpleGit(folder).getRemotes(true);
      const origin = remotes.find((r) => r.name === "origin") ?? remotes[0];
      remoteUrl = origin?.refs.fetch ?? origin?.refs.push;
      const m = remoteUrl?.match(/[/:]([^/]+)\/([^/]+?)(?:\.git)?$/);
      if (m) {
        owner = m[1];
        name = m[2];
      }
    } catch {
      // keep folder-name defaults
    }
    await this.repositories.addRepository({
      localPath: folder,
      owner,
      name,
      remoteUrl,
    });
    this.setActive(folder);
  }

  async clone(): Promise<void> {
    await vscode.commands.executeCommand("githubDesktop.cloneRepository");
  }
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * @description {@link Notifier} backed by `vscode.window`.
 */
export class VsCodeNotifier implements Notifier {
  info(message: string): void {
    void vscode.window.showInformationMessage(message);
  }

  warn(message: string): void {
    void vscode.window.showWarningMessage(message);
  }

  error(message: string): void {
    void vscode.window.showErrorMessage(message);
  }

  async confirm(message: string, confirmLabel: string): Promise<boolean> {
    const choice = await vscode.window.showWarningMessage(
      message,
      { modal: true },
      confirmLabel,
    );
    return choice === confirmLabel;
  }

  async prompt(options: {
    prompt: string;
    placeHolder?: string;
    validateInput?: (value: string) => string | null;
  }): Promise<string | undefined> {
    const value = await vscode.window.showInputBox({
      prompt: options.prompt,
      placeHolder: options.placeHolder,
      ignoreFocusOut: true,
      validateInput: options.validateInput,
    });
    return value?.trim() || undefined;
  }
}

/**
 * @description {@link Browser} backed by `vscode.env.openExternal`.
 */
export class VsCodeBrowser implements Browser {
  open(url: string): void {
    void vscode.env.openExternal(vscode.Uri.parse(url));
  }
}

/**
 * @description {@link WebviewChannel} backed by a concrete `vscode.Webview`.
 */
export class VsCodeWebviewChannel implements WebviewChannel {
  constructor(private readonly webview: vscode.Webview) {}

  post(message: OutboundMessage): void {
    void this.webview.postMessage(message);
  }
}
