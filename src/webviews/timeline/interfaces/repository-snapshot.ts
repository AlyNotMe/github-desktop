import { ChangeEntry, CommitEntry } from "./timeline-view-provider.interface";

/**
 * @description Tracking state of the current branch against its upstream.
 */
export interface RemoteStatus {
  hasRemote: boolean;
  isPublished: boolean;
  ahead: number;
  behind: number;
  lastFetched: Date | null;
  remoteBranch: string | null;
}

/**
 * @description Minimal repository identity shown in the timeline toolbar.
 */
export interface RepositorySummary {
  name: string;
  path: string;
  remote?: string;
}

/**
 * @description Everything the timeline needs for one render pass, assembled by
 * the repository read model in a single call.
 */
export interface RepositorySnapshot {
  changes: ChangeEntry[];
  commits: CommitEntry[];
  hasMoreCommits: boolean;
  branches: string[];
  currentBranch: string | null;
  branchActivity: Record<string, string>;
  repository: RepositorySummary;
  remoteStatus: RemoteStatus;
  tags: Record<string, string[]>;
}

/** Shared page size for commit history queries. */
export const COMMITS_PAGE_SIZE = 50;
