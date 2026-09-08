import { InboundCommand, InboundMessage } from "./messages";
import { Notifier } from "./ports";

/**
 * @description Handler for one inbound command. The message is narrowed to the
 * matching union member by {@link MessageRouter.on}.
 */
export type CommandHandler<C extends InboundCommand> = (
  message: Extract<InboundMessage, { command: C }>,
) => Promise<void> | void;

/**
 * @description Maps inbound commands to handlers. Adding a command means
 * registering a handler — the router itself never changes (Open/Closed).
 */
export class MessageRouter {
  private readonly handlers = new Map<
    InboundCommand,
    CommandHandler<InboundCommand>
  >();

  constructor(private readonly notifier: Notifier) {}

  /**
   * Registers `handler` for `command`, replacing any previous registration.
   *
   * @returns `this`, for chaining.
   */
  on<C extends InboundCommand>(command: C, handler: CommandHandler<C>): this {
    this.handlers.set(
      command,
      handler as unknown as CommandHandler<InboundCommand>,
    );
    return this;
  }

  /**
   * Dispatches `message` to its handler. Unknown commands are ignored; handler
   * errors are surfaced to the user rather than swallowed silently.
   */
  async dispatch(message: InboundMessage): Promise<void> {
    const handler = this.handlers.get(message.command);
    if (!handler) {
      return;
    }
    try {
      await handler(message);
    } catch (error) {
      this.notifier.error(
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
