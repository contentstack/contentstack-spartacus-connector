# Contributing

Thanks for your interest in improving `@contentstack/contentstack-spartacus-connector`.

## Getting set up

This is an Angular library targeting SAP Composable Storefront (Spartacus). See
`GETTING_STARTED.md` for how to consume it in a storefront.

```bash
npm install
```

## Development workflow

Before opening a pull request, make sure the standard checks pass. These are the
same steps the CI workflow (`.github/workflows/ci.yml`) runs on every PR:

```bash
npm run lint             # ESLint (must report 0 errors; warnings allowed)
npm run format:check     # Prettier formatting check
npm run typecheck        # strict type-check (must exit 0)
npm run test:all         # unit tests + ng add schematic tests (jest)
npm run build            # library + schematics build (ng-packagr)
```

Auto-fixers:

```bash
npm run lint:fix         # apply ESLint autofixes
npm run format           # reformat src/ + schematics/ with Prettier
```

> **CI note:** the CI job installs `@spartacus/*` from SAP's private RBSC
> registry, so it needs a repo/org secret `RBSC_NPM_AUTH` (the registry `_auth`
> token). Without it, `npm ci` in CI cannot fetch the Spartacus peers.

## Pull requests

- Branch off `main` (e.g. `feat/…`, `fix/…`, `chore/…`).
- Keep changes focused; write clear commit messages.
- Add or update tests for behaviour changes.
- Update the relevant docs (`README.md`, `GETTING_STARTED.md`, `CONTENT-MODEL.md`,
  `TROUBLESHOOTING.md`) when behaviour or configuration changes.
- Do not commit secrets. Use `<PLACEHOLDER>` values in examples; real delivery /
  preview tokens and any management credential must never be committed.

## Reporting issues

- **Bugs / feature requests:** open a GitHub issue with a clear description and,
  for bugs, a minimal reproduction.
- **Security vulnerabilities:** do **not** open a public issue — follow
  `SECURITY.md`.

## License

By contributing, you agree that your contributions will be licensed under the
project's [MIT](LICENSE) license.
