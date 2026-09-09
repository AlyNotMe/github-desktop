/**
 * @description Normalises a git remote URL (SSH or HTTPS, with or without a
 * trailing `.git`) into its browsable `https://github.com/owner/repo` form.
 *
 * @param remoteUrl - The value of `remote.origin.url`, or `undefined`
 * @returns The web URL, or `null` when `remoteUrl` is missing
 *
 * @example
 * toGitHubWebUrl("git@github.com:owner/repo.git"); // "https://github.com/owner/repo"
 */
export function toGitHubWebUrl(remoteUrl: string | undefined): string | null {
  if (!remoteUrl) {
    return null;
  }
  return remoteUrl
    .replace(/^git@github\.com:/, "https://github.com/")
    .replace(/\.git$/, "");
}
