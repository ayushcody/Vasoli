export function logError(context: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  console.error({
    context,
    message,
    error,
    timestamp: new Date().toISOString(),
  });
}
