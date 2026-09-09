import { TrackedRepository } from "../../../shared/types";
import { Notifier, RepositoryContext } from "../ports";

/**
 * @description Base for services that operate on the current repository.
 * Centralises the "no repository open" guard so each concrete method stays a
 * single responsibility.
 */
export abstract class RepositoryScopedService {
  protected constructor(
    protected readonly repos: RepositoryContext,
    protected readonly notifier: Notifier,
  ) {}

  /**
   * Runs `fn` with the active repository, or notifies the user and resolves to
   * `undefined` when there is none.
   */
  protected async withRepo<T>(
    fn: (repo: TrackedRepository) => Promise<T>,
  ): Promise<T | undefined> {
    const repo = this.repos.getPrimary();
    if (!repo) {
      this.notifier.error("No repository found in the current workspace");
      return undefined;
    }
    return fn(repo);
  }
}
