#!/usr/bin/env python3
"""Export curated public dashboard JSON snapshots from Athena.

This is intentionally a small skeleton. The first production version should:
- run allowlisted SQL queries against dbt prod/dev marts,
- validate response schemas,
- write compact JSON files to the environment's public data S3 prefix.
"""

from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--environment", choices=["dev", "prod"], required=True)
    parser.add_argument("--output", type=Path, default=Path("dist/data"))
    args = parser.parse_args()

    args.output.mkdir(parents=True, exist_ok=True)
    payload = {
        "environment": args.environment,
        "generated_at": datetime.now(UTC).isoformat(),
        "status": "placeholder",
        "rows": [],
    }
    (args.output / "summary.json").write_text(json.dumps(payload, indent=2) + "\n")


if __name__ == "__main__":
    main()
