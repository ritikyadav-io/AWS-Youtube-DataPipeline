import os
import sys
import glob
import json
import time
import pandas as pd

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def run_local_pipeline():
    start_time = time.time()
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    print("-" * 75)
    print(f"[{timestamp}] INFO aws.glue.job: Starting Job 'youtube_etl_materialized_view'")
    print("-" * 75)
    
    base_dir = os.path.dirname(os.path.abspath(__file__))
    raw_json_dir = os.path.join(base_dir, "data", "raw", "raw_statisitics_reference_data")
    cleansed_stats_dir = os.path.join(base_dir, "data", "cleansed", "raw_statisitics")
    analytics_dir = os.path.join(base_dir, "data", "analytics")
    
    os.makedirs(analytics_dir, exist_ok=True)
    
    # -------------------------------------------------------------------------
    # TASK 1: Process Reference Mappings (AWS Lambda Data Wrangler Processing)
    # -------------------------------------------------------------------------
    print(f"[{time.strftime('%H:%M:%S')}] INFO aws.lambda.handler: Ingesting category reference catalog objects...")
    json_files = glob.glob(os.path.join(raw_json_dir, "*.json"))
    
    category_list = []
    category_map = {}
    
    for json_file in json_files:
        region_code = os.path.basename(json_file).split("_")[0].lower()
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                items = data.get("items", [])
                for item in items:
                    cat_id = int(item["id"])
                    cat_title = item["snippet"]["title"]
                    category_map[cat_id] = cat_title
                    category_list.append({
                        "category_id": cat_id,
                        "category_name": cat_title,
                        "ref_region": region_code
                    })
        except Exception as e:
            print(f"[{time.strftime('%H:%M:%S')}] WARN aws.lambda.handler: Failed reading {json_file}: {e}")
            
    cat_df = pd.DataFrame(category_list).drop_duplicates(subset=["category_id"])
    print(f"[{time.strftime('%H:%M:%S')}] INFO aws.lambda.handler: Catalog reference table created with {len(cat_df)} categories.")

    # -------------------------------------------------------------------------
    # TASK 2: Read & Clean Parquet Datasets (AWS Glue DynamicFrame / Spark)
    # -------------------------------------------------------------------------
    print(f"[{time.strftime('%H:%M:%S')}] INFO aws.glue.dynamicframe: Loading partitioned parquet dataset from s3://youtube-data-cleansed/...")
    
    parquet_files = glob.glob(os.path.join(cleansed_stats_dir, "**", "*.parquet"), recursive=True)
    
    dfs = []
    for filepath in parquet_files:
        try:
            df = pd.read_parquet(filepath)
            if "region" not in df.columns:
                norm_path = filepath.replace("\\", "/")
                if "region=" in norm_path:
                    region_part = norm_path.split("region=")[1].split("/")[0]
                    df["region"] = region_part
                else:
                    df["region"] = "unknown"
            dfs.append(df)
        except Exception as e:
            print(f"[{time.strftime('%H:%M:%S')}] WARN aws.glue.dynamicframe: Error reading parquet file {filepath}: {e}")

    if dfs:
        stats_df = pd.concat(dfs, ignore_index=True)
    else:
        stats_df = pd.DataFrame()

    print(f"[{time.strftime('%H:%M:%S')}] INFO aws.glue.job: Loaded {len(stats_df):,} records from partitions: {stats_df['region'].unique().tolist() if not stats_df.empty else []}")

    # -------------------------------------------------------------------------
    # TASK 3: Relational Join & Metric Enrichment (Glue Transformation)
    # -------------------------------------------------------------------------
    print(f"[{time.strftime('%H:%M:%S')}] INFO aws.glue.transforms: Executing Join.apply on key 'category_id'...")

    if not stats_df.empty and not cat_df.empty:
        stats_df["category_id"] = stats_df["category_id"].astype(int)
        cat_df["category_id"] = cat_df["category_id"].astype(int)
        
        materialized_df = pd.merge(
            stats_df,
            cat_df[["category_id", "category_name"]],
            on="category_id",
            how="inner"
        )
        
        materialized_df["views"] = pd.to_numeric(materialized_df["views"], errors="coerce").fillna(0).astype(int)
        materialized_df["likes"] = pd.to_numeric(materialized_df["likes"], errors="coerce").fillna(0).astype(int)
        materialized_df["dislikes"] = pd.to_numeric(materialized_df["dislikes"], errors="coerce").fillna(0).astype(int)
        materialized_df["comment_count"] = pd.to_numeric(materialized_df["comment_count"], errors="coerce").fillna(0).astype(int)
        
        materialized_df["like_rate_pct"] = (materialized_df["likes"] / materialized_df["views"].replace(0, 1) * 100).round(2)
        materialized_df["comment_rate_pct"] = (materialized_df["comment_count"] / materialized_df["views"].replace(0, 1) * 100).round(2)
        materialized_df["engagement_score"] = materialized_df["likes"] + materialized_df["comment_count"]
    else:
        materialized_df = pd.DataFrame()

    print(f"[{time.strftime('%H:%M:%S')}] INFO aws.glue.job: Enriched dataset constructed with {len(materialized_df):,} rows.")

    # -------------------------------------------------------------------------
    # TASK 4: Write Target Datasets (AWS S3 Data Sink & Glue Data Catalog)
    # -------------------------------------------------------------------------
    print(f"[{time.strftime('%H:%M:%S')}] INFO aws.glue.datasink: Writing output to analytics partition...")
    
    csv_output_path = os.path.join(analytics_dir, "materialised_view_local.csv")
    json_output_path = os.path.join(analytics_dir, "materialised_view_local.json")
    summary_output_path = os.path.join(analytics_dir, "summary_metrics.json")
    
    materialized_df.to_csv(csv_output_path, index=False)
    
    sample_records = materialized_df.head(1000).to_dict(orient="records")
    with open(json_output_path, "w", encoding="utf-8") as f:
        json.dump(sample_records, f, indent=2)

    summary = {
        "total_videos": int(len(materialized_df)),
        "total_views": int(materialized_df["views"].sum()),
        "total_likes": int(materialized_df["likes"].sum()),
        "total_comments": int(materialized_df["comment_count"].sum()),
        "regions": materialized_df["region"].unique().tolist(),
        "categories_count": int(materialized_df["category_name"].nunique()),
        "top_categories": materialized_df.groupby("category_name")["views"].sum().sort_values(ascending=False).head(5).to_dict(),
        "regional_views": materialized_df.groupby("region")["views"].sum().to_dict(),
        "executed_at": time.strftime("%Y-%m-%d %H:%M:%S")
    }
    
    with open(summary_output_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    elapsed = round(time.time() - start_time, 2)
    print(f"[{time.strftime('%H:%M:%S')}] INFO aws.glue.job: Job commit completed successfully in {elapsed}s.")
    print("-" * 75 + "\n")
    return summary

if __name__ == "__main__":
    run_local_pipeline()
