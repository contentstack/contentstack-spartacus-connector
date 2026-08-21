/*
 * Runtime stub for `@angular/common`, used ONLY by the offline Jest unit config.
 * The client service imports `isPlatformServer` at module load; the adapter
 * specs mock the client instance, so these bodies never actually run — the stub
 * only needs to satisfy import resolution (the real @angular/common ships as ESM
 * that the transpile-only ts-jest setup can't require).
 */
export function isPlatformServer(_platformId: unknown): boolean {
  return false;
}
export function isPlatformBrowser(_platformId: unknown): boolean {
  return true;
}
