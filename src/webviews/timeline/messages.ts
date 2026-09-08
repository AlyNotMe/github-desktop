import {
  ChangeEntry,
  CommitEntry,
  CommitDetail,
} from "./interfaces/timeline-view-provider.interface";
import {
  InProgressOperation,
  RemoteStatus,
  RepositorySummary,
  StashEntry,
} from "./interfaces/repository-snapshot";

/* ------------------------------------------------------------------ *
 *  Inbound: webview -> extension
 * ------------------------------------------------------------------ */

/**
 * @description Every message the timeline webview can send, as a discriminated
 * union keyed on `command`. Handlers narrow on `command` and get fully typed
 * payloads — no `any`, no manual casts.
 */
export type InboundMessage =
  | { command: "ready" }
  | { command: "refresh" }
  | { command: "stageFiles"; files: string[] }
  | { command: "unstageFiles"; files: string[] }
  | { command: "commit"; message: string }
  | { command: "commitFiles"; message: string; files: string[] }
  | { command: "amendCommit"; message: string; files: string[] }
  | { command: "undoLastCommit" }
  | { command: "discardFiles"; files: string[] }
  | { command: "markResolved"; files: string[] }
  | { command: "abortOperation" }
  | { command: "continueOperation" }
  | { command: "getStashes" }
  | { command: "stashPush"; message: string }
  | { command: "stashApply"; index: number; drop: boolean }
  | { command: "stashDrop"; index: number }
  | { command: "getWorkingDiff"; filePath: string }
  | { command: "fetch" }
  | { command: "pull" }
  | { command: "push" }
  | { command: "publish" }
  | { command: "checkoutBranch"; branch: string }
  | { command: "createBranch"; branchName: string }
  | {
      command: "createBranchWithChanges";
      branchName: string;
      bringChanges: boolean;
    }
  | { command: "mergeBranch"; fromBranch: string; toBranch: string }
  | { command: "createPullRequest"; branch: string }
  | { command: "loadMoreCommits"; offset: number }
  | { command: "openCommitDetail"; hash: string }
  | { command: "getCommitDetails"; hash: string }
  | { command: "getFileDiff"; hash: string; filePath: string }
  | { command: "selectCommit"; hash: string }
  | { command: "selectFile"; hash: string; path: string }
  | { command: "resetToCommit"; hash: string }
  | { command: "checkoutCommit"; hash: string }
  | { command: "revertCommit"; hash: string }
  | { command: "cherryPickCommit"; hash: string }
  | { command: "createBranchFromCommit"; hash: string }
  | { command: "createTagFromCommit"; hash: string }
  | { command: "viewCommitOnGitHub"; hash: string };

export type InboundCommand = InboundMessage["command"];

/* ------------------------------------------------------------------ *
 *  Outbound: extension -> webview
 * ------------------------------------------------------------------ */

export type OutboundMessage =
  | { command: "updateRepository"; repository: RepositorySummary | null }
  | { command: "updateChanges"; changes: ChangeEntry[] }
  | {
      command: "updateHistory";
      history: CommitEntry[];
      hasMoreCommits: boolean;
      offset: number;
    }
  | {
      command: "updateBranches";
      branches: string[];
      currentBranch: string | null;
      branchActivity: Record<string, string>;
    }
  | {
      command: "updateAccounts";
      activeAccount: {
        login: string;
        name?: string;
        avatarUrl?: string;
      } | null;
    }
  | {
      command: "updateRemoteStatus";
      remoteStatus: RemoteStatus;
      tags: Record<string, string[]>;
    }
  | {
      command: "loadMoreCommitsResponse";
      history: CommitEntry[];
      hasMoreCommits: boolean;
      offset: number;
    }
  | { command: "commitSucceeded" }
  | { command: "mergeConflict"; operation: string; files: string[] }
  | {
      command: "updateOperation";
      operation: InProgressOperation | null;
      conflicted: string[];
      canUndo: boolean;
      lastCommitSummary: string | null;
    }
  | { command: "updateStashes"; stashes: StashEntry[] }
  | { command: "workingDiff"; payload: { path: string; diff: string } }
  | { command: "fileDiff"; payload: { path: string; diff: string } }
  | { command: "commitDetail"; payload: CommitDetail }
  | { command: "error"; message: string };
