export class ForumError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForumError";
  }
}
