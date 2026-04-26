# Swedish Mortgages Dashboard

Public static dashboard app for Swedish mortgage intelligence.

The app is designed to live under:

```text
https://salaguno.com/mortgages
```

Superset remains available for deeper internal analysis. This repo owns the
cheap public-facing dashboard experience.

## Architecture

- Static frontend served from S3 and CloudFront.
- Curated JSON snapshots generated from dbt-managed Athena/Iceberg marts.
- No public SQL endpoint.
- No browser credentials.
- Dev and prod are separated by environment-prefixed AWS resources.

See [docs/architecture.md](docs/architecture.md) and
[docs/environments.md](docs/environments.md).

## Local Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
