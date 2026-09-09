import * as vscode from "vscode";
import { RepositoryManager } from "../../../core/repositories/repository-manager";
import { getPrimaryRepository } from "../../../shared/utils/repo-selection";
import { TrackedRepository } from "../../../shared/types";
import { OutboundMessage } from "../messages";
import { Browser, Notifier, RepositoryContext, WebviewChannel } from "../ports";

/**
 * @description {@link RepositoryContext} backed by the extension's
 * {@link RepositoryManager} and the VS Code workspace.
 */
export class WorkspaceRepositoryContext implements RepositoryContext {
  constructor(private readonly repositories: RepositoryManager) {}

  getPrimary(): TrackedRepository | undefined {
    return getPrimaryRepository(this.repositories);
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
