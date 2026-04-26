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

## Principles

- Public users never query Athena directly.
- Public users never receive AWS credentials.
- Only curated, compact JSON leaves the data lake.
- Superset remains available for deeper internal exploration.
- The static app is cheap to serve and simple to cache.

## Initial Data Contracts

Planned JSON snapshots:

- `summary.json`
- `rates_timeseries.json`
- `bank_margin_snapshot.json`
- `freshness.json`

Each file should include:

```json
{
  "generated_at": "2026-04-26T00:00:00Z",
  "source": "swedish_mortgages_prod_marts.rates_daily",
  "rows": []
}
```
