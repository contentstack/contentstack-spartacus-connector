// Trivial CJS mock for the ESM-only `ora` package (a transitive dependency of
// @angular-devkit/schematics/tasks' NodePackageInstallTask executor, pulled
// in merely by importing SchematicTestRunner). We don't run real package
// installs in tests, so a no-op spinner is sufficient.
function ora() {
  return { start() { return this; }, stop() { return this; }, succeed() { return this; }, fail() { return this; }, text: '' };
}
module.exports = ora;
module.exports.default = ora;
