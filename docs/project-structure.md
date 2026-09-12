# Project structure guide

This repository separates application code, AWS job definitions, data artifacts, frontend assets, and documentation. The layout below reflects the current runtime paths, so files should remain in their existing folders unless the corresponding code is updated at the same time.

## Root files

- `run_pipeline.py` runs the local ETL workflow. It reads the category-reference JSON and cleansed Parquet files, then writes local analytics outputs.
- `server.py` serves the dashboard from `web/` and exposes the local analytics API.
- `package.json` provides shortcuts for starting the server and running the ETL workflow.

## Directories

| Directory | Purpose | Notes |
| --- | --- | --- |
| `assets/` | Project visuals and reference artifacts | Includes the architecture diagram and dashboard reference files. |
| `data/raw/` | Source category-reference JSON files | Input to the local ETL runner. |
| `data/cleansed/` | Partitioned Parquet datasets | Input to the local ETL runner; partitions are grouped by region. |
| `data/analytics/` | Local dashboard outputs | `run_pipeline.py` creates or refreshes the CSV, JSON, and summary-metrics files here. |
| `scripts/` | AWS deployment job code | Contains the Lambda handler and Glue ETL jobs. |
| `web/` | Browser dashboard | Served directly by `server.py`; filenames are referenced by the static site. |
| `docs/` | Supporting documentation | Contains this guide and the solution methodology. |

## Safe workflow

1. Keep data paths under `data/` unchanged unless the path references in `run_pipeline.py` and `server.py` are updated together.
2. Keep the `web/` directory name unchanged because `server.py` serves it directly.
3. Treat files in `data/analytics/` as generated local outputs; run `npm run etl` to refresh them after changing input data or ETL logic.
4. Place new design diagrams, screenshots, and other non-runtime visuals in `assets/`; place explanatory material in `docs/`.
