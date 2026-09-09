import { SimpleGit } from "simple-git";
import { CommitEntry } from "../interfaces/timeline-view-provider.interface";

/**
 * @description Formats a git date as a coarse "N minutes ago" string.
 *
 * @param input - Any date string git may emit (ISO, RFC 2822, epoch...)
 * @returns A relative phrase, or "unknown" when unparseable
 */
export function formatRelativeTime(input: string): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return "unknown";
  }
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  const units: Array<[number, string]> = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [30, "day"],
    [12, "month"],
    [Number.POSITIVE_INFINITY, "year"],
  ];
  let value = Math.max(seconds, 0);
  for (const [size, name] of units) {
    if (value < size) {
      const rounded = Math.round(value);
      return `${rounded} ${name}${rounded === 1 ? "" : "s"} ago`;
    }
    value /= size;
  }
  return "just now";
}

/** `git log` format string that {@link parseCommitLogLine} understands. */
export const COMMIT_LOG_FORMAT = "%H%x09%an%x09%ae%x09%ad%x09%s";

/**
 * @description Parses one tab-separated line produced with
 * {@link COMMIT_LOG_FORMAT} into a {@link CommitEntry}.
 */
export function parseCommitLogLine(line: string): CommitEntry {
  const [hash = "", author = "", email = "", date = "", ...rest] =
    line.split("\t");
  return {
    hash,
    shortHash: hash.slice(0, 7),
    message: rest.join("\t"),
    authorName: author,
    authorEmail: email,
    relativeTime: formatRelativeTime(date),
    committedAt: date,
  };
}

/**
 * @description Runs `git log <range>` and returns the commits, newest first.
 *
 * @param git - A client bound to the repository
 * @param range - Any rev range, e.g. `"main..HEAD"`
 * @param limit - Max commits to return (default 200)
 */
export async function logRange(
  git: SimpleGit,
  range: string,
  limit = 200,
): Promise<CommitEntry[]> {
  const raw = await git
    .raw([
      "log",
      `--format=${COMMIT_LOG_FORMAT}`,
      "--date=iso",
      `--max-count=${limit}`,
      range,
    ])
    .catch(() => "");
  return raw
    .split("\n")
    .filter((l) => l.trim())
    .map(parseCommitLogLine);
}
