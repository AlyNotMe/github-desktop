import { GitClientFactory } from "../../../core/git/git-authenticator";
import {
  Notifier,
  RepositoryContext,
  Refresher,
  WebviewChannel,
} from "../ports";
import { RepositoryScopedService } from "./repository-scoped.service";

/**
 * @description Branch lifecycle for the branch dropdown: switching, creating
 * (optionally carrying or stashing uncommitted work), and merging.
 */
export class BranchService extends RepositoryScopedService {
  constructor(
    repos: RepositoryContext,
    notifier: Notifier,
    private readonly git: GitClientFactory,
    private readonly channel: WebviewChannel,
    private readonly refresher: Refresher,
  ) {
    super(repos, notifier);
  }

  checkout(branch: string): Promise<void | undefined> {
    return this.withRepo(async (repo) => {
      if (!branch) {
        return;
      }
      // Never check out a `remotes/<remote>/<name>` ref directly: that detaches
      // HEAD. Fall back to the short name so git sets up local tracking.
      const remoteMatch = branch.match(/^remotes\/[^/]+\/(.+)$/);
      const target = remoteMatch ? remoteMatch[1] : branch;
      await this.git.plain(repo.localPath).checkout(target);
      this.notifier.info(`Switched to ${target}`);
      await this.refresher.refresh();
    });
  }

  create(branchName: string): Promise<void | undefined> {
    return this.withRepo(async (repo) => {
      if (!branchName) {
        return;
      }
      await this.git.plain(repo.localPath).checkoutLocalBranch(branchName);
      this.notifier.info(`Created and switched to '${branchName}'`);
      await this.refresher.refresh();
    });
  }

  createWithChanges(
    branchName: string,
    bringChanges: boolean,
  ): Promise<void | undefined> {
    return this.withRepo(async (repo) => {
      if (!branchName) {
        return;
      }
      const git = this.git.plain(repo.localPath);
      if (!bringChanges) {
        await git.stash(["push", "-m", `Stash before creating ${branchName}`]);
      }
      await git.checkoutLocalBranch(branchName);
      this.notifier.info(
        bringChanges
          ? `Created '${branchName}' with your changes`
          : `Created '${branchName}' and stashed your changes`,
      );
      await this.refresher.refresh();
    });
  }

  merge(fromBranch: string, toBranch: string): Promise<void | undefined> {
    return this.withRepo(async (repo) => {
      if (!fromBranch || !toBranch) {
        return;
      }
      const git = this.git.plain(repo.localPath);
      await git.checkout(toBranch);
      try {
        await git.merge([fromBranch]);
      } catch (error) {
        const status = await git.status();
        if (status.conflicted.length > 0) {
          this.channel.post({
            command: "mergeConflict",
            operation: `merge ${fromBranch}`,
            files: status.conflicted,
          });
          this.notifier.warn(
            `Merge stopped: ${status.conflicted.length} file(s) in conflict`,
          );
          await this.refresher.refresh();
          return;
        }
        throw error;
      }
      this.notifier.info(`Merged ${fromBranch} into ${toBranch}`);
      await this.refresher.refresh();
    });
  }
}
