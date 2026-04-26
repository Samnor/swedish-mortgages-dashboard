#!/usr/bin/env python3
"""Export curated public dashboard JSON snapshots from Athena.

The exporter intentionally runs a small allowlisted query and writes a compact
browser-safe JSON contract. Public users read this snapshot; they never query
Athena directly.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_ATHENA_OUTPUT = "s3://athena-queries-funfun/dashboard-exports/"
QUERY_TIMEOUT_SECONDS = 120


def rates_query(database: str, limit: int) -> str:
    return f"""
select
  cast(rate_date as varchar) as date,
  cast(policy_rate as double) as policy_rate,
  cast(mortbond_5y as double) as mortgage_bond_5y
from {database}.rates_daily
where policy_rate is not null
  and mortbond_5y is not null
order by rate_date desc
limit {limit}
""".strip()


def run_aws_json(args: list[str]) -> dict:
    completed = subprocess.run(
        ["aws", *args, "--output", "json"],
        capture_output=True,
        text=True,
    )
    if completed.returncode != 0:
        print(completed.stderr, file=sys.stderr)
        completed.check_returncode()
    return json.loads(completed.stdout)


def run_athena_query(
    *,
    database: str,
    output_location: str,
    workgroup: str,
    query: str,
) -> str:
    result = run_aws_json(
        [
            "athena",
            "start-query-execution",
            "--query-string",
            query,
            "--query-execution-context",
            f"Database={database},Catalog=AwsDataCatalog",
            "--result-configuration",
            f"OutputLocation={output_location}",
            "--work-group",
            workgroup,
        ]
    )
    query_id = result["QueryExecutionId"]
    deadline = time.monotonic() + QUERY_TIMEOUT_SECONDS

    while time.monotonic() < deadline:
        execution = run_aws_json(
            ["athena", "get-query-execution", "--query-execution-id", query_id]
        )
        status = execution["QueryExecution"]["Status"]
        state = status["State"]
        if state == "SUCCEEDED":
            return query_id
        if state in {"FAILED", "CANCELLED"}:
            reason = status.get("StateChangeReason", "No reason provided.")
            raise RuntimeError(f"Athena query {query_id} {state.lower()}: {reason}")
        time.sleep(2)

    raise TimeoutError(f"Athena query {query_id} did not finish in time.")


def athena_rows(query_id: str) -> list[dict[str, str]]:
    result = run_aws_json(
        ["athena", "get-query-results", "--query-execution-id", query_id]
    )
    rows = result["ResultSet"]["Rows"]
    if not rows:
        return []

    headers = [cell.get("VarCharValue", "") for cell in rows[0]["Data"]]
    parsed_rows = []
    for row in rows[1:]:
        values = [cell.get("VarCharValue", "") for cell in row.get("Data", [])]
        parsed_rows.append(dict(zip(headers, values)))
    return parsed_rows


def parse_rate_rows(rows: list[dict[str, str]]) -> list[dict[str, float | str]]:
    rates = [
        {
            "date": row["date"],
            "policyRate": float(row["policy_rate"]),
            "mortgageBond5y": float(row["mortgage_bond_5y"]),
        }
        for row in rows
    ]
    return list(reversed(rates))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--environment", choices=["dev", "prod"], required=True)
    parser.add_argument("--output", type=Path, default=Path("dist/data"))
    parser.add_argument("--athena-output", default=DEFAULT_ATHENA_OUTPUT)
    parser.add_argument("--workgroup", default="primary")
    parser.add_argument("--limit", type=int, default=90)
    args = parser.parse_args()

    if args.limit < 1 or args.limit > 365:
        raise ValueError("--limit must be between 1 and 365.")

    database = f"swedish_mortgages_{args.environment}_marts"
    query_id = run_athena_query(
        database=database,
        output_location=args.athena_output,
        workgroup=args.workgroup,
        query=rates_query(database, args.limit),
    )
    rows = athena_rows(query_id)

    args.output.mkdir(parents=True, exist_ok=True)
    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "environment": args.environment,
        "source": f"{database}.rates_daily",
        "queryId": query_id,
        "rates": parse_rate_rows(rows),
    }
    (args.output / "latest.json").write_text(json.dumps(payload, indent=2) + "\n")


if __name__ == "__main__":
    main()
