/*
 * Minimal @angular/common stub for the offline unit-test suite.
 * Only the symbols the connector imports at module load are provided
 * (the real package is ESM and not resolvable in the stubbed jest env).
 */
export function isPlatformServer(_platformId: unknown): boolean {
  return false;
}
