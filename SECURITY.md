# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability in this library, please report it
responsibly. **Do not open a public GitHub issue for security reports.**

- Email **security@contentstack.com** with a description of the issue, the
  affected version, and steps to reproduce.
- You will receive an acknowledgement, and we will keep you informed as we
  investigate and remediate.
- Please give us a reasonable period to address the issue before any public
  disclosure.

## Supported versions

This project is pre-1.0 (`0.x`). Security fixes are applied to the latest
released `0.x` version. Pin a version and upgrade to receive fixes.

## Security model of this connector

This library changes where **content** is resolved from; it does not change how
Spartacus authenticates commerce calls to SAP. Two points are important for
operators:

### Two-token model — never ship a privileged token

- The storefront uses only a **read-only Contentstack delivery token** (scoped to
  a single environment). It is designed to be present in the client bundle.
- The **management token** / `csdx auth:login` credential used to provision the
  content model is for one-time, dev-machine use only. **Never commit it and
  never ship it** in the storefront. See `GETTING_STARTED.md`.

### Live Preview

- The **preview token** is only required when Live Preview / Visual Builder is
  enabled. Enable preview wiring in non-production environments; do not enable it
  against production delivery unless you understand the exposure.

### Secrets in configuration

- Real credentials belong in environment configuration, not in source. The `ng add`
  schematic scaffolds `<PLACEHOLDER>` values so nothing sensitive is written to a
  committed file by default.
- No management tokens, API secrets, or private keys are stored in this
  repository. The `blt…`/`cs…` identifiers that appear in the starter-pack seed
  data are Contentstack **entity/locale UIDs** (non-secret identifiers that are
  re-mapped on import), not credentials.
