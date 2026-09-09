import { TrackedRepository } from "../../shared/types";
import { OutboundMessage } from "./messages";

/**
 * @description Resolves which repository the timeline currently operates on.
 * Abstracts {@link getPrimaryRepository} so services never touch the
 * repository manager or the VS Code workspace API directly.
 */
export interface RepositoryContext {
  /** The active repository, or `undefined` when there is none. */
  getPrimary(): TrackedRepository | undefined;
  /** Every tracked repository, for the repository picker. */
  list(): TrackedRepository[];
  /** Sets the active repository for this session (in-memory override). */
  setActive(localPath: string): void;
  /** Prompts for a local folder and tracks it as a repository. */
  addLocal(): Promise<void>;
  /** Runs the "clone repository" flow. */
  clone(): Promise<void>;
}

/**
 * @description Thin abstraction over the user-facing notification surface
 * (`vscode.window.*`). Keeps services free of the `vscode` namespace and
 * trivially mockable in tests.
 */
export interface Notifier {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;

  /**
   * Asks the user to confirm a destructive action.
   *
   * @param message - The question to display (modal)
   * @param confirmLabel - Label of the confirming button
   * @returns `true` only when the user picked the confirming button
   */
  confirm(message: string, confirmLabel: string): Promise<boolean>;

  /**
   * Prompts the user for a single line of text.
   *
   * @returns The trimmed input, or `undefined` when cancelled
   */
  prompt(options: {
    prompt: string;
    placeHolder?: string;
    validateInput?: (value: string) => string | null;
  }): Promise<string | undefined>;
}

/**
 * @description Outbound half of the webview message channel. Services push
 * {@link OutboundMessage}s; they never receive through this port.
 */
export interface WebviewChannel {
  post(message: OutboundMessage): void;
}

/**
 * @description Opens URLs in the user's external browser.
 */
export interface Browser {
  open(url: string): void;
}

/**
 * @description Triggers a full recompute-and-broadcast of the timeline state.
 * Mutating services call this after a successful operation instead of pushing
 * partial updates themselves.
 */
export interface Refresher {
  refresh(): Promise<void>;
}
