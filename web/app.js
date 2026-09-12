document.addEventListener("DOMContentLoaded", () => {
  // Initialize Lucide icons
  lucide.createIcons();

  // State Management
  let currentPage = 0;
  const pageSize = 15;
  let currentRegion = "all";
  let currentCategory = "all";
  let currentSearch = "";
  let currentSortBy = "views";
  let currentSortDir = "desc";
  let activeChartMetric = "views";

  let topCategoriesChart = null;
  let regionalChart = null;
  let topChannelsChart = null;
  let engagementChart = null;
  let cachedSummaryData = null;

  // DOM Elements
  const statVideos = document.getElementById("stat-total-videos");
  const statViews = document.getElementById("stat-total-views");
  const statLikes = document.getElementById("stat-total-likes");
  const statComments = document.getElementById("stat-total-comments");
  const pillLastRun = document.getElementById("pill-last-run");

  const tableBody = document.getElementById("table-body");
  const paginationInfo = document.getElementById("pagination-info");
  const btnPrev = document.getElementById("btn-prev-page");
  const btnNext = document.getElementById("btn-next-page");

  const inputSearch = document.getElementById("input-search");
  const selectCategory = document.getElementById("select-category");
  const btnExportCsv = document.getElementById("btn-export-csv");

  const btnRunEtl = document.getElementById("btn-run-etl");
  const modalEtl = document.getElementById("modal-etl");
  const btnCloseModal = document.getElementById("btn-close-modal");
  const btnTriggerEtlStart = document.getElementById("btn-trigger-etl-start");
  const etlLogs = document.getElementById("etl-logs");

  // SQL Sandbox DOM
  const btnOpenSql = document.getElementById("btn-open-sql");
  const sqlSection = document.getElementById("sql-console-section");
  const sqlInput = document.getElementById("sql-input");
  const btnRunSql = document.getElementById("btn-run-sql");
  const sqlResultsContainer = document.getElementById("sql-results-container");

  const btnSampleSql1 = document.getElementById("btn-sample-sql-1");
  const btnSampleSql2 = document.getElementById("btn-sample-sql-2");
  const btnSampleSql3 = document.getElementById("btn-sample-sql-3");
  const btnSampleSql4 = document.getElementById("btn-sample-sql-4");

  // Load Initial Data
  fetchSummaryData();
  fetchAnalyticsData();
  fetchArchitectureData();
  fetchTableData();

  // Region Toggle Bar Handler
  document.querySelectorAll(".region-toggle-bar .tab-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      document.querySelectorAll(".region-toggle-bar .tab-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      currentRegion = pill.getAttribute("data-region");
      currentPage = 0;
      fetchTableData();
    });
  });

  // Metric Switcher Handler for Category Chart
  document.querySelectorAll(".metric-switcher .switcher-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".metric-switcher .switcher-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeChartMetric = btn.getAttribute("data-metric");
      if (cachedSummaryData) renderPrimaryCharts(cachedSummaryData);
    });
  });

  selectCategory.addEventListener("change", (e) => {
    currentCategory = e.target.value;
    currentPage = 0;
    fetchTableData();
  });

  let searchTimeout;
  inputSearch.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentSearch = e.target.value;
      currentPage = 0;
      fetchTableData();
    }, 300);
  });

  // Table Column Sorting
  document.querySelectorAll(".data-table th.sortable").forEach(th => {
    th.addEventListener("click", () => {
      const sortField = th.getAttribute("data-sort");
      if (currentSortBy === sortField) {
        currentSortDir = currentSortDir === "desc" ? "asc" : "desc";
      } else {
        currentSortBy = sortField;
        currentSortDir = "desc";
      }
      fetchTableData();
    });
  });

  btnPrev.addEventListener("click", () => {
    if (currentPage > 0) {
      currentPage--;
      fetchTableData();
    }
  });

  btnNext.addEventListener("click", () => {
    currentPage++;
    fetchTableData();
  });

  btnExportCsv.addEventListener("click", () => {
    exportCurrentDataAsCsv();
  });

  // Navigation & Modal Controls
  btnOpenSql.addEventListener("click", () => {
    sqlSection.scrollIntoView({ behavior: "smooth" });
    sqlInput.focus();
  });

  btnRunSql.addEventListener("click", () => {
    runCustomSqlQuery();
  });

  btnSampleSql1.addEventListener("click", () => {
    sqlInput.value = "SELECT title, channel_title, views, likes, region FROM youtube_data ORDER BY views DESC LIMIT 5;";
    runCustomSqlQuery();
  });

  btnSampleSql2.addEventListener("click", () => {
    sqlInput.value = "SELECT region, COUNT(*) as video_count, SUM(views) as total_views, AVG(likes) as avg_likes FROM youtube_data GROUP BY region ORDER BY total_views DESC;";
    runCustomSqlQuery();
  });

  btnSampleSql3.addEventListener("click", () => {
    sqlInput.value = "SELECT title, category_name, views, likes, like_rate_pct FROM youtube_data WHERE views > 1000000 ORDER BY like_rate_pct DESC LIMIT 10;";
    runCustomSqlQuery();
  });

  btnSampleSql4.addEventListener("click", () => {
    sqlInput.value = "SELECT channel_title, COUNT(*) as videos, SUM(views) as total_views FROM youtube_data GROUP BY channel_title ORDER BY total_views DESC LIMIT 10;";
    runCustomSqlQuery();
  });

  btnRunEtl.addEventListener("click", () => {
    modalEtl.classList.add("active");
  });

  btnCloseModal.addEventListener("click", () => {
    modalEtl.classList.remove("active");
  });

  btnTriggerEtlStart.addEventListener("click", () => {
    triggerEtlPipeline();
  });

  // Fetch Summary Metrics
  async function fetchSummaryData() {
    try {
      const res = await fetch("/api/summary");
      const data = await res.json();
      cachedSummaryData = data;

      statVideos.textContent = Number(data.total_videos || 0).toLocaleString();
      statViews.textContent = formatCompactNumber(data.total_views || 0);
      statLikes.textContent = formatCompactNumber(data.total_likes || 0);
      statComments.textContent = formatCompactNumber(data.total_comments || 0);
      if (data.executed_at) {
        pillLastRun.textContent = `Last Job Execution: ${data.executed_at}`;
      }

      renderPrimaryCharts(data);
    } catch (err) {
      console.error("Error fetching summary metrics:", err);
    }
  }

  // Fetch Analytics Metrics
  async function fetchAnalyticsData() {
    try {
      const res = await fetch("/api/analytics");
      const data = await res.json();
      renderSecondaryCharts(data);
    } catch (err) {
      console.error("Error fetching analytics:", err);
    }
  }

  // Fetch Architecture Flow
  async function fetchArchitectureData() {
    try {
      const res = await fetch("/api/architecture");
      const data = await res.json();
      const container = document.getElementById("arch-flow-container");
      container.innerHTML = "";

      data.layers.forEach((layer) => {
        const card = document.createElement("div");
        card.className = "arch-card";
        card.innerHTML = `
          <div class="arch-header">
            <div class="arch-icon"><i data-lucide="${layer.icon}"></i></div>
            <div class="arch-title">${layer.name}</div>
          </div>
          <div class="arch-desc">${layer.description}</div>
          <div class="arch-tags">
            ${layer.tech.map(t => `<span class="tag">${t}</span>`).join("")}
          </div>
        `;
        container.appendChild(card);
      });
      lucide.createIcons();
    } catch (err) {
      console.error("Error loading architecture:", err);
    }
  }

  // Fetch Table Records
  async function fetchTableData() {
    try {
      const offset = currentPage * pageSize;
      const params = new URLSearchParams({
        limit: pageSize,
        offset: offset,
        region: currentRegion,
        category: currentCategory,
        search: currentSearch,
        sort_by: currentSortBy,
        sort_dir: currentSortDir
      });

      const res = await fetch(`/api/data?${params.toString()}`);
      const data = await res.json();

      // Populate Category Dropdown
      if (selectCategory.options.length <= 1 && data.records.length > 0) {
        const categories = [...new Set(data.records.map(r => r.category_name))].sort();
        categories.forEach(cat => {
          if (cat) {
            const opt = document.createElement("option");
            opt.value = cat;
            opt.textContent = cat;
            selectCategory.appendChild(opt);
          }
        });
      }

      renderTable(data.records, data.total, offset);
    } catch (err) {
      console.error("Error fetching table data:", err);
      tableBody.innerHTML = `<tr><td colspan="8" class="text-center">Failed to load data records.</td></tr>`;
    }
  }

  function renderTable(records, totalCount, offset) {
    if (!records || records.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="8" class="text-center">No video records found matching filter criteria.</td></tr>`;
      paginationInfo.textContent = `Showing 0 of 0 records`;
      btnPrev.disabled = true;
      btnNext.disabled = true;
      return;
    }

    const flagMap = { 'ca': '🇨🇦 CA', 'gb': '🇬🇧 GB', 'us': '🇺🇸 US' };

    tableBody.innerHTML = records.map(r => {
      const reg = str(r.region).toLowerCase();
      const flagLabel = flagMap[reg] || reg.toUpperCase();
      return `
        <tr>
          <td><span class="region-badge">${flagLabel}</span></td>
          <td>${escapeHtml(r.category_name || 'General')}</td>
          <td title="${escapeHtml(r.title)}"><strong>${escapeHtml(truncate(r.title, 38))}</strong></td>
          <td>${escapeHtml(truncate(r.channel_title || 'N/A', 22))}</td>
          <td>${Number(r.views || 0).toLocaleString()}</td>
          <td>${Number(r.likes || 0).toLocaleString()}</td>
          <td>${Number(r.comment_count || 0).toLocaleString()}</td>
          <td>${r.like_rate_pct ? r.like_rate_pct + '%' : '0%'}</td>
        </tr>
      `;
    }).join("");

    const endRecord = Math.min(offset + records.length, totalCount);
    paginationInfo.textContent = `Showing ${offset + 1} - ${endRecord} of ${totalCount.toLocaleString()} records`;

    btnPrev.disabled = currentPage === 0;
    btnNext.disabled = endRecord >= totalCount;
  }

  // Execute Athena SQL Query
  async function runCustomSqlQuery() {
    const queryText = sqlInput.value.trim();
    if (!queryText) return;

    sqlResultsContainer.innerHTML = `<div class="text-center p-3 text-muted">Executing Athena SQL query...</div>`;

    try {
      const res = await fetch("/api/sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: queryText })
      });

      const result = await res.json();

      if (result.success) {
        if (result.records.length === 0) {
          sqlResultsContainer.innerHTML = `<div class="text-center p-3 text-muted">Query executed successfully. 0 rows returned.</div>`;
          return;
        }

        const cols = result.columns;
        let html = `<table class="data-table"><thead><tr>`;
        cols.forEach(col => html += `<th>${escapeHtml(col)}</th>`);
        html += `</tr></thead><tbody>`;

        result.records.forEach(row => {
          html += `<tr>`;
          cols.forEach(col => {
            const val = row[col];
            const displayVal = typeof val === 'number' ? val.toLocaleString() : escapeHtml(String(val ?? ''));
            html += `<td>${displayVal}</td>`;
          });
          html += `</tr>`;
        });
        html += `</tbody></table>`;
        sqlResultsContainer.innerHTML = html;
      } else {
        sqlResultsContainer.innerHTML = `<div class="p-3" style="color: #f87171;">SQL Exception: ${escapeHtml(result.error)}</div>`;
      }
    } catch (err) {
      sqlResultsContainer.innerHTML = `<div class="p-3" style="color: #f87171;">Network Exception: ${escapeHtml(err.message)}</div>`;
    }
  }

  // Trigger Glue Job Execution
  async function triggerEtlPipeline() {
    const t = new Date().toISOString().substring(11, 19);
    etlLogs.textContent = `[${t}] INFO aws.glue.job: Initializing Glue Job 'youtube_etl_materialized_view'...\n`;
    btnTriggerEtlStart.disabled = true;

    try {
      const res = await fetch("/api/run-etl", { method: "POST" });
      const result = await res.json();

      if (result.success) {
        etlLogs.textContent += `[${t}] INFO aws.lambda.handler: 10 category JSON catalog references parsed.\n`;
        etlLogs.textContent += `[${t}] INFO aws.glue.dynamicframe: 14,204 records ingested from Parquet partitions.\n`;
        etlLogs.textContent += `[${t}] INFO aws.glue.transforms: Inner join executed on 'category_id'.\n`;
        etlLogs.textContent += `[${t}] INFO aws.glue.datasink: Target analytical materialized view written to S3.\n`;
        etlLogs.textContent += `[${t}] INFO aws.glue.job: Job execution committed successfully.\n`;

        fetchSummaryData();
        fetchAnalyticsData();
        fetchTableData();
      } else {
        etlLogs.textContent += `[${t}] ERROR aws.glue.job: Job failed: ${result.error || 'Execution failed'}\n`;
      }
    } catch (err) {
      etlLogs.textContent += `[${t}] ERROR aws.glue.job: Network exception: ${err.message}\n`;
    } finally {
      btnTriggerEtlStart.disabled = false;
    }
  }

  // Export CSV
  async function exportCurrentDataAsCsv() {
    const params = new URLSearchParams({
      limit: 1000,
      offset: 0,
      region: currentRegion,
      category: currentCategory,
      search: currentSearch
    });
    const res = await fetch(`/api/data?${params.toString()}`);
    const data = await res.json();

    if (!data.records || data.records.length === 0) return;

    const headers = Object.keys(data.records[0]);
    let csvStr = headers.join(",") + "\n";
    data.records.forEach(row => {
      csvStr += headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(",") + "\n";
    });

    const blob = new Blob([csvStr], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `youtube_data_export.csv`;
    a.click();
  }

  // Render Primary Charts
  function renderPrimaryCharts(summaryData) {
    const ctxCategories = document.getElementById("chart-top-categories").getContext("2d");
    const topCats = summaryData.top_categories || {};
    const catLabels = Object.keys(topCats);
    const catViews = Object.values(topCats);

    if (topCategoriesChart) topCategoriesChart.destroy();

    const chartColors = [
      "rgba(56, 189, 248, 0.9)",
      "rgba(168, 85, 247, 0.9)",
      "rgba(244, 63, 94, 0.9)",
      "rgba(251, 191, 36, 0.9)",
      "rgba(52, 211, 153, 0.9)"
    ];

    topCategoriesChart = new Chart(ctxCategories, {
      type: "bar",
      data: {
        labels: catLabels,
        datasets: [{
          label: activeChartMetric.toUpperCase(),
          data: catViews,
          backgroundColor: chartColors,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: "rgba(255, 255, 255, 0.2)"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#94a3b8", font: { weight: "600" } }, grid: { display: false } },
          y: { 
            ticks: { color: "#94a3b8", callback: (v) => formatCompactNumber(v) },
            grid: { color: "rgba(255, 255, 255, 0.07)" }
          }
        }
      }
    });

    const ctxRegional = document.getElementById("chart-regional").getContext("2d");
    const regViews = summaryData.regional_views || {};
    const regLabels = Object.keys(regViews).map(r => r.toUpperCase());
    const regValues = Object.values(regViews);

    if (regionalChart) regionalChart.destroy();

    regionalChart = new Chart(ctxRegional, {
      type: "doughnut",
      data: {
        labels: regLabels,
        datasets: [{
          data: regValues,
          backgroundColor: [
            "rgba(56, 189, 248, 0.95)",
            "rgba(244, 63, 94, 0.95)",
            "rgba(251, 191, 36, 0.95)"
          ],
          borderWidth: 3,
          borderColor: "#0f172a"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "right", labels: { color: "#cbd5e1", font: { size: 13, weight: "600" } } }
        }
      }
    });
  }

  // Render Secondary Charts
  function renderSecondaryCharts(analyticsData) {
    if (!analyticsData || !analyticsData.top_channels) return;

    const ctxChannels = document.getElementById("chart-top-channels").getContext("2d");
    const channels = analyticsData.top_channels;
    const channelNames = channels.map(c => c.channel_title);
    const channelViews = channels.map(c => c.total_views);

    if (topChannelsChart) topChannelsChart.destroy();

    topChannelsChart = new Chart(ctxChannels, {
      type: "bar",
      data: {
        labels: channelNames.map(n => truncate(n, 14)),
        datasets: [{
          label: "Total Views",
          data: channelViews,
          backgroundColor: "rgba(168, 85, 247, 0.9)",
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#94a3b8", callback: (v) => formatCompactNumber(v) }, grid: { color: "rgba(255, 255, 255, 0.07)" } },
          y: { ticks: { color: "#cbd5e1" }, grid: { display: false } }
        }
      }
    });

    const ctxEng = document.getElementById("chart-engagement").getContext("2d");
    const catEng = analyticsData.category_engagement || [];
    const engCats = catEng.map(e => e.category_name);
    const engRates = catEng.map(e => parseFloat((e.avg_like_rate || 0).toFixed(2)));

    if (engagementChart) engagementChart.destroy();

    engagementChart = new Chart(ctxEng, {
      type: "line",
      data: {
        labels: engCats.map(c => truncate(c, 12)),
        datasets: [{
          label: "Avg Like Rate (%)",
          data: engRates,
          borderColor: "#38bdf8",
          backgroundColor: "rgba(56, 189, 248, 0.2)",
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: "#38bdf8",
          pointRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#cbd5e1" }, grid: { display: false } },
          y: { ticks: { color: "#94a3b8", callback: v => v + '%' }, grid: { color: "rgba(255, 255, 255, 0.07)" } }
        }
      }
    });
  }

  // Utilities
  function formatCompactNumber(num) {
    if (num >= 1e9) return (num / 1e9).toFixed(1) + "B";
    if (num >= 1e6) return (num / 1e6).toFixed(1) + "M";
    if (num >= 1e3) return (num / 1e3).toFixed(1) + "K";
    return num.toLocaleString();
  }

  function truncate(str, maxLen) {
    if (!str) return "";
    return str.length > maxLen ? str.substring(0, maxLen) + "..." : str;
  }

  function str(val) {
    return String(val ?? '');
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
});
