import simpleGit, { SimpleGit } from "simple-git";
import { AccountManager } from "../accounts/account-manager";

/**
 * @description
 * Abstraction over the creation of `simple-git` clients. High-level services
 * depend on this port instead of importing `simpleGit` directly, which keeps
 * them testable (Dependency Inversion) and confines all credential handling to
 * a single place.
 */
export interface GitClientFactory {
  /**
   * A plain client with no credentials attached. Use for read-only or purely
   * local operations (status, log, checkout, merge, reset...).
   *
   * @param repoPath - Absolute path to the repository working directory
   */
  plain(repoPath: string): SimpleGit;

  /**
   * Runs `fn` with a client whose network operations carry the active GitHub
   * account's token.
   *
   * The token is injected through the `GIT_CONFIG_*` environment variables of
   * the spawned git process as an ephemeral `http.extraheader`. It is **never**
   * written to `.git/config`, so there is nothing to clean up and no shared
   * state to race on.
   *
   * If no account is active or no token is available, `fn` still runs with a
   * plain client (git may then fall back to a system credential helper).
   *
   * @param repoPath - Absolute path to the repository working directory
   * @param fn - Callback receiving the (possibly authenticated) client
   * @returns Whatever `fn` resolves to
   * @throws Propagates any error thrown by `fn`
   *
   * @example
   * await gitFactory.withAuth(repo.localPath, (git) => git.push(["-u", "origin", branch]));
   */
  withAuth<T>(repoPath: string, fn: (git: SimpleGit) => Promise<T>): Promise<T>;
}

/**
 * @description Default {@link GitClientFactory} backed by the extension's
 * {@link AccountManager}. Resolves the token of the currently active account.
 */
export class AccountGitClientFactory implements GitClientFactory {
  constructor(private readonly accounts: AccountManager) {}

  plain(repoPath: string): SimpleGit {
    return simpleGit(repoPath);
  }

  async withAuth<T>(
    repoPath: string,
    fn: (git: SimpleGit) => Promise<T>,
  ): Promise<T> {
    const git = simpleGit(repoPath);
    const token = await this.resolveToken();
    if (!token) {
      return fn(git);
    }

    const header = `Authorization: Basic ${Buffer.from(
      `x-access-token:${token}`,
    ).toString("base64")}`;

    git.env({
      ...process.env,
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "http.https://github.com/.extraheader",
      GIT_CONFIG_VALUE_0: header,
      GIT_TERMINAL_PROMPT: "0",
    });

    return fn(git);
  }

  private async resolveToken(): Promise<string | undefined> {
    const active = this.accounts.getActiveAccount();
    if (!active) {
      return undefined;
    }
    return (await this.accounts.getToken(active.id)) ?? undefined;
  }
}
