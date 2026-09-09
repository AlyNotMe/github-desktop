import { AccountManager } from "../../core/accounts/account-manager";
import { GitClientFactory } from "../../core/git/git-authenticator";
import { CommitDetailViewProvider } from "../commitDetail/commit-detail-view-provider";
import { InboundMessage } from "./messages";
import { RemoteStatus } from "./interfaces/repository-snapshot";
import { MessageRouter } from "./message-router";
import {
  Browser,
  Notifier,
  RepositoryContext,
  Refresher,
  WebviewChannel,
} from "./ports";
import { BranchService } from "./services/branch.service";
import { CommitActionsService } from "./services/commit-actions.service";
import { ConflictService } from "./services/conflict.service";
import { DiffService } from "./services/diff.service";
import { PullRequestService } from "./services/pull-request.service";
import { RepositoryDataService } from "./services/repository-data.service";
import { StashService } from "./services/stash.service";
import { SyncService } from "./services/sync.service";
import { WorkingTreeService } from "./services/working-tree.service";

/**
 * @description Composition root for the timeline webview's message handling.
 *
 * It owns nothing git-specific itself: it wires the cohesive services to the
 * {@link MessageRouter}, implements {@link Refresher} (the single place that
 * recomputes and broadcasts timeline state), and validates raw webview
 * payloads into a typed {@link InboundMessage} before dispatch.
 */
export class TimelineController implements Refresher {
  private readonly router: MessageRouter;
  private readonly data: RepositoryDataService;
  private lastRemoteStatus: RemoteStatus = {
    hasRemote: false,
    isPublished: false,
    ahead: 0,
    behind: 0,
    lastFetched: null,
    remoteBranch: null,
  };

  constructor(
    private readonly deps: {
      repos: RepositoryContext;
      notifier: Notifier;
      channel: WebviewChannel;
      browser: Browser;
      git: GitClientFactory;
      accounts: AccountManager;
      commitDetail: CommitDetailViewProvider;
    },
  ) {
    const { repos, notifier, channel, browser, git } = deps;

    this.data = new RepositoryDataService(repos, git);

    const working = new WorkingTreeService(repos, notifier, git, channel, this);
    const sync = new SyncService(repos, notifier, git, channel, this);
    const branch = new BranchService(repos, notifier, git, channel, this);
    const commitActions = new CommitActionsService(
      repos,
      notifier,
      git,
      browser,
      this,
    );
    const pr = new PullRequestService(repos, notifier, browser);
    const diff = new DiffService(repos, notifier, git, this.data, channel);
    const conflict = new ConflictService(repos, notifier, git, this);
    const stash = new StashService(repos, notifier, git, this);

    this.router = new MessageRouter(notifier)
      .on("ready", () => this.refresh())
      .on("refresh", () => this.refresh())
      .on("selectRepository", async (m) => {
        const reloading = await repos.setActive(m.path);
        if (!reloading) {
          await this.refresh();
        }
      })
      .on("addLocalRepository", async () => {
        await repos.addLocal();
        await this.refresh();
      })
      .on("cloneRepository", () => repos.clone())
      .on("stageFiles", (m) => working.stage(m.files))
      .on("unstageFiles", (m) => working.unstage(m.files))
      .on("commit", (m) => working.commit(m.message))
      .on("commitFiles", (m) => working.commitFiles(m.message, m.files))
      .on("amendCommit", (m) => working.amend(m.message, m.files))
      .on("undoLastCommit", () => working.undoLastCommit())
      .on("discardFiles", (m) => working.discard(m.files))
      .on("markResolved", (m) => conflict.markResolved(m.files))
      .on("continueOperation", () => conflict.continue())
      .on("abortOperation", () => conflict.abort())
      .on("getStashes", () => this.refresh())
      .on("stashPush", (m) => stash.push(m.message))
      .on("stashApply", (m) => stash.apply(m.index, m.drop))
      .on("stashDrop", (m) => stash.drop(m.index))
      .on("getWorkingDiff", (m) => working.workingDiff(m.filePath))
      .on("fetch", () => sync.fetch())
      .on("pull", () => sync.pull())
      .on("push", () => sync.push())
      .on("forcePush", () => sync.forcePush())
      .on("publish", () => sync.publish())
      .on("checkoutBranch", (m) => branch.checkout(m.branch))
      .on("createBranch", (m) => branch.create(m.branchName))
      .on("createBranchWithChanges", (m) =>
        branch.createWithChanges(m.branchName, m.bringChanges),
      )
      .on("mergeBranch", (m) => branch.merge(m.fromBranch, m.toBranch))
      .on("compareBranch", (m) => branch.compare(m.branch))
      .on("createPullRequest", (m) => pr.openCompare(m.branch))
      .on("openRepoOnGitHub", () => pr.openRepo())
      .on("loadMoreCommits", (m) => this.loadMore(m.offset))
      .on("openCommitDetail", (m) =>
        deps.commitDetail.showCommitDetails(m.hash),
      )
      .on("getCommitDetails", (m) => diff.commitDetail(m.hash))
      .on("selectCommit", (m) => diff.commitDetail(m.hash))
      .on("getFileDiff", (m) => diff.fileDiff(m.hash, m.filePath))
      .on("selectFile", (m) => diff.fileDiff(m.hash, m.path))
      .on("resetToCommit", (m) => commitActions.reset(m.hash))
      .on("checkoutCommit", (m) => commitActions.checkout(m.hash))
      .on("revertCommit", (m) => commitActions.revert(m.hash))
      .on("cherryPickCommit", (m) => commitActions.cherryPick(m.hash))
      .on("createBranchFromCommit", (m) => commitActions.branchFrom(m.hash))
      .on("createTagFromCommit", (m) => commitActions.tagFrom(m.hash))
      .on("viewCommitOnGitHub", (m) => commitActions.viewOnGitHub(m.hash));
  }

