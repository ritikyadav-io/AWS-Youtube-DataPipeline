import os
import sys
import json
import urllib.parse
from http.server import HTTPServer, SimpleHTTPRequestHandler
import duckdb
import run_pipeline

PORT = 8080
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_DIR = os.path.join(BASE_DIR, "web")
ANALYTICS_DIR = os.path.join(BASE_DIR, "data", "analytics")

class PipelineRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query_params = urllib.parse.parse_qs(parsed_url.query)

        if path == "/api/summary":
            self.handle_api_summary()
        elif path == "/api/data":
            self.handle_api_data(query_params)
        elif path == "/api/analytics":
            self.handle_api_analytics()
        elif path == "/api/architecture":
            self.handle_api_architecture()
        else:
            super().do_GET()

    def do_POST(self):
        parsed_url = urllib.parse.urlparse(self.path)
        if parsed_url.path == "/api/run-etl":
            self.handle_api_run_etl()
        elif parsed_url.path == "/api/sql":
            self.handle_api_sql()
        else:
            self.send_error(404, "API endpoint not found")

    def handle_api_summary(self):
        summary_path = os.path.join(ANALYTICS_DIR, "summary_metrics.json")
        if os.path.exists(summary_path):
            with open(summary_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            self._send_json(data)
        else:
            summary = run_pipeline.run_local_pipeline()
            self._send_json(summary)

    def handle_api_data(self, params):
        json_path = os.path.join(ANALYTICS_DIR, "materialised_view_local.json")
        if not os.path.exists(json_path):
            run_pipeline.run_local_pipeline()

        if os.path.exists(json_path):
            with open(json_path, "r", encoding="utf-8") as f:
                records = json.load(f)

            region_filter = params.get("region", [None])[0]
            cat_filter = params.get("category", [None])[0]
            search_query = params.get("search", [None])[0]
            sort_col = params.get("sort_by", ["views"])[0]
            sort_dir = params.get("sort_dir", ["desc"])[0]
            limit = int(params.get("limit", [15])[0])
            offset = int(params.get("offset", [0])[0])

            filtered = records

            if region_filter and region_filter.lower() != "all":
                filtered = [r for r in filtered if str(r.get("region", "")).lower() == region_filter.lower()]

            if cat_filter and cat_filter.lower() != "all":
                filtered = [r for r in filtered if str(r.get("category_name", "")).lower() == cat_filter.lower()]

            if search_query:
                sq = search_query.lower()
                filtered = [
                    r for r in filtered 
                    if sq in str(r.get("title", "")).lower() 
                    or sq in str(r.get("channel_title", "")).lower()
                ]

            # Sorting
            reverse = (sort_dir.lower() == "desc")
            try:
                filtered = sorted(filtered, key=lambda x: x.get(sort_col, 0) or 0, reverse=reverse)
            except Exception:
                pass

            total_count = len(filtered)
            paginated = filtered[offset : offset + limit]

            response = {
                "total": total_count,
                "limit": limit,
                "offset": offset,
                "records": paginated
            }
            self._send_json(response)
        else:
            self._send_json({"total": 0, "records": []})

    def handle_api_analytics(self):
        csv_path = os.path.join(ANALYTICS_DIR, "materialised_view_local.csv")
        if not os.path.exists(csv_path):
            run_pipeline.run_local_pipeline()

        try:
            conn = duckdb.connect()
            # Top 10 Channels by Views
            top_channels_df = conn.execute(f"""
                SELECT channel_title, SUM(CAST(views AS BIGINT)) as total_views, COUNT(*) as video_count
                FROM '{csv_path}'
                GROUP BY channel_title
                ORDER BY total_views DESC
                LIMIT 10
            """).df()

            # Engagement Rate by Category
            category_engagement_df = conn.execute(f"""
                SELECT category_name, 
                       AVG(CAST(likes AS FLOAT) / NULLIF(CAST(views AS FLOAT), 0) * 100) as avg_like_rate,
                       AVG(CAST(comment_count AS FLOAT) / NULLIF(CAST(views AS FLOAT), 0) * 100) as avg_comment_rate
                FROM '{csv_path}'
                GROUP BY category_name
                ORDER BY avg_like_rate DESC
                LIMIT 10
            """).df()

            analytics = {
                "top_channels": top_channels_df.to_dict(orient="records"),
                "category_engagement": category_engagement_df.to_dict(orient="records")
            }
            self._send_json(analytics)
        except Exception as e:
            self._send_json({"error": str(e)}, status=500)

    def handle_api_sql(self):
        content_len = int(self.headers.get('Content-Length', 0))
        post_body = self.rfile.read(content_len).decode('utf-8')
        try:
            payload = json.loads(post_body)
            query = payload.get("query", "").strip()
            
            if not query:
                self._send_json({"error": "Empty SQL query provided"}, status=400)
                return

            csv_path = os.path.join(ANALYTICS_DIR, "materialised_view_local.csv").replace("\\", "/")
            
            # Allow referencing 'youtube_data' table
            conn = duckdb.connect()
            conn.execute(f"CREATE VIEW youtube_data AS SELECT * FROM '{csv_path}'")
            
            result_df = conn.execute(query).df()
            
            # Limit results to 100 max for UI performance
            records = result_df.head(100).to_dict(orient="records")
            columns = list(result_df.columns)
            
            self._send_json({
                "success": True,
                "columns": columns,
                "records": records,
                "row_count": len(records)
            })
        except Exception as e:
            self._send_json({"success": False, "error": str(e)}, status=400)

    def handle_api_architecture(self):
        architecture_info = {
            "title": "AWS YouTube Data Pipeline Architecture",
            "layers": [
                {
                    "name": "1. Ingestion Layer (AWS S3 Raw Bucket)",
                    "description": "Kaggle YouTube daily video statistics (CSV) and category reference mappings (JSON) land in S3 raw storage.",
                    "icon": "bucket",
                    "tech": ["AWS S3"]
                },
                {
                    "name": "2. Serverless Transformation (AWS Lambda & Layers)",
                    "description": "AWS Lambda function with AWS Data Wrangler layer standardizes semi-structured JSON category maps into Parquet format.",
                    "icon": "zap",
                    "tech": ["AWS Lambda", "AWS Data Wrangler", "Pandas"]
                },
                {
                    "name": "3. Scalable ETL Processing (AWS Glue)",
                    "description": "PySpark jobs clean CSV statistics, enforce data schemas, apply partition keys (region), and write to Cleansed S3 storage.",
                    "icon": "cpu",
                    "tech": ["AWS Glue", "PySpark"]
                },
                {
                    "name": "4. Data Catalog & Materialized Analytics",
                    "description": "AWS Glue Data Catalog catalogs cleansed tables. Glue job joins video stats with category metadata into S3 Materialized View.",
                    "icon": "database",
                    "tech": ["AWS Glue Catalog", "Parquet"]
                },
                {
                    "name": "5. Query & Visualization (Amazon Athena & QuickSight)",
                    "description": "Amazon Athena queries materialized views with serverless SQL; AWS QuickSight renders interactive business dashboards.",
                    "icon": "bar-chart-3",
                    "tech": ["Amazon Athena", "AWS QuickSight"]
                }
            ]
        }
        self._send_json(architecture_info)

    def handle_api_run_etl(self):
        try:
            summary = run_pipeline.run_local_pipeline()
            self._send_json({"success": True, "message": "ETL Pipeline completed successfully!", "summary": summary})
        except Exception as e:
            self._send_json({"success": False, "error": str(e)}, status=500)

    def _send_json(self, data, status=200):
        body = json.dumps(data, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

def start_server():
    os.makedirs(WEB_DIR, exist_ok=True)
    server_address = ("", PORT)
    httpd = HTTPServer(server_address, PipelineRequestHandler)
    print("=" * 70)
    print(f"🌐 YOUTUBE DATA PIPELINE WEB DASHBOARD SERVER RUNNING AT:")
    print(f"👉 http://localhost:{PORT}")
    print("=" * 70)
    httpd.serve_forever()

if __name__ == "__main__":
    start_server()
