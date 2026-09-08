import { GitClientFactory } from "../../../core/git/git-authenticator";
import {
  Notifier,
  RepositoryContext,
  Refresher,
  WebviewChannel,
} from "../ports";
import { RepositoryScopedService } from "./repository-scoped.service";

/**
 * @description Working-tree operations of the Changes tab: staging, committing
 * a chosen set of files (the GitHub Desktop model), discarding, and producing
 * the diff of an uncommitted file.
 */
export class WorkingTreeService extends RepositoryScopedService {
  constructor(
    repos: RepositoryContext,
    notifier: Notifier,
    private readonly git: GitClientFactory,
    private readonly channel: WebviewChannel,
    private readonly refresher: Refresher,
  ) {
    super(repos, notifier);
  }

  stage(files: string[]): Promise<void | undefined> {
    return this.mutate(files, (g) => g.add(files));
  }

  unstage(files: string[]): Promise<void | undefined> {
    return this.mutate(files, (g) => g.reset(["HEAD", "--", ...files]));
  }

  /** Commits exactly `files` (stages them first, then commits with a pathspec). */
  commitFiles(message: string, files: string[]): Promise<void | undefined> {
    return this.withRepo(async (repo) => {
      if (!message.trim() || files.length === 0) {
        return;
      }
      const git = this.git.plain(repo.localPath);
      await git.add(files);
      await git.commit(message, files);
      this.channel.post({ command: "commitSucceeded" });
      this.notifier.info("Commit created");
      await this.refresher.refresh();
    });
  }

  /** Commits whatever is already staged. */
  commit(message: string): Promise<void | undefined> {
    return this.withRepo(async (repo) => {
      if (!message.trim()) {
        return;
      }
      await this.git.plain(repo.localPath).commit(message);
      this.channel.post({ command: "commitSucceeded" });
      this.notifier.info("Commit created");
      await this.refresher.refresh();
    });
  }

  discard(files: string[]): Promise<void | undefined> {
    return this.withRepo(async (repo) => {
      if (files.length === 0) {
        return;
      }
      const confirmed = await this.notifier.confirm(
        files.length === 1
          ? `Discard changes to ${files[0]}?`
          : `Discard changes to ${files.length} files?`,
        "Discard",
      );
      if (!confirmed) {
        return;
      }
      const git = this.git.plain(repo.localPath);
      await git
        .raw(["checkout", "HEAD", "--", ...files])
        .catch(() => undefined);
      await git.raw(["clean", "-fd", "--", ...files]).catch(() => undefined);
      await this.refresher.refresh();
    });
  }

  workingDiff(filePath: string): Promise<void | undefined> {
    return this.withRepo(async (repo) => {
      const git = this.git.plain(repo.localPath);
      let diff = await git.raw(["diff", "HEAD", "--", filePath]);
      if (!diff.trim()) {
        diff = await git
          .raw(["diff", "--no-index", "--", "/dev/null", filePath])
          .catch(() => "");
      }
      this.channel.post({
        command: "workingDiff",
        payload: { path: filePath, diff },
      });
    });
  }

  private mutate(
    files: string[],
    op: (git: ReturnType<GitClientFactory["plain"]>) => Promise<unknown>,
  ): Promise<void | undefined> {
    return this.withRepo(async (repo) => {
      if (files.length === 0) {
        return;
      }
      await op(this.git.plain(repo.localPath));
      await this.refresher.refresh();
    });
  }
}
