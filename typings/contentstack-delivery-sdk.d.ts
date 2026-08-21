/*
 * Minimal type shim for `@contentstack/delivery-sdk`, used only for offline
 * typechecking in this workspace (the package is not installed here). Signatures
 * mirror the real SDK's initialization + query builder as used by
 * ContentstackClientService. Remove this shim once the dependency is installed.
 */
declare module '@contentstack/delivery-sdk' {
  export enum Region {
    US = 'us',
    EU = 'eu',
    AU = 'au',
    AZURE_NA = 'azure-na',
    AZURE_EU = 'azure-eu',
    GCP_NA = 'gcp-na',
    GCP_EU = 'gcp-eu',
  }

  export enum QueryOperation {
    EQUALS = 'equals',
    NOT_EQUALS = 'not_equals',
    INCLUDES = 'includes',
    EXCLUDES = 'excludes',
    IS_LESS_THAN = 'is_less_than',
    IS_LESS_THAN_OR_EQUAL = 'is_less_than_or_equal',
    IS_GREATER_THAN = 'is_greater_than',
    IS_GREATER_THAN_OR_EQUAL = 'is_greater_than_or_equal',
    EXISTS = 'exists',
    MATCHES = 'matches',
  }

  export interface StackConfig {
    apiKey: string;
    deliveryToken: string;
    environment: string;
    region?: Region;
    branch?: string;
  }

  export interface FindResponse<T> {
    entries?: T[];
    count?: number;
  }

  export interface Query {
    where(fieldUid: string, operation: QueryOperation, value: unknown): Query;
    find<T>(): Promise<FindResponse<T>>;
  }

  export interface Entries {
    // Matches the real SDK: includeReference is on Entries, not Query.
    includeReference(...referenceFieldUid: (string | string[])[]): Entries;
    locale(locale: string): Entries;
    // Fall back to master-locale content when an entry is not localized in the
    // requested locale (Delivery API `include_fallback`).
    includeFallback(): Entries;
    query(): Query;
  }

  export interface EntryInstance {
    locale(locale: string): EntryInstance;
    includeFallback(): EntryInstance;
    fetch<T>(): Promise<T>;
  }

  export interface ContentType {
    entry(): Entries;
    entry(uid: string): EntryInstance;
  }

  export interface Stack {
    contentType(uid: string): ContentType;
  }

  export interface Contentstack {
    stack(config: StackConfig): Stack;
  }

  const contentstack: Contentstack;
  export default contentstack;
}
