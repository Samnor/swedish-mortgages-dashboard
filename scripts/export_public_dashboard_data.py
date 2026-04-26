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
from datetime import datetime, timezone
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--environment", choices=["dev", "prod"], required=True)
    parser.add_argument("--output", type=Path, default=Path("dist/data"))
    args = parser.parse_args()

    args.output.mkdir(parents=True, exist_ok=True)
    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "environment": args.environment,
        "rates": [
            {
                "date": "2026-04-20",
                "policyRate": 2.25,
                "mortgageBond5y": 2.71,
            },
            {
                "date": "2026-04-21",
                "policyRate": 2.25,
                "mortgageBond5y": 2.73,
            },
            {
                "date": "2026-04-22",
                "policyRate": 2.25,
                "mortgageBond5y": 2.70,
            },
            {
                "date": "2026-04-23",
                "policyRate": 2.25,
                "mortgageBond5y": 2.69,
            },
            {
                "date": "2026-04-24",
                "policyRate": 2.25,
                "mortgageBond5y": 2.68,
            },
        ],
    }
    (args.output / "latest.json").write_text(json.dumps(payload, indent=2) + "\n")


if __name__ == "__main__":
    main()
