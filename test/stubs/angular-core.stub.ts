/*
 * Runtime stub for `@angular/core`, used ONLY by the offline Jest unit config
 * (jest.config.cjs) so the pure-logic normalizer specs run without pulling the
 * full Angular runtime. The normalizers need only the `@Injectable` decorator at
 * runtime; the rest are harmless no-ops kept for resolution safety.
 *
 * This stub is NOT used by the real app or by the typecheck (tsconfig.typecheck
 * resolves the real @angular/core from spartacus/node_modules).
 */
export function Injectable(): (target: unknown) => void {
  return () => {};
}
export function NgModule(): (target: unknown) => void {
  return () => {};
}
export function Component(): (target: unknown) => void {
  return () => {};
}
export function Inject(): (...args: unknown[]) => void {
  return () => {};
}
export function Optional(): (...args: unknown[]) => void {
  return () => {};
}
export function inject(): undefined {
  return undefined;
}
// Minimal DI token stand-in — the access-control code constructs an
// `InjectionToken` at module load (CONTENTSTACK_CURRENT_USER); the specs inject
// its value directly, so only construction needs to succeed here.
export class InjectionToken<T> {
  constructor(protected _desc: string) {}
}
export const PLATFORM_ID = Symbol('PLATFORM_ID');
export enum ChangeDetectionStrategy {
  OnPush = 0,
  Default = 1,
}
export class TransferState {}
export function makeStateKey<T>(key: string): unknown {
  return key;
}
