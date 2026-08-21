/*
 * Runtime stub for `@contentstack/delivery-sdk`, used ONLY by the offline Jest
 * unit config so module resolution succeeds. The normalizer specs do not touch
 * the SDK at runtime; this exists so any transitive import resolves cleanly.
 */
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
}
const contentstack = {
  stack: (_config: unknown) => ({}),
};
export default contentstack;
