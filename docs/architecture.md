# Architecture

The public dashboard app is a static product, not a BI server.

```text
dbt prod/dev marts
  -> Athena/Iceberg
  -> export_public_dashboard_data.py
  -> JSON snapshots in S3
  -> CloudFront
  -> static React dashboard under /mortgages
```

Locale defaulting is first-party. The CloudFront Function returns
`/mortgages/locale.json` from the built-in `CloudFront-Viewer-Country` header,
so the browser does not call a third-party IP geolocation service.

## Principles

- Public users never query Athena directly.
- Public users never receive AWS credentials.
- Only curated, compact JSON leaves the data lake.
- Superset remains available for deeper internal exploration.
- The static app is cheap to serve and simple to cache.

## Initial Data Contracts

Initial JSON snapshot:

- `data/latest.json`

The file should include:

```json
{
  "generatedAt": "2026-04-26T00:00:00Z",
  "environment": "prod",
  "source": "swedish_mortgages_prod_marts.rates_daily",
  "queryId": "athena-query-id",
  "rates": [
    {
      "date": "2026-04-26",
      "policyRate": 2.25,
      "mortgageBond5y": 2.68
    }
  ]
}
```

More files can be added later, but the first pass should keep one snapshot so
the state machine remains easy to reason about.

The first exporter query is allowlisted to `rates_daily` and returns the latest
90 rows where `policy_rate` and `mortbond_5y` are present.
