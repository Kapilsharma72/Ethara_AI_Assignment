export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly errors: { field?: string; message: string }[] = []
  ) {
    super(message);
    this.name = 'AppError';
  }
}