  /**
   * Validates a raw `postMessage` payload and dispatches it. Malformed
   * payloads are dropped.
   */
  handle(raw: unknown): Promise<void> {
    const message = coerceInbound(raw);
    if (!message) {
      return Promise.resolve();
    }
    return this.router.dispatch(message);
  }

  /** Recomputes the whole snapshot and broadcasts it to the webview. */
  async refresh(): Promise<void> {
    const { channel, accounts } = this.deps;
    const snapshot = await this.data.getSnapshot();

    if (!snapshot) {
      channel.post({ command: "updateRepository", repository: null });
      return;
    }

    this.lastRemoteStatus = snapshot.remoteStatus;

    channel.post({ command: "updateChanges", changes: snapshot.changes });
    channel.post({
      command: "updateHistory",
      history: snapshot.commits,
      hasMoreCommits: snapshot.hasMoreCommits,
      offset: 0,
    });
    channel.post({
      command: "updateBranches",
      branches: snapshot.branches,
      currentBranch: snapshot.currentBranch,
      branchActivity: snapshot.branchActivity,
    });
    channel.post({
      command: "updateRepository",
      repository: snapshot.repository,
    });
    channel.post({
      command: "updateRepositoryList",
      repositories: this.deps.repos
        .list()
        .map((r) => ({ name: r.name, path: r.localPath })),
      activePath: snapshot.repository.path,
    });

    const active = accounts.getActiveAccount();
    channel.post({
      command: "updateAccounts",
      activeAccount: active
        ? {
            login: active.login,
            name: active.name,
            avatarUrl: active.avatarUrl,
          }
        : null,
    });

    channel.post({
      command: "updateRemoteStatus",
      remoteStatus: snapshot.remoteStatus,
      tags: snapshot.tags,
    });

    channel.post({
      command: "updateOperation",
      operation: snapshot.operation,
      conflicted: snapshot.conflicted,
      canUndo: snapshot.canUndo,
      lastCommitSummary: snapshot.commits[0]?.message.split("\n")[0] ?? null,
    });

    channel.post({ command: "updateStashes", stashes: snapshot.stashes });
  }

  private async loadMore(offset: number): Promise<void> {
    const page = await this.data.loadMoreCommits(offset, this.lastRemoteStatus);
    this.deps.channel.post({
      command: "loadMoreCommitsResponse",
      history: page.commits,
      hasMoreCommits: page.hasMoreCommits,
      offset: page.offset,
    });
  }
}

/**
 * @description Narrows an untrusted `postMessage` value to an
 * {@link InboundMessage}. Only the `command` discriminant is checked here; each
 * service still guards its own inputs.
 */
function coerceInbound(raw: unknown): InboundMessage | null {
  if (
    typeof raw === "object" &&
    raw !== null &&
    typeof (raw as { command?: unknown }).command === "string"
  ) {
    return raw as InboundMessage;
  }
  return null;
}
