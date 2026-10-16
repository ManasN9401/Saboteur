/** An error whose message is written for the student and safe to show in the UI. */
export class FriendlyError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "FriendlyError";
  }
}
