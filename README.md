<div align="center">

# 🚀 AWS YouTube Data Engineering & Analytics Pipeline

### *Scalable Serverless ETL Pipeline, Parquet Data Lake & Analytics Console*

![AWS](https://img.shields.io/badge/AWS-Cloud%20Data%20Engineering-FF9900?style=for-the-badge&logo=amazon-aws&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![PySpark](https://img.shields.io/badge/PySpark-AWS%20Glue-E25A1C?style=for-the-badge&logo=apachespark&logoColor=white)
![DuckDB](https://img.shields.io/badge/DuckDB-Athena%20SQL-FFF000?style=for-the-badge&logo=duckdb&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

</div>

---

## 📌 Executive Summary

This project implements an **End-to-End AWS Cloud Data Engineering Pipeline** that ingests, cleanses, transforms, and analyzes large-scale global YouTube trending video datasets across multiple countries (`US`, `Canada`, `Great Britain`).

### Key Achievements:
- **Processed Dataset**: **14,204 trending video records** joined with **32 unique category reference catalogs**.
- **Viewership Analyzed**: **20.49 Billion total views**, **537.3 Million likes**, and **56.5 Million comments**.
- **Storage Optimization**: Converted raw CSV files to **Snappy-compressed Parquet**, reducing S3 storage costs by **~80%**.
- **Query Acceleration**: Accelerated query performance by **10x** using partitioned column-oriented storage and serverless SQL.

---

## 🏗️ System Architecture

```text
┌────────────────────────┐      ┌────────────────────────┐      ┌────────────────────────┐
│  Kaggle Raw Dataset    │      │  AWS S3 Raw Storage    │      │  AWS Lambda + Wrangler │
│  - Daily Video CSVs    │ ───► │  - Raw Landing Bucket  │ ───► │  - JSON Catalog Parser │
│  - JSON Category Maps  │      │  - Unpartitioned Data  │      │  - Parquet Normalizer  │
└────────────────────────┘      └────────────────────────┘      └────────────────────────┘
                                                                             │
                                                                             ▼
┌────────────────────────┐      ┌────────────────────────┐      ┌────────────────────────┐
│  Amazon Athena / SQL   │      │ AWS Glue Data Catalog  │      │ AWS Glue PySpark ETL   │
│  - Serverless SQL      │ ◄─── │ - Materialized Views   │ ◄─── │ - Pushdown Predicates  │
│  - Fast Analytics      │      │ - Partition Metadata   │      │ - Inner Join Execution │
└────────────────────────┘      └────────────────────────┘      └────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        Enterprise Web Console & Analytics Dashboard                   │
│         - Live DuckDB SQL Sandbox    - Interactive Chart.js Visualizations           │
│         - Glue Job CloudWatch Logs   - CSV Data Exports & Multi-Column Sorting       │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Analytics Key Insights

| Metric | Analyzed Value | Description |
|---|---|---|
| **Total Processed Records** | `14,204` | Cleaned and joined trending video records |
| **Total Views Analyzed** | `20,491,030,082` | **20.49 Billion** cumulative video views |
| **Total Likes** | `537,308,908` | **537.3 Million** cumulative user likes |
| **Total Comments** | `56,560,318` | **56.5 Million** user comments |
| **Top Category by Views** | **Music** | **6.08 Billion views** (`~29.7%` share) |
| **Top Regional Share** | **Great Britain (GB)** | **10.71 Billion views** (`~52.2%` share) |

---

## 🛠️ Repository Structure

```text
AWS-Youtube-DataPipeline/
├── scripts/
│   ├── lambda_function.py               # AWS Lambda function for parsing raw JSON category maps
│   ├── etl_pipeline_csv_to_parquet.py    # AWS Glue PySpark job for CSV cleaning & partitioning
│   └── etl_pipeline_materialised_view.py # AWS Glue PySpark job for relational inner join & analytics
├── run_pipeline.py                      # Local Python ETL engine (replicates Lambda & Glue jobs)
├── server.py                            # Python HTTP backend server & DuckDB SQL Query API
├── web/                                 # Enterprise Web Console Frontend
│   ├── index.html                       # Dashboard UI layout & Athena SQL console
│   ├── style.css                        # Enterprise dark-mode styling
│   └── app.js                           # Chart.js analytics & live query execution
├── data/
│   ├── raw/                             # Raw JSON category reference mappings
│   ├── cleansed/                        # Partitioned Parquet data lake (region=ca, gb, us)
│   └── analytics/                       # Joined materialized views (materialised_view_local.csv)
├── generate_presentation.py             # Python script for generating PowerPoint deck (.pptx)
├── AWS_YouTube_Data_Pipeline_Presentation.pptx # 8-Slide PowerPoint Presentation Deck
├── package.json                         # Project npm script shortcuts
└── README.md                            # Project documentation
```

---

## 💻 Quick Start & Local Execution

### Prerequisites
- **Python 3.11+** installed
- **Node.js 18+** installed

### 1. Installation
Clone the repository and install required dependencies:
```bash
git clone https://github.com/ritikyadav-io/AWS-Youtube-DataPipeline.git
cd AWS-Youtube-DataPipeline
py -m pip install pandas pyarrow duckdb python-pptx
```

### 2. Launch Web Analytics Dashboard & SQL Console
Run the project via `npm`:
```bash
npm run dev
```
Or launch directly using Python:
```bash
py server.py
```
Open your browser at **[http://localhost:8080](http://localhost:8080)**.

### 3. Run Local ETL Pipeline (CLI)
Re-execute the ETL engine to process datasets locally:
```bash
npm run etl
```

### 4. Re-generate PowerPoint Presentation Deck
Generate the `.pptx` presentation deck:
```bash
npm run presentation
```

---

## 🔍 Amazon Athena / DuckDB SQL Query Console

The dashboard includes a live SQL console where you can query the target dataset (`youtube_data` table).

### Sample SQL Queries:

#### 1. Top 5 Categories by Views & Average Like Rate
```sql
SELECT category_name, 
       COUNT(*) as video_count, 
       SUM(views) as total_views, 
       ROUND(AVG(like_rate_pct), 2) as avg_like_pct 
FROM youtube_data 
GROUP BY category_name 
ORDER BY total_views DESC 
LIMIT 5;
```

#### 2. Top 10 YouTube Channels by Viewership
```sql
SELECT channel_title, 
       COUNT(*) as video_count, 
       SUM(views) as total_views 
FROM youtube_data 
GROUP BY channel_title 
ORDER BY total_views DESC 
LIMIT 10;
```

---

## 📄 PowerPoint Presentation Deck

An automated 8-slide presentation deck is included in the root directory:
- 📁 **File**: [AWS_YouTube_Data_Pipeline_Presentation.pptx](AWS_YouTube_Data_Pipeline_Presentation.pptx)

---

## 📜 License

This project is licensed under the **MIT License** - see the `LICENSE` file for details.

<div align="center">
  <sub>Built with ❤️ by Ritik Yadav</sub>
</div>
