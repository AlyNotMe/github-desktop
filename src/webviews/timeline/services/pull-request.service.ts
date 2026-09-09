import { toGitHubWebUrl } from "../../../shared/utils/github-url";
import { Browser, Notifier, RepositoryContext } from "../ports";
import { RepositoryScopedService } from "./repository-scoped.service";

/**
 * @description Opens GitHub's "create pull request" page for a branch. The
 * extension does not create PRs through the API — it hands off to the browser,
 * matching GitHub Desktop.
 */
export class PullRequestService extends RepositoryScopedService {
  constructor(
    repos: RepositoryContext,
    notifier: Notifier,
    private readonly browser: Browser,
  ) {
    super(repos, notifier);
  }

  openCompare(branch: string): Promise<void | undefined> {
    return this.withRepo(async (repo) => {
      const base = toGitHubWebUrl(repo.remoteUrl);
      if (!base) {
        this.notifier.warn("No GitHub remote configured");
        return;
      }
      this.browser.open(`${base}/compare/${branch}?expand=1`);
    });
  }
}
