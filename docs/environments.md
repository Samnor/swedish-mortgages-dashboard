# Environments

The app uses the same lightweight release model as the dbt and Superset repos.

## Branches

- `develop` deploys dev.
- `main` deploys prod.

## GitHub Environments

- `dev`: automatic deployment from `develop`.
- `prod`: deployment from `main` with required approval.

## AWS Resource Naming

Use one AWS account with environment-prefixed resources:

```text
swedish-mortgages-dev-dashboard-*
swedish-mortgages-prod-dashboard-*
```

## Runtime Shape

- S3 bucket for static assets.
- S3 prefix or bucket for exported JSON snapshots.
- CloudFront distribution.
- Route behavior under `salaguno.com/mortgages`.

## GitHub Environment Variables

Expected variables:

- `AWS_REGION`
- `AWS_ROLE_ARN`
- `STATIC_BUCKET`
- `DATA_BUCKET`
- `DATA_PREFIX`
- `CLOUDFRONT_DISTRIBUTION_ID`

Secrets should not contain AWS access keys. GitHub Actions should assume AWS
roles through OIDC.
