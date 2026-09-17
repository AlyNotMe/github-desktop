import * as fs from "fs";
import * as path from "path";
import { SimpleGit } from "simple-git";
import { InProgressOperation } from "../interfaces/repository-snapshot";

/**
 * @description Detects a multi-step git operation left mid-flight (typically by
 * a conflict) by probing the marker files in the git directory.
 *
 * @param git - A client bound to the repository
 * @returns The operation in progress, or `null` when the tree is idle
 */
export async function detectInProgressOperation(
  git: SimpleGit,
): Promise<InProgressOperation | null> {
  const dir = (
    await git.raw(["rev-parse", "--absolute-git-dir"]).catch(() => "")
  ).trim();
  if (!dir) {
    return null;
  }
  const has = (p: string): boolean => fs.existsSync(path.join(dir, p));
  if (has("rebase-merge") || has("rebase-apply")) {
    return "rebase";
  }
  if (has("CHERRY_PICK_HEAD")) {
    return "cherry-pick";
  }
  if (has("REVERT_HEAD")) {
    return "revert";
  }
  if (has("MERGE_HEAD")) {
    return "merge";
  }
  return null;
}
