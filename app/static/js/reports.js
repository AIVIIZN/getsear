/**
 * Sear POS — Reports JavaScript
 *
 * Chart.js initialization helpers, CSV export, and print utilities.
 * Loaded on all report pages. Requires Chart.js to be loaded from CDN first.
 */

const SearReports = (() => {
  'use strict';

  // ----------------------------------------------------------------
  // CSV Export
  // ----------------------------------------------------------------

  /**
   * Export report data as CSV by POSTing to the export endpoint.
   * Triggers a browser download.
   *
   * @param {string} url - API endpoint (e.g. /api/v1/reports/export)
   * @param {Object} params - Parameters including report_type, start_date, end_date
   */
  async function exportCSV(url, params) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!resp.ok) {
        const errorJson = await resp.json().catch(() => null);
        const msg = errorJson?.message || `Export failed (${resp.status})`;
        Alpine.store('toasts').add(msg, 'error');
        return;
      }

      const blob = await resp.blob();
      const disposition = resp.headers.get('Content-Disposition') || '';
      const filenameMatch = disposition.match(/filename=(.+)/);
      const filename = filenameMatch ? filenameMatch[1] : `sear-report-${params.report_type || 'export'}.csv`;

      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);

      Alpine.store('toasts').add('Report exported', 'success');
    } catch (err) {
      console.error('CSV export failed', err);
      Alpine.store('toasts').add('Export failed', 'error');
    }
  }

  /**
   * Generate CSV from an HTML table's data and trigger download.
   *
   * @param {string} tableSelector - CSS selector for the table element
   * @param {string} filename - Download filename
   */
  function exportTableCSV(tableSelector, filename) {
    const table = document.querySelector(tableSelector);
    if (!table) return;

    const rows = [];
    table.querySelectorAll('tr').forEach(tr => {
      const cells = [];
      tr.querySelectorAll('th, td').forEach(cell => {
        let text = cell.innerText.replace(/"/g, '""').trim();
        if (text.includes(',') || text.includes('"') || text.includes('\n')) {
          text = `"${text}"`;
        }
        cells.push(text);
      });
      if (cells.length > 0) rows.push(cells.join(','));
    });

    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename || 'sear-report.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  // ----------------------------------------------------------------
  // Print
  // ----------------------------------------------------------------

  /**
   * Print the current page with report-friendly styles.
   */
  function printReport() {
    const style = document.createElement('style');
    style.setAttribute('media', 'print');
    style.textContent = `
      @media print {
        body { background: white !important; }
        .no-print, nav, aside, button, .btn, .btn-primary, .btn-secondary,
        .btn-ghost, .btn-icon, [x-cloak] { display: none !important; }
        .card, .card-padded { box-shadow: none !important; border: 1px solid #e5e7eb !important; }
        main { overflow: visible !important; padding: 0 !important; margin: 0 !important; }
        table { page-break-inside: auto; }
        tr { page-break-inside: avoid; page-break-after: auto; }
        canvas { max-width: 100% !important; height: auto !important; }
      }
    `;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => document.head.removeChild(style), 1000);
  }

  // ----------------------------------------------------------------
  // Chart Defaults
  // ----------------------------------------------------------------

  /**
   * Apply Sear POS default styling to Chart.js if it's loaded.
   */
  function applyChartDefaults() {
    if (typeof Chart === 'undefined') return;

    Chart.defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
    Chart.defaults.font.size = 13;
    Chart.defaults.color = '#6b7280';
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.padding = 16;
    Chart.defaults.plugins.tooltip.backgroundColor = '#ffffff';
    Chart.defaults.plugins.tooltip.titleColor = '#1f2937';
    Chart.defaults.plugins.tooltip.bodyColor = '#374151';
    Chart.defaults.plugins.tooltip.borderColor = '#e5e7eb';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.padding = 12;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.displayColors = true;
    Chart.defaults.plugins.tooltip.boxPadding = 4;
    Chart.defaults.elements.line.borderWidth = 2;
    Chart.defaults.elements.point.radius = 3;
    Chart.defaults.elements.point.hoverRadius = 5;
    Chart.defaults.elements.arc.borderWidth = 2;
    Chart.defaults.elements.arc.borderColor = '#ffffff';
    Chart.defaults.scale.grid = { color: '#f3f4f6' };
  }

  // ----------------------------------------------------------------
  // Chart Color Palette
  // ----------------------------------------------------------------

  const COLORS = {
    primary: '#0F766E',
    primaryLight: 'rgba(15, 118, 110, 0.1)',
    accent: '#F59E0B',
    success: '#22C55E',
    error: '#EF4444',
    info: '#3B82F6',
    violet: '#8B5CF6',
    pink: '#EC4899',
    gray: '#6B7280',
    palette: [
      '#0F766E', '#14B8A6', '#F59E0B', '#EF4444',
      '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280',
      '#22C55E', '#D97706', '#DC2626', '#2563EB',
    ],
    pmix: {
      star: '#22C55E',
      plowhorse: '#3B82F6',
      puzzle: '#F59E0B',
      dog: '#EF4444',
    },
  };

  // ----------------------------------------------------------------
  // Area Chart Factory
  // ----------------------------------------------------------------

  /**
   * Create a filled area chart.
   *
   * @param {HTMLCanvasElement|string} canvas - Canvas element or ID
   * @param {Object} options - { labels, data, label, color, fill }
   * @returns {Chart}
   */
  function createAreaChart(canvas, { labels, data, label = 'Sales', color = COLORS.primary, fill = true }) {
    const ctx = typeof canvas === 'string' ? document.getElementById(canvas) : canvas;
    if (!ctx) return null;

    return new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label,
          data,
          borderColor: color,
          backgroundColor: fill ? color.replace(')', ', 0.1)').replace('rgb', 'rgba') : 'transparent',
          fill,
          tension: 0.3,
          pointBackgroundColor: color,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { maxRotation: 0 } },
          y: { beginAtZero: true, ticks: { callback: (v) => '$' + v.toLocaleString() } },
        },
      },
    });
  }

  // ----------------------------------------------------------------
  // Pie / Donut Factory
  // ----------------------------------------------------------------

  /**
   * Create a pie or doughnut chart.
   *
   * @param {HTMLCanvasElement|string} canvas
   * @param {Object} options - { labels, data, type, colors, cutout }
   * @returns {Chart}
   */
  function createPieChart(canvas, { labels, data, type = 'pie', colors, cutout }) {
    const ctx = typeof canvas === 'string' ? document.getElementById(canvas) : canvas;
    if (!ctx) return null;

    const config = {
      type: type === 'donut' ? 'doughnut' : type,
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors || COLORS.palette.slice(0, labels.length),
          borderWidth: 2,
          borderColor: '#fff',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right' },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: $${ctx.parsed.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
            },
          },
        },
      },
    };

    if (cutout || type === 'donut') {
      config.data.datasets[0].cutout = cutout || '60%';
    }

    return new Chart(ctx, config);
  }

  // ----------------------------------------------------------------
  // Gauge Chart Factory
  // ----------------------------------------------------------------

  /**
   * Create a semicircle gauge chart (doughnut with 180 degree arc).
   *
   * @param {HTMLCanvasElement|string} canvas
   * @param {Object} options - { value, max, thresholds }
   * @returns {Chart}
   */
  function createGauge(canvas, { value, max = 100, thresholds = { green: 25, yellow: 30, red: Infinity } }) {
    const ctx = typeof canvas === 'string' ? document.getElementById(canvas) : canvas;
    if (!ctx) return null;

    let color;
    if (value <= thresholds.green) color = COLORS.success;
    else if (value <= thresholds.yellow) color = COLORS.accent;
    else color = COLORS.error;

    const remaining = Math.max(0, max - value);

    return new Chart(ctx, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [value, remaining],
          backgroundColor: [color, '#f3f4f6'],
          borderWidth: 0,
          cutout: '75%',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        rotation: -90,
        circumference: 180,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
      },
      plugins: [{
        id: 'gaugeLabel',
        afterDraw(chart) {
          const { ctx: c, chartArea } = chart;
          const centerX = (chartArea.left + chartArea.right) / 2;
          const centerY = (chartArea.top + chartArea.bottom) / 2 + 10;
          c.save();
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.font = "bold 28px 'Inter', sans-serif";
          c.fillStyle = color;
          c.fillText(value.toFixed(1) + '%', centerX, centerY);
          c.restore();
        },
      }],
    });
  }

  // ----------------------------------------------------------------
  // Scatter Chart Factory (PMIX)
  // ----------------------------------------------------------------

  /**
   * Create a menu engineering scatter chart.
   *
   * @param {HTMLCanvasElement|string} canvas
   * @param {Array} items - Array of { name, quantity, profit_margin, label }
   * @returns {Chart}
   */
  function createPMIXScatter(canvas, items) {
    const ctx = typeof canvas === 'string' ? document.getElementById(canvas) : canvas;
    if (!ctx) return null;

    const datasets = {};
    const colorMap = {
      Star: COLORS.pmix.star,
      Plowhorse: COLORS.pmix.plowhorse,
      Puzzle: COLORS.pmix.puzzle,
      Dog: COLORS.pmix.dog,
    };

    items.forEach(item => {
      const label = item.label || 'Unknown';
      if (!datasets[label]) {
        datasets[label] = {
          label,
          data: [],
          backgroundColor: colorMap[label] || COLORS.gray,
          borderColor: colorMap[label] || COLORS.gray,
          pointRadius: 6,
          pointHoverRadius: 9,
        };
      }
      datasets[label].data.push({ x: item.quantity, y: item.profit_margin, name: item.name });
    });

    return new Chart(ctx, {
      type: 'scatter',
      data: { datasets: Object.values(datasets) },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              title: () => '',
              label: (ctx) => `${ctx.raw.name}: ${ctx.raw.x} sold, ${ctx.raw.y.toFixed(1)}% margin`,
            },
          },
        },
        scales: {
          x: { title: { display: true, text: 'Quantity Sold', font: { weight: 'bold' } } },
          y: { title: { display: true, text: 'Profit Margin %', font: { weight: 'bold' } }, ticks: { callback: (v) => v + '%' } },
        },
      },
    });
  }

  // ----------------------------------------------------------------
  // Money Formatter
  // ----------------------------------------------------------------

  /**
   * Format cents to dollar string.
   * @param {number} cents
   * @returns {string}
   */
  function formatMoney(cents) {
    return '$' + ((cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // ----------------------------------------------------------------
  // Initialize on load
  // ----------------------------------------------------------------

  document.addEventListener('DOMContentLoaded', () => {
    applyChartDefaults();
  });

  // Also initialize when Alpine is ready (for pages that load Chart.js after DOMContentLoaded)
  document.addEventListener('alpine:init', () => {
    applyChartDefaults();
  });

  // Public API
  return {
    exportCSV,
    exportTableCSV,
    printReport,
    createAreaChart,
    createPieChart,
    createGauge,
    createPMIXScatter,
    formatMoney,
    COLORS,
    applyChartDefaults,
  };
})();

// Export for ES module consumers
if (typeof window !== 'undefined') {
  window.SearReports = SearReports;
}
