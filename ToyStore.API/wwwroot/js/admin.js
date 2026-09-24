/* ============================================================
   TOYSTORE ADMIN - admin.js
   Full In-Page CRUD Engine (No Dialogs) & Modern UI 2026
   ============================================================ */

'use strict';

// ── STATE ───────────────────────────────────────────────────
const app = document.getElementById('app');
let token = localStorage.getItem('toyStoreToken');
let currentUser = JSON.parse(localStorage.getItem('toyStoreUser') || 'null');
let currentView = 'dashboard';
let cache = {};
let ref = { categories: [], brands: [], suppliers: [], variants: [] };
let revenueChart = null;
let dashboardRefreshTimer = null;
let revenueChartPeriod = 'day30';
let revenueChartCustom = {
  groupBy: 'day',
  from: revenueDateInputValue(new Date(Date.now() - (29 * 86400000))),
  to: revenueDateInputValue(new Date())
};
let productVariantRowIndex = 0;

// ── MODULE DEFINITIONS ──────────────────────────────────────
const MODULES = {
  dashboard: { title: 'Tổng quan hệ thống', kicker: 'TỔNG QUAN' },
  products: {
    title: 'Sản phẩm', kicker: 'HÀNG HÓA & KHO',
    endpoint: 'Product',
    columns: ['Ảnh', 'Tên sản phẩm', 'Danh mục', 'Thương hiệu', 'Giá bán', 'Trạng thái'],
    canAdd: true, canEdit: true, canDelete: true
  },
  liquidation: {
    title: 'Thanh lý hàng', kicker: 'HÀNG HÓA & KHO'
  },
  categories: {
    title: 'Danh mục', kicker: 'HÀNG HÓA & KHO',
    endpoint: 'Category',
    columns: ['Tên danh mục', 'Mô tả', 'Trạng thái'],
    canAdd: true, canEdit: true, canDelete: true
  },
  brands: {
    title: 'Thương hiệu', kicker: 'HÀNG HÓA & KHO',
    endpoint: 'Brand',
    columns: ['Thương hiệu', 'Mô tả', 'Trạng thái'],
    canAdd: true, canEdit: true, canDelete: true
  },
  inventory: {
    title: 'Tồn kho', kicker: 'HÀNG HÓA & KHO',
    endpoint: 'Inventory',
    columns: ['SKU', 'Sản phẩm', 'Tồn kho', 'Đã giữ', 'Có thể bán', 'Cập nhật'],
    canAdd: false, canEdit: true, canDelete: false
  },
  orders: {
    title: 'Đơn hàng', kicker: 'VẬN HÀNH & NHẬP HÀNG',
    endpoint: 'Order',
    columns: ['Mã đơn', 'Khách hàng', 'SĐT', 'Ngày đặt', 'Giá trị', 'Thanh toán', 'Trạng thái'],
    canAdd: false, canEdit: true, canDelete: false
  },
  suppliers: {
    title: 'Nhà cung cấp', kicker: 'VẬN HÀNH & NHẬP HÀNG',
    endpoint: 'Supplier',
    columns: ['Nhà cung cấp', 'Số điện thoại', 'Email', 'Mã số thuế', 'Trạng thái'],
    canAdd: true, canEdit: true, canDelete: true
  },
  imports: {
    title: 'Phiếu đặt hàng NCC', kicker: 'VẬN HÀNH & NHẬP HÀNG',
    endpoint: 'ImportReceipt',
    columns: ['Mã phiếu', 'Nhà cung cấp', 'Người đặt', 'Ngày đặt', 'Tổng tiền', 'Trạng thái'],
    canAdd: true, canEdit: true, canDelete: true
  },
  promotions: {
    title: 'Khuyến mãi', kicker: 'MARKETING',
    endpoint: 'Promotion',
    columns: ['Tên chương trình', 'Loại giảm giá', 'Giá trị', 'Thời gian áp dụng', 'Trạng thái'],
    canAdd: true, canEdit: true, canDelete: true
  },
  vouchers: {
    title: 'Voucher', kicker: 'MARKETING',
    endpoint: 'Voucher',
    columns: ['Mã voucher', 'Tên voucher', 'Giá trị giảm', 'Điểm đổi', 'Đơn tối thiểu', 'Hạn dùng', 'Trạng thái'],
    canAdd: true, canEdit: true, canDelete: true
  },
  customers: {
    title: 'Khách hàng', kicker: 'KHÁCH HÀNG',
    endpoint: 'Customer',
    columns: ['Họ và tên', 'Email', 'Số điện thoại', 'Hạng TV', 'Tổng chi tiêu', 'Đơn hàng'],
    canAdd: false, canEdit: true, canDelete: false
  },
  customerCare: {
    title: 'Chăm sóc khách hàng', kicker: 'KHÁCH HÀNG'
  },
  users: {
    title: 'Phân quyền người dùng', kicker: 'HỆ THỐNG',
    endpoint: 'Auth/users',
    columns: ['Họ và tên', 'Email', 'Số điện thoại', 'Vai trò (Role)', 'Trạng thái'],
    canAdd: false, canEdit: true, canDelete: false
  }
};

const ORDER_STATUS_LABELS = ['Chờ xác nhận', 'Đã xác nhận', 'Đang xử lý', 'Đang giao', 'Hoàn tất', 'Đã hủy'];
const IMPORT_STATUS_MAP = {
  1: { label: 'Chờ duyệt', pill: 'warning' },
  2: { label: 'Đang nhập một phần', pill: 'info' },
  3: { label: 'Đã duyệt & Nhập kho', pill: 'success' },
  4: { label: 'Đã hủy', pill: 'danger' }
};

// ── UTILITIES ───────────────────────────────────────────────
const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const money = v => v == null ? '—' : Number(v).toLocaleString('vi-VN') + ' đ';
const fmtDate = s => s ? new Date(s).toLocaleDateString('vi-VN') : '—';
const fmtDateTime = s => s ? new Date(s).toLocaleString('vi-VN') : '—';
const productVariantsOf = product => product?.productVariants || product?.variants || [];
const hasAvailableStock = product => productVariantsOf(product)
  .some(variant => Number(variant.availableQuantity || 0) > 0);

function pill(text, type = 'neutral') {
  return `<span class="pill ${type}">${esc(text)}</span>`;
}

function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.className = `toast ${type} show`;
  const icon = document.getElementById('toastIcon');
  if (icon) icon.textContent = type === 'success' ? '✓' : (type === 'error' ? '✕' : 'ℹ');
  document.getElementById('toastMsg').textContent = msg;
  setTimeout(() => el.classList.remove('show'), 3500);
}

async function api(path, opt = {}) {
  const res = await fetch(`/api/${path}`, {
    ...opt,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(opt.headers || {})
    }
  });
  if (res.status === 401) {
    localStorage.removeItem('toyStoreToken');
    localStorage.removeItem('toyStoreUser');
    location.replace('/customer.html');
    return null;
  }
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.message || `Lỗi yêu cầu (${res.status})`);
  }
  return res.status === 204 ? null : res.json();
}

async function checkApiStatus(notify = false) {
  const dot = document.getElementById('apiDot');
  const label = document.getElementById('apiLabel');
  try {
    const res = await fetch('/api/Health', { cache: 'no-store' });
    if (res.ok) {
      if (dot) dot.className = 'api-dot';
      if (label) label.textContent = 'API Online';
      if (notify) toast('Backend API hoạt động tốt!', 'success');
    } else {
      throw new Error();
    }
  } catch {
    if (dot) dot.className = 'api-dot offline';
    if (label) label.textContent = 'API Offline';
    if (notify) toast('Không thể kết nối đến Backend API', 'error');
  }
}

async function loadRef() {
  try {
    const [c, b, s, p] = await Promise.all([
      api('Category').catch(() => []),
      api('Brand').catch(() => []),
      api('Supplier').catch(() => []),
      api('Product').catch(() => [])
    ]);
    ref.categories = c || [];
    ref.brands = b || [];
    ref.suppliers = s || [];
    ref.products = p || [];
  } catch (err) {
    console.error('Failed to load reference data:', err);
  }
}

// ── NAVIGATION & ROUTING ────────────────────────────────────
function navigate() {
  const hash = location.hash.slice(1) || 'dashboard';
  currentView = hash;
  if (hash !== 'dashboard') stopDashboardRealtime();
  
  document.querySelectorAll('.nav-item').forEach(a => {
    a.classList.toggle('active', a.dataset.view === hash);
  });
  
  const currentTitle = MODULES[hash]?.title || hash.toUpperCase();
  document.getElementById('breadcrumbCurrent').textContent = currentTitle;

  if (hash === 'dashboard') {
    renderDashboard();
  } else if (hash === 'liquidation') {
    renderLiquidation();
  } else if (hash === 'customer-care') {
    renderCustomerCare();
  } else {
    renderList(hash);
  }
}

window.addEventListener('hashchange', navigate);

// ── 1. DASHBOARD VIEW ───────────────────────────────────────
function revenueDateInputValue(date) {
  const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
  return localDate.toISOString().slice(0, 10);
}

function revenueMonthInputValue(date) {
  return revenueDateInputValue(date).slice(0, 7);
}

function setRevenueCustomDefaults(groupBy) {
  const today = new Date();
  revenueChartCustom.groupBy = groupBy;

  if (groupBy === 'month') {
    const firstMonth = new Date(today.getFullYear(), today.getMonth() - 11, 1);
    revenueChartCustom.from = revenueMonthInputValue(firstMonth);
    revenueChartCustom.to = revenueMonthInputValue(today);
    return;
  }

  if (groupBy === 'year') {
    revenueChartCustom.from = String(today.getFullYear() - 4);
    revenueChartCustom.to = String(today.getFullYear());
    return;
  }

  revenueChartCustom.from = revenueDateInputValue(new Date(today.getTime() - (29 * 86400000)));
  revenueChartCustom.to = revenueDateInputValue(today);
}

function revenueCustomControlsHtml() {
  if (revenueChartPeriod !== 'custom') return '';

  const inputType = revenueChartCustom.groupBy === 'day'
    ? 'date'
    : revenueChartCustom.groupBy === 'month'
      ? 'month'
      : 'number';
  const rangeAttributes = revenueChartCustom.groupBy === 'year'
    ? `min="2000" max="${new Date().getFullYear()}" step="1"`
    : '';
  const labels = revenueChartCustom.groupBy === 'day'
    ? ['Từ ngày', 'Đến ngày']
    : revenueChartCustom.groupBy === 'month'
      ? ['Từ tháng', 'Đến tháng']
      : ['Từ năm', 'Đến năm'];

  return `
    <div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;width:100%;justify-content:flex-end;">
      <select class="input-control" style="width:132px;" onchange="changeRevenueCustomGroup(this.value)" aria-label="Nhóm doanh thu theo">
        <option value="day" ${revenueChartCustom.groupBy === 'day' ? 'selected' : ''}>Theo ngày</option>
        <option value="month" ${revenueChartCustom.groupBy === 'month' ? 'selected' : ''}>Theo tháng</option>
        <option value="year" ${revenueChartCustom.groupBy === 'year' ? 'selected' : ''}>Theo năm</option>
      </select>
      <label style="font-size:13px;color:var(--slate-600);">${labels[0]}</label>
      <input id="revenueRangeFrom" class="input-control" style="width:142px;" type="${inputType}" ${rangeAttributes} value="${esc(revenueChartCustom.from)}" onchange="updateRevenueCustomRange('from', this.value)">
      <label style="font-size:13px;color:var(--slate-600);">${labels[1]}</label>
      <input id="revenueRangeTo" class="input-control" style="width:142px;" type="${inputType}" ${rangeAttributes} value="${esc(revenueChartCustom.to)}" onchange="updateRevenueCustomRange('to', this.value)">
      <button class="secondary-btn" style="white-space:nowrap;" onclick="applyRevenueCustomRange()">Áp dụng</button>
    </div>`;
}

function revenueCustomApiRange() {
  const { groupBy, from, to } = revenueChartCustom;
  if (groupBy === 'month') {
    const [year, month] = to.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    return { from: `${from}-01`, to: `${to}-${String(lastDay).padStart(2, '0')}` };
  }

  if (groupBy === 'year') {
    return { from: `${from}-01-01`, to: `${to}-12-31` };
  }

  return { from, to };
}

function revenueChartRequestUrl() {
  const parameters = new URLSearchParams({ period: revenueChartPeriod });
  if (revenueChartPeriod === 'custom') {
    const range = revenueCustomApiRange();
    parameters.set('from', range.from);
    parameters.set('to', range.to);
    parameters.set('groupBy', revenueChartCustom.groupBy);
  }
  return `Dashboard/revenue-chart?${parameters.toString()}`;
}

function revenueChartTitle() {
  if (revenueChartPeriod === 'month') return 'Biểu đồ doanh thu 12 tháng trong năm';
  if (revenueChartPeriod !== 'custom') {
    return `Biểu đồ doanh thu ${revenueChartPeriod === 'day' ? 7 : 30} ngày gần nhất`;
  }

  const unit = revenueChartCustom.groupBy === 'day'
    ? 'ngày'
    : revenueChartCustom.groupBy === 'month'
      ? 'tháng'
      : 'năm';
  return `Biểu đồ doanh thu từ ${unit} ${revenueChartCustom.from} đến ${revenueChartCustom.to}`;
}

function revenueYAxisScale(values) {
  const highestValue = values.reduce((highest, value) => Math.max(highest, Number(value) || 0), 0);
  if (highestValue <= 0) return { max: 100000, stepSize: 10000 };

  const roughStep = highestValue / 12;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const normalized = roughStep / magnitude;
  const multiplier = [1, 1.25, 1.5, 2, 2.5, 5, 10].find(value => normalized <= value) || 10;
  const stepSize = multiplier * magnitude;

  return {
    max: Math.ceil(highestValue / stepSize) * stepSize,
    stepSize
  };
}

async function renderDashboard(refreshOnly = false) {
  if (!refreshOnly && revenueChart) {
    revenueChart.destroy();
    revenueChart = null;
  }
  if (!refreshOnly) app.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon-wrap rev">💰</div>
        <div class="stat-label">Tổng doanh thu</div>
        <div class="stat-value" id="kpiRevenue">...</div>
        <div class="stat-sub">Từ đơn hàng hoàn tất</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon-wrap ord">📦</div>
        <div class="stat-label">Tổng đơn hàng</div>
        <div class="stat-value" id="kpiOrders">...</div>
        <div class="stat-sub">Đơn hàng trong hệ thống</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon-wrap prd">🧸</div>
        <div class="stat-label">Sản phẩm đồ chơi</div>
        <div class="stat-value" id="kpiProducts">...</div>
        <div class="stat-sub">Mặt hàng đang quản lý</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon-wrap cst">👥</div>
        <div class="stat-label">Khách hàng</div>
        <div class="stat-value" id="kpiCustomers">...</div>
        <div class="stat-sub">Thành viên đăng ký</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:2fr 1fr;gap:24px;margin-bottom:28px;">
      <div class="panel" style="margin-bottom:0;">
        <div class="panel-header">
          <div class="panel-title-area">
            <h2 id="revenueChartTitle">Biểu đồ doanh thu 30 ngày gần nhất</h2>
            <p>Theo dõi doanh thu đơn hoàn tất, tự cập nhật mỗi 10 giây <span id="dashboardLastUpdated"></span></p>
          </div>
          <div style="display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:8px;flex:1;">
            <select id="revenueChartPeriod" class="input-control" style="width:196px;" onchange="changeRevenueChartPeriod(this.value)">
              <option value="day" ${revenueChartPeriod === 'day' ? 'selected' : ''}>7 ngày gần nhất</option>
              <option value="day30" ${revenueChartPeriod === 'day30' ? 'selected' : ''}>30 ngày gần nhất</option>
              <option value="month" ${revenueChartPeriod === 'month' ? 'selected' : ''}>12 tháng trong năm</option>
              <option value="custom" ${revenueChartPeriod === 'custom' ? 'selected' : ''}>Tùy chọn khoảng thời gian</option>
            </select>
            ${revenueCustomControlsHtml()}
          </div>
        </div>
        <div style="padding:24px;">
          <canvas id="revenueChartCanvas" height="150"></canvas>
        </div>
      </div>

      <div class="panel" style="margin-bottom:0;">
        <div class="panel-header">
          <div class="panel-title-area">
            <h2>Thao tác nhanh</h2>
            <p>Truy cập nhanh các nghiệp vụ</p>
          </div>
        </div>
        <div style="padding:20px;display:flex;flex-direction:column;gap:12px;">
          <button class="primary-btn" onclick="showForm('products')"><span>+</span> Thêm sản phẩm mới</button>
          <button class="success-btn" onclick="showForm('imports')"><span>📦</span> Tạo phiếu đặt hàng NCC</button>
          <button class="secondary-btn" onclick="location.hash='#orders'"><span>↗</span> Quản lý đơn hàng</button>
          <button class="secondary-btn" onclick="location.hash='#inventory'"><span>▤</span> Kiểm tra tồn kho</button>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header">
        <div class="panel-title-area">
          <h2>Đơn hàng gần đây</h2>
          <p>Danh sách các đơn hàng mới nhất cần xử lý</p>
        </div>
        <button class="secondary-btn" onclick="location.hash='#orders'">Xem tất cả đơn hàng →</button>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Mã đơn</th>
              <th>Khách hàng</th>
              <th>Ngày đặt</th>
              <th>Tổng tiền</th>
              <th>Trạng thái</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="dashOrdersBody">
            <tr><td colspan="6" style="text-align:center;padding:30px;">Đang tải dữ liệu...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  try {
    const [summary, orders, chartData] = await Promise.all([
      api('Dashboard/summary').catch(() => null),
      api('Order').catch(() => []),
      api(revenueChartRequestUrl()).catch(() => ({ labels: [], data: [] }))
    ]);

    if (currentView !== 'dashboard') return;

    if (summary) {
      document.getElementById('kpiRevenue').textContent = money(summary.totalRevenue);
      document.getElementById('kpiOrders').textContent = summary.totalOrders || 0;
      document.getElementById('kpiProducts').textContent = summary.totalProducts || 0;
      document.getElementById('kpiCustomers').textContent = summary.totalCustomers || 0;
    }

    const chartTitle = document.getElementById('revenueChartTitle');
    if (chartTitle) {
      chartTitle.textContent = revenueChartTitle();
    }

    // Render Chart
    const ctx = document.getElementById('revenueChartCanvas')?.getContext('2d');
    if (ctx) {
      if (revenueChart) revenueChart.destroy();
      const labels = chartData?.labels || [];
      const dataValues = chartData?.data || [];
      const yAxisScale = revenueYAxisScale(dataValues);
      revenueChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Doanh thu (VNĐ)',
            data: dataValues,
            backgroundColor: '#4f46e5',
            hoverBackgroundColor: '#3730a3',
            borderRadius: 7,
            borderSkipped: false,
            maxBarThickness: labels.length > 15 ? 22 : 46
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              beginAtZero: true,
              max: yAxisScale.max,
              ticks: {
                stepSize: yAxisScale.stepSize,
                maxTicksLimit: 13,
                autoSkip: false,
                callback: v => Number(v).toLocaleString('vi-VN') + ' đ'
              },
              grid: { color: '#f1f5f9' }
            },
            x: {
              grid: { display: false },
              ticks: { autoSkip: true, maxTicksLimit: labels.length > 15 ? 10 : 12 }
            }
          }
        }
      });
    }

    // Render recent orders
    const dashBody = document.getElementById('dashOrdersBody');
    if (dashBody) {
      const recent = (orders || []).slice(0, 5);
      if (recent.length === 0) {
        dashBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--slate-400)">Chưa có đơn hàng nào.</td></tr>`;
      } else {
        dashBody.innerHTML = recent.map(o => `
          <tr>
            <td><strong>#${esc(o.orderCode || o.orderId)}</strong></td>
            <td>${esc(o.customerName || o.shipping?.receiverName || 'Khách vãng lai')}</td>
            <td>${fmtDate(o.orderDate || o.createdAt)}</td>
            <td><strong style="color:var(--primary);">${money(o.finalAmount || o.totalAmount)}</strong></td>
            <td>${pill(ORDER_STATUS_LABELS[o.status] || 'Đang xử lý', o.status === 4 ? 'success' : (o.status === 5 ? 'danger' : 'warning'))}</td>
            <td style="text-align:right;">
              <button class="icon-action-btn view" title="Xem chi tiết" onclick="showOrderDetail(${o.orderId})">👁</button>
            </td>
          </tr>
        `).join('');
      }
    }
    const stamp = document.getElementById('dashboardLastUpdated');
    if (stamp) stamp.textContent = `· Cập nhật lúc ${new Date().toLocaleTimeString('vi-VN')}`;
    startDashboardRealtime();
  } catch (err) {
    console.error(err);
  }
}

function stopDashboardRealtime() {
  if (dashboardRefreshTimer) {
    clearInterval(dashboardRefreshTimer);
    dashboardRefreshTimer = null;
  }
}

function startDashboardRealtime() {
  if (dashboardRefreshTimer) return;
  dashboardRefreshTimer = setInterval(() => {
    if (currentView === 'dashboard' && document.visibilityState === 'visible') {
      renderDashboard(true);
    }
  }, 10000);
}

window.changeRevenueChartPeriod = function(period) {
  revenueChartPeriod = ['day', 'day30', 'month', 'custom'].includes(period) ? period : 'day30';
  renderDashboard();
};

window.changeRevenueCustomGroup = function(groupBy) {
  setRevenueCustomDefaults(['day', 'month', 'year'].includes(groupBy) ? groupBy : 'day');
  renderDashboard();
};

window.updateRevenueCustomRange = function(bound, value) {
  if (bound === 'from' || bound === 'to') revenueChartCustom[bound] = value;
};

window.applyRevenueCustomRange = function() {
  const { groupBy, from, to } = revenueChartCustom;
  if (!from || !to) {
    toast('Vui lòng chọn đầy đủ khoảng thời gian.', 'error');
    return;
  }
  if (from > to) {
    toast('Mốc kết thúc phải lớn hơn hoặc bằng mốc bắt đầu.', 'error');
    return;
  }

  if (groupBy === 'day') {
    const totalDays = (new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86400000;
    if (totalDays > 366) {
      toast('Khoảng theo ngày tối đa 366 ngày. Hãy chọn mốc theo tháng hoặc năm.', 'error');
      return;
    }
  }
  if (groupBy === 'month') {
    const [fromYear, fromMonth] = from.split('-').map(Number);
    const [toYear, toMonth] = to.split('-').map(Number);
    if ((toYear - fromYear) * 12 + toMonth - fromMonth > 119) {
      toast('Khoảng theo tháng tối đa 10 năm. Hãy chọn mốc theo năm.', 'error');
      return;
    }
  }
  if (groupBy === 'year' && Number(to) - Number(from) > 30) {
    toast('Khoảng theo năm tối đa 31 năm.', 'error');
    return;
  }

  renderDashboard();
};

// ── 1B. LIQUIDATION MANAGEMENT ──────────────────────────────
const LIQUIDATION_STALE_DAYS = 90;

function dayAge(dateValue) {
  const value = new Date(dateValue);
  if (Number.isNaN(value.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - value.getTime()) / 86400000));
}

function dateInputValue(dateValue) {
  const date = new Date(dateValue);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

async function renderLiquidation() {
  app.innerHTML = `<div class="panel"><div style="padding:42px;text-align:center;color:var(--slate-500);">Đang phân tích hàng cần thanh lý...</div></div>`;

  try {
    const [products, inventories, promotions] = await Promise.all([
      api('Product'),
      api('Inventory'),
      api('Promotion').catch(() => [])
    ]);
    if (currentView !== 'liquidation') return;

    const now = new Date();
    const promotedVariantIds = new Set((promotions || [])
      .filter(promotion => Number(promotion.status) === 1
        && new Date(promotion.startDate) <= now
        && new Date(promotion.endDate) >= now)
      .flatMap(promotion => (promotion.promotionProducts || [])
        .map(item => String(item.variantId))));

    const candidates = (inventories || []).map(inventory => {
      const product = (products || []).find(item => productVariantsOf(item)
        .some(variant => Number(variant.variantId || variant.id) === Number(inventory.variantId)));
      const variant = product ? productVariantsOf(product)
        .find(item => Number(item.variantId || item.id) === Number(inventory.variantId)) : null;
      if (!product || !variant) return null;

      const availableQuantity = Math.max(0, Number(inventory.availableQuantity ??
        (Number(inventory.quantity || 0) - Number(inventory.reservedQuantity || 0))));
      const stockAge = dayAge(inventory.updatedAt);
      const isLiquidationStatus = Number(product.status) === 2;
      const isLongStock = stockAge >= LIQUIDATION_STALE_DAYS;
      if (availableQuantity <= 0 || (!isLiquidationStatus && !isLongStock)) return null;

      return {
        productId: product.productId,
        variantId: Number(variant.variantId || variant.id),
        productName: product.name,
        sku: variant.sku || inventory.sku || '—',
        availableQuantity,
        stockAge,
        lastMovementAt: inventory.updatedAt,
        price: Number(variant.price || 0),
        isLiquidationStatus,
        isLongStock,
        activeDeal: promotedVariantIds.has(String(variant.variantId || variant.id)),
        suggestedDiscount: isLiquidationStatus || stockAge >= 180 ? 40 : 25
      };
    }).filter(Boolean).sort((left, right) =>
      Number(right.isLiquidationStatus) - Number(left.isLiquidationStatus)
      || right.stockAge - left.stockAge);

    cache.liquidation = candidates;
    const totalUnits = candidates.reduce((sum, item) => sum + item.availableQuantity, 0);
    const totalValue = candidates.reduce((sum, item) => sum + item.availableQuantity * item.price, 0);

    app.innerHTML = `
      <div class="stats-grid" style="margin-bottom:24px;">
        <div class="stat-card"><div class="stat-icon-wrap prd">♻</div><div class="stat-label">Mặt hàng cần thanh lý</div><div class="stat-value">${candidates.length}</div><div class="stat-sub">Ngừng nhập mới hoặc tồn kho từ ${LIQUIDATION_STALE_DAYS} ngày</div></div>
        <div class="stat-card"><div class="stat-icon-wrap ord">📦</div><div class="stat-label">Số lượng cần xử lý</div><div class="stat-value">${totalUnits.toLocaleString('vi-VN')}</div><div class="stat-sub">Sản phẩm còn có thể bán</div></div>
        <div class="stat-card"><div class="stat-icon-wrap rev">💰</div><div class="stat-label">Giá trị theo giá bán</div><div class="stat-value" style="font-size:20px;">${money(totalValue)}</div><div class="stat-sub">Trước khi áp dụng ưu đãi thanh lý</div></div>
      </div>
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title-area">
            <h2>Đề xuất thanh lý hàng</h2>
            <p>Hệ thống gợi ý từ hàng ngừng nhập mới hoặc không có biến động kho trong ít nhất ${LIQUIDATION_STALE_DAYS} ngày.</p>
          </div>
          <button class="secondary-btn" onclick="location.hash='#promotions'">Quản lý tất cả khuyến mãi →</button>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Sản phẩm / SKU</th><th>Lý do</th><th>Tồn có thể bán</th><th>Lần biến động gần nhất</th><th>Giá bán</th><th>Đề xuất</th><th></th></tr></thead>
            <tbody>
              ${candidates.length ? candidates.map(item => `
                <tr>
                  <td><strong>${esc(item.productName)}</strong><br><small style="color:var(--slate-500);">SKU: ${esc(item.sku)}</small></td>
                  <td>${item.isLiquidationStatus ? pill('Ngừng nhập mới', 'danger') : pill(`Tồn kho lâu ${item.stockAge} ngày`, 'warning')}</td>
                  <td><strong style="color:var(--danger);">${item.availableQuantity}</strong></td>
                  <td>${fmtDate(item.lastMovementAt)}<br><small style="color:var(--slate-500);">${item.stockAge} ngày trước</small></td>
                  <td>${item.price > 0 ? money(item.price) : '<span style="color:var(--danger);">Chưa có giá bán</span>'}</td>
                  <td>Giảm ${item.suggestedDiscount}%</td>
                  <td style="text-align:right;">${item.activeDeal
                    ? '<button class="secondary-btn" style="padding:8px 11px;" onclick="location.hash=\'#promotions\'">Ưu đãi đang chạy</button>'
                    : `<button class="primary-btn" style="padding:8px 11px;" onclick="showLiquidationCampaign(${item.variantId})">Tạo ưu đãi</button>`}</td>
                </tr>`).join('') : `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--slate-500);">Chưa có hàng cần thanh lý. Sản phẩm được gợi ý khi ở trạng thái “Thanh lý / ngừng nhập mới” hoặc tồn kho không biến động từ ${LIQUIDATION_STALE_DAYS} ngày.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>`;
  } catch (err) {
    app.innerHTML = `<div class="panel"><div style="padding:42px;text-align:center;color:var(--danger);">Không thể tải danh sách thanh lý: ${esc(err.message)}</div></div>`;
  }
}

window.showLiquidationCampaign = function(variantId) {
  const item = (cache.liquidation || []).find(candidate => candidate.variantId === Number(variantId));
  if (!item) return;
  if (item.price <= 0) {
    toast('Vui lòng cập nhật giá bán cho biến thể trước khi tạo ưu đãi thanh lý.', 'error');
    return;
  }
  const suggestedEndDate = dateInputValue(Date.now() + 30 * 86400000);
  app.innerHTML = `
    <div class="form-view-panel">
      <div class="form-view-header"><div class="form-header-title"><button class="back-link-btn" onclick="renderLiquidation()">← Quay lại danh sách thanh lý</button><div><h2>Tạo ưu đãi thanh lý</h2><p>${esc(item.productName)} · SKU ${esc(item.sku)} · Còn ${item.availableQuantity} sản phẩm</p></div></div></div>
      <form id="liquidationCampaignForm" autocomplete="off" onsubmit="submitLiquidationCampaign(event, ${item.variantId})">
        <div class="form-body"><div class="form-grid-2">
          <div class="form-group full"><label>Tên ưu đãi</label><input id="liquidationCampaignName" class="input-control" required value="Thanh lý ${esc(item.productName)} - ${esc(item.sku)}"></div>
          <div class="form-group"><label>Mức giảm (%) *</label><input id="liquidationDiscount" type="number" class="input-control" required min="1" max="90" value="${item.suggestedDiscount}"></div>
          <div class="form-group"><label>Kết thúc vào *</label><input id="liquidationEndDate" type="date" class="input-control" required min="${dateInputValue(Date.now() + 86400000)}" value="${suggestedEndDate}"></div>
          <div class="form-group full"><label>Ghi chú</label><textarea id="liquidationNote" class="input-control" rows="3">Ưu đãi thanh lý cho hàng ${item.isLiquidationStatus ? 'ngừng nhập mới' : `tồn kho lâu ${item.stockAge} ngày`}.</textarea></div>
        </div></div>
        <div class="form-footer-actions"><button type="button" class="ghost-btn" onclick="renderLiquidation()">Hủy bỏ</button><button type="submit" class="primary-btn">Tạo ưu đãi thanh lý</button></div>
      </form>
    </div>`;
};

window.submitLiquidationCampaign = async function(event, variantId) {
  event.preventDefault();
  const item = (cache.liquidation || []).find(candidate => candidate.variantId === Number(variantId));
  const name = document.getElementById('liquidationCampaignName')?.value.trim();
  const discountValue = Number(document.getElementById('liquidationDiscount')?.value);
  const endDateValue = document.getElementById('liquidationEndDate')?.value;
  const description = document.getElementById('liquidationNote')?.value.trim() || '';
  if (!item || !name || discountValue <= 0 || discountValue > 90 || !endDateValue) {
    toast('Vui lòng nhập đầy đủ thông tin ưu đãi hợp lệ.', 'error');
    return;
  }

  try {
    const promotion = await api('Promotion', {
      method: 'POST',
      body: JSON.stringify({
        name,
        description,
        promotionType: 0,
        discountValue,
        maximumDiscount: null,
        startDate: new Date().toISOString(),
        endDate: new Date(`${endDateValue}T23:59:59`).toISOString(),
        priority: 100,
        canCombine: false,
        status: 1
      })
    });
    await api(`Promotion/${promotion.promotionId}/products`, {
      method: 'POST',
      body: JSON.stringify({ promotionId: promotion.promotionId, variantId: item.variantId })
    });
    toast('Đã tạo ưu đãi thanh lý và gắn đúng biến thể sản phẩm.', 'success');
    renderLiquidation();
  } catch (err) {
    toast(`Không thể tạo ưu đãi thanh lý: ${err.message}`, 'error');
  }
};

// ── 1C. CUSTOMER CARE ──────────────────────────────────────
const CUSTOMER_CARE_STATUSES = {
  0: { label: 'Mới tiếp nhận', pill: 'warning' },
  1: { label: 'Đang xử lý', pill: 'info' },
  2: { label: 'Đã phản hồi', pill: 'success' },
  3: { label: 'Đã đóng', pill: 'neutral' }
};
const CUSTOMER_CARE_TYPES = ['Tư vấn chung', 'Khiếu nại', 'Đổi trả / bảo hành', 'Khác'];

function customerCareStatus(status) {
  return CUSTOMER_CARE_STATUSES[Number(status)] || { label: 'Chưa xác định', pill: 'neutral' };
}

async function renderCustomerCare() {
  app.innerHTML = `<div class="panel"><div style="padding:42px;text-align:center;color:var(--slate-500);">Đang tải yêu cầu chăm sóc khách hàng...</div></div>`;
  try {
    const feedbacks = await api('CustomerFeedback');
    if (currentView !== 'customer-care') return;
    const list = (feedbacks || []).sort((left, right) =>
      Number(left.status >= 2) - Number(right.status >= 2)
      || new Date(right.createdAt) - new Date(left.createdAt));
    cache.customerCare = list;
    const newCount = list.filter(item => Number(item.status) === 0).length;
    const processingCount = list.filter(item => Number(item.status) === 1).length;
    const resolvedCount = list.filter(item => Number(item.status) >= 2).length;

    app.innerHTML = `
      <div class="stats-grid" style="margin-bottom:24px;">
        <div class="stat-card"><div class="stat-icon-wrap cst">💬</div><div class="stat-label">Yêu cầu mới</div><div class="stat-value">${newCount}</div><div class="stat-sub">Cần tiếp nhận phản hồi</div></div>
        <div class="stat-card"><div class="stat-icon-wrap ord">⌛</div><div class="stat-label">Đang xử lý</div><div class="stat-value">${processingCount}</div><div class="stat-sub">Yêu cầu chưa hoàn tất</div></div>
        <div class="stat-card"><div class="stat-icon-wrap rev">✓</div><div class="stat-label">Đã hoàn tất</div><div class="stat-value">${resolvedCount}</div><div class="stat-sub">Đã phản hồi hoặc đóng yêu cầu</div></div>
      </div>
      <div class="panel">
        <div class="panel-header"><div class="panel-title-area"><h2>Hộp thư chăm sóc khách hàng</h2><p>Tiếp nhận, trả lời và theo dõi yêu cầu của khách hàng.</p></div></div>
        <div class="table-wrap"><table class="data-table"><thead><tr><th>Khách hàng</th><th>Nội dung yêu cầu</th><th>Loại</th><th>Đơn liên quan</th><th>Gửi lúc</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>${list.length ? list.map(item => {
            const state = customerCareStatus(item.status);
            return `<tr><td><strong>${esc(item.customerName || 'Khách hàng')}</strong></td><td><strong>${esc(item.subject)}</strong><br><small style="color:var(--slate-500);">${esc(item.content)}</small></td><td>${esc(CUSTOMER_CARE_TYPES[Number(item.feedbackType)] || CUSTOMER_CARE_TYPES[3])}</td><td>${item.orderCode ? `<strong>#${esc(item.orderCode)}</strong>` : '—'}</td><td>${fmtDateTime(item.createdAt)}</td><td>${pill(state.label, state.pill)}</td><td style="text-align:right;"><button class="icon-action-btn view" title="Xử lý yêu cầu" onclick="showCustomerCareReply(${item.customerFeedbackId})">💬</button></td></tr>`;
          }).join('') : '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--slate-500);">Chưa có yêu cầu chăm sóc khách hàng.</td></tr>'}</tbody>
        </table></div>
      </div>`;
  } catch (err) {
    app.innerHTML = `<div class="panel"><div style="padding:42px;text-align:center;color:var(--danger);">Không thể tải yêu cầu chăm sóc khách hàng: ${esc(err.message)}</div></div>`;
  }
}

window.showCustomerCareReply = function(feedbackId) {
  const item = (cache.customerCare || []).find(feedback => Number(feedback.customerFeedbackId) === Number(feedbackId));
  if (!item) return;
  app.innerHTML = `
    <div class="form-view-panel">
      <div class="form-view-header"><div class="form-header-title"><button class="back-link-btn" onclick="renderCustomerCare()">← Quay lại chăm sóc khách hàng</button><div><h2>${esc(item.subject)}</h2><p>${esc(item.customerName || 'Khách hàng')} · ${item.orderCode ? `Đơn #${esc(item.orderCode)}` : 'Không gắn đơn hàng'}</p></div></div></div>
      <form id="customerCareReplyForm" onsubmit="submitCustomerCareReply(event, ${item.customerFeedbackId})">
        <div class="form-body"><div class="form-section-card"><h3>Nội dung khách gửi</h3><p style="white-space:pre-wrap;line-height:1.65;">${esc(item.content)}</p></div><div class="form-grid-2" style="margin-top:20px;"><div class="form-group"><label>Trạng thái</label><select id="customerCareStatus" class="input-control">${Object.entries(CUSTOMER_CARE_STATUSES).map(([value, state]) => `<option value="${value}" ${Number(item.status) === Number(value) ? 'selected' : ''}>${state.label}</option>`).join('')}</select></div><div class="form-group full"><label>Phản hồi đến khách hàng</label><textarea id="customerCareResponse" class="input-control" rows="6" placeholder="Nhập nội dung phản hồi...">${esc(item.response)}</textarea><small style="color:var(--slate-500);">Cần nhập phản hồi khi chuyển sang “Đã phản hồi” hoặc “Đã đóng”.</small></div></div></div>
        <div class="form-footer-actions"><button type="button" class="ghost-btn" onclick="renderCustomerCare()">Quay lại</button><button type="submit" class="primary-btn">Lưu xử lý</button></div>
      </form>
    </div>`;
};

window.submitCustomerCareReply = async function(event, feedbackId) {
  event.preventDefault();
  const status = Number(document.getElementById('customerCareStatus')?.value);
  const response = document.getElementById('customerCareResponse')?.value.trim() || '';
  if (status >= 2 && !response) {
    toast('Vui lòng nhập phản hồi trước khi hoàn tất yêu cầu.', 'error');
    return;
  }
  try {
    await api(`CustomerFeedback/${feedbackId}`, { method: 'PUT', body: JSON.stringify({ status, response }) });
    toast('Đã cập nhật yêu cầu chăm sóc khách hàng.', 'success');
    renderCustomerCare();
  } catch (err) {
    toast(`Không thể cập nhật yêu cầu: ${err.message}`, 'error');
  }
};

// ── 2. GENERIC LIST VIEW ────────────────────────────────────
async function renderList(key) {
  const m = MODULES[key];
  if (!m) return;

  app.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <div class="panel-title-area">
          <h2>Danh sách ${m.title}</h2>
          <p>Quản lý dữ liệu và thông tin ${m.title.toLowerCase()}</p>
        </div>
        <div class="panel-actions">
          <input type="text" id="tableSearchInput" placeholder="Tìm kiếm ${m.title.toLowerCase()}..." class="input-control" style="width:240px;padding:8px 14px;" onkeyup="filterTableData('${key}')">
          ${m.canAdd ? `
            <button class="primary-btn" onclick="showForm('${key}')">
              <span>+</span> Thêm ${key === 'imports' ? 'phiếu đặt hàng' : m.title.toLowerCase()} mới
            </button>
          ` : ''}
        </div>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              ${m.columns.map(c => `<th>${c}</th>`).join('')}
              <th style="text-align:right;min-width:110px;">Thao tác</th>
            </tr>
          </thead>
          <tbody id="listTableBody">
            <tr><td colspan="${m.columns.length + 1}" style="text-align:center;padding:40px;color:var(--slate-400)">Đang tải dữ liệu từ máy chủ...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  try {
    const data = await api(m.endpoint);
    cache[key] = Array.isArray(data) ? data : (data?.items || []);
    renderTableRows(key, cache[key]);
  } catch (err) {
    toast(`Không thể tải dữ liệu: ${err.message}`, 'error');
    document.getElementById('listTableBody').innerHTML = `
      <tr><td colspan="${m.columns.length + 1}" style="text-align:center;padding:40px;color:var(--danger)">Lỗi: ${esc(err.message)}</td></tr>
    `;
  }
}

function renderTableRows(key, list) {
  const m = MODULES[key];
  const tbody = document.getElementById('listTableBody');
  if (!tbody) return;

  if (!list || list.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="${m.columns.length + 1}" style="text-align:center;padding:40px;color:var(--slate-400)">Chưa có dữ liệu nào trong danh mục này.</td></tr>
    `;
    return;
  }

  tbody.innerHTML = list.map((record, index) => `
    <tr>
      ${getRowCells(key, record).map(cell => `<td>${cell}</td>`).join('')}
      <td style="text-align:right;white-space:nowrap;">
        ${getRowActions(key, record, index)}
      </td>
    </tr>
  `).join('');
}

function filterTableData(key) {
  const term = (document.getElementById('tableSearchInput')?.value || '').toLowerCase().trim();
  const rawList = cache[key] || [];
  if (!term) {
    renderTableRows(key, rawList);
    return;
  }
  const filtered = rawList.filter(r => JSON.stringify(r).toLowerCase().includes(term));
  renderTableRows(key, filtered);
}

function getRowCells(key, r) {
  switch (key) {
    case 'products':
      const img = r.imageUrl || r.thumbnailUrl || productVariantsOf(r)[0]?.imageUrl || 'https://placehold.co/80x80/e2e8f0/475569?text=Toy';
      return [
        `<img src="${esc(img)}" style="width:42px;height:42px;object-fit:cover;border-radius:8px;border:1px solid var(--slate-200);">`,
        `<strong>${esc(r.name)}</strong><br><small style="color:var(--slate-400);">Mã: ${esc(r.productId)}</small>`,
        esc(r.categoryName || '—'),
        esc(r.brandName || '—'),
        `<strong style="color:var(--primary);">${money(r.basePrice ?? productVariantsOf(r)[0]?.price)}</strong>`,
        pill(
          r.status === 2 ? 'Thanh lý' : (r.status === 1 ? 'Đang kinh doanh' : 'Tạm ngưng'),
          r.status === 2 ? 'danger' : (r.status === 1 ? 'success' : 'warning')
        )
      ];

    case 'categories':
    case 'brands':
      return [
        `<strong>${esc(r.name)}</strong>`,
        esc(r.description || '—'),
        pill(r.isActive !== false ? 'Hoạt động' : 'Tạm khóa', r.isActive !== false ? 'success' : 'danger')
      ];

    case 'inventory':
      const available = (r.quantity || 0) - (r.reservedQuantity || 0);
      return [
        `<code style="background:var(--slate-100);padding:3px 6px;border-radius:4px;font-weight:700;">${esc(r.sku || r.productVariant?.sku || 'SKU')}</code>`,
        `<strong>${esc(r.productName || r.productVariant?.product?.name || 'Sản phẩm')}</strong>`,
        `<strong>${r.quantity || 0}</strong>`,
        `<span style="color:var(--slate-500);">${r.reservedQuantity || 0}</span>`,
        `<strong style="color:${available > 0 ? 'var(--success)' : 'var(--danger)'};">${available}</strong>`,
        fmtDateTime(r.updatedAt || r.createdAt)
      ];

    case 'orders':
      return [
        `<strong>#${esc(r.orderCode || r.orderId)}</strong>`,
        esc(r.customerName || r.shipping?.receiverName || 'Khách vãng lai'),
        esc(r.phoneNumber || r.shipping?.receiverPhone || '—'),
        fmtDate(r.orderDate || r.createdAt),
        `<strong style="color:var(--primary);">${money(r.finalAmount || r.totalAmount)}</strong>`,
        pill(r.paymentStatus === 1 ? 'Đã thanh toán' : 'Chưa thanh toán', r.paymentStatus === 1 ? 'success' : 'neutral'),
        pill(ORDER_STATUS_LABELS[r.status] || 'Đang xử lý', r.status === 4 ? 'success' : (r.status === 5 ? 'danger' : 'warning'))
      ];

    case 'suppliers':
      return [
        `<strong>${esc(r.name)}</strong><br><small style="color:var(--slate-400);">${esc(r.address || '')}</small>`,
        esc(r.phone || '—'),
        esc(r.email || '—'),
        esc(r.taxCode || '—'),
        pill(r.isActive !== false ? 'Hoạt động' : 'Tạm dừng', r.isActive !== false ? 'success' : 'danger')
      ];

    case 'imports':
      const st = IMPORT_STATUS_MAP[r.status] || { label: `Trạng thái ${r.status}`, pill: 'neutral' };
      return [
        `<strong>${esc(r.receiptCode || `PO-#${r.importReceiptId}`)}</strong>`,
        `<strong>${esc(r.supplierName || 'Nhà cung cấp')}</strong>`,
        esc(r.orderedByName || 'Chưa xác định'),
        fmtDate(r.importDate || r.createdAt),
        `<strong style="color:var(--primary);">${money(r.totalAmount)}</strong>`,
        pill(st.label, st.pill)
      ];

    case 'promotions':
      const promotionActive = r.status === undefined ? r.isActive === true : r.status === 1;
      return [
        `<strong>${esc(r.name)}</strong><br><small style="color:var(--slate-400);">${esc(r.description || '')}</small>`,
        r.promotionType === 0 ? 'Phần trăm (%)' : 'Số tiền cố định (đ)',
        `<strong>${r.promotionType === 0 ? `${r.discountValue}%` : money(r.discountValue)}</strong>`,
        `${fmtDate(r.startDate)} - ${fmtDate(r.endDate)}`,
        pill(promotionActive ? 'Đang chạy' : 'Tạm ngưng', promotionActive ? 'success' : 'neutral')
      ];

    case 'vouchers':
      const voucherActive = r.status === undefined ? r.isActive === true : r.status === 1;
      return [
        `<code style="background:var(--primary-light);color:var(--primary);padding:4px 8px;border-radius:6px;font-weight:700;">${esc(r.code)}</code>`,
        `<strong>${esc(r.name || r.code)}</strong>`,
        `<strong>${r.discountType === 0 ? `${r.discountValue}%` : money(r.discountValue)}</strong>`,
        r.requiredPoints > 0 ? `<strong style="color:var(--secondary);">${Number(r.requiredPoints).toLocaleString('vi-VN')} điểm</strong>` : 'Voucher thường',
        money(r.minimumOrderValue ?? r.minOrderAmount ?? 0),
        fmtDate(r.endDate || r.expiryDate),
        pill(voucherActive ? 'Khả dụng' : 'Khóa', voucherActive ? 'success' : 'danger')
      ];

    case 'customers':
      return [
        `<strong>${esc(r.fullName || r.name)}</strong>`,
        esc(r.email || '—'),
        esc(r.phoneNumber || r.phone || '—'),
        pill(r.tier || 'Thành viên', 'info'),
        `<strong style="color:var(--primary);">${money(r.totalSpent || 0)}</strong>`,
        `<span>${r.totalOrders || 0} đơn</span>`
      ];

    case 'users':
      return [
        `<strong>${esc(r.fullName || r.userName || 'Người dùng')}</strong>`,
        esc(r.email),
        esc(r.phoneNumber || '—'),
        pill(r.role || 'Staff', r.role === 'Admin' ? 'danger' : (r.role === 'Manager' ? 'warning' : 'info')),
        pill(r.isActive !== false ? 'Kích hoạt' : 'Bị khóa', r.isActive !== false ? 'success' : 'danger')
      ];

    default:
      return [JSON.stringify(r).slice(0, 50)];
  }
}

function getRowActions(key, r, index) {
  const m = MODULES[key];
  let btns = '';

  if (key === 'imports') {
    btns += `<button class="icon-action-btn view" title="Xem chi tiết & Duyệt nhập kho" onclick="showImportDetail(${r.importReceiptId})">👁</button> `;
    if (r.status === 1) {
      btns += `<button class="icon-action-btn" title="Chỉnh sửa phiếu" onclick="showForm('imports', ${index})">✎</button> `;
      btns += `<button class="icon-action-btn del" title="Hủy / Xóa phiếu" onclick="confirmDelete('${key}', ${index})">🗑</button>`;
    }
    return btns;
  }

  if (key === 'orders') {
    return `<button class="icon-action-btn view" title="Xem chi tiết đơn hàng" onclick="showOrderDetail(${r.orderId})">👁</button>`;
  }

  if (key === 'users') {
    return `
      <button class="icon-action-btn" title="Phân quyền vai trò" onclick="showUserRoleForm(${index})">👥</button>
      <button class="icon-action-btn ${r.isActive !== false ? 'del' : ''}" title="${r.isActive !== false ? 'Khóa tài khoản' : 'Mở khóa'}" onclick="toggleUserStatus('${r.userId || r.id}')">${r.isActive !== false ? '🔒' : '🔓'}</button>
    `;
  }

  if (m.canEdit) {
    btns += `<button class="icon-action-btn" title="Chỉnh sửa" onclick="showForm('${key}', ${index})">✎</button> `;
  }
  if (m.canDelete) {
    btns += `<button class="icon-action-btn del" title="Xóa" onclick="confirmDelete('${key}', ${index})">🗑</button>`;
  }
  return btns;
}

// ── 3. IN-PAGE FORM VIEWS (NO DIALOGS) ───────────────────────
function showForm(key, index = null) {
  const m = MODULES[key];
  const isEdit = index !== null;
  const record = isEdit ? cache[key][index] : null;
  if (key === 'products') productVariantRowIndex = 0;

  app.innerHTML = `
    <div class="form-view-panel">
      <div class="form-view-header">
        <div class="form-header-title">
          <button class="back-link-btn" onclick="renderList('${key}')">← Quay lại danh sách</button>
          <div>
            <h2>${isEdit ? 'Chỉnh sửa' : 'Thêm mới'} ${m.title}</h2>
            <p>Vui lòng kiểm tra và nhập đầy đủ các trường thông tin bắt buộc (*).</p>
          </div>
        </div>
      </div>

      <form id="activeInPageForm" autocomplete="off" onsubmit="handleFormSubmit(event, '${key}', ${index})">
        <div class="form-body">
          ${renderFormFields(key, record)}
        </div>
        <div class="form-footer-actions">
          <button type="button" class="ghost-btn" onclick="renderList('${key}')">Hủy bỏ</button>
          <button type="submit" class="primary-btn">Lưu ${m.title}</button>
        </div>
      </form>
    </div>
  `;
}

function renderVariantAttributeRow(attribute = {}) {
  return `
    <div class="variant-attribute-row" style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;margin-top:8px;">
      <input type="text" class="input-control variant-attribute-name" value="${esc(attribute.attributeName)}" placeholder="Tên thuộc tính, ví dụ: Màu sắc">
      <input type="text" class="input-control variant-attribute-value" value="${esc(attribute.attributeValue)}" placeholder="Giá trị, ví dụ: Đỏ">
      <button type="button" class="icon-action-btn del" title="Bỏ thuộc tính" onclick="removeVariantAttributeRow(this)">✕</button>
    </div>`;
}

function renderProductVariantEditor(variant = {}) {
  const rowKey = `variant_${productVariantRowIndex++}`;
  const variantId = variant.variantId || variant.id || '';
  const isExisting = Boolean(variantId);
  const canSetPrice = isExisting && Number(variant.availableQuantity || 0) > 0;
  const attributes = Array.isArray(variant.attributes) && variant.attributes.length > 0
    ? variant.attributes
    : [{}];
  const priceHint = canSetPrice
    ? `Tồn kho có thể bán: ${variant.availableQuantity}`
    : 'Chưa có tồn kho. Duyệt phiếu nhập NCC cho biến thể này để nhập giá bán.';

  return `
    <section class="product-variant-editor" data-variant-id="${esc(variantId)}" style="border:1px solid var(--slate-200);border-radius:12px;padding:16px;margin-top:14px;background:var(--slate-50);">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px;">
        <div>
          <strong>${isExisting ? `Biến thể SKU: ${esc(variant.sku)}` : 'Biến thể mới'}</strong>
          <div style="font-size:12px;color:var(--slate-500);margin-top:3px;">${isExisting ? 'Cập nhật thông tin biến thể hiện có.' : 'Biến thể mới sẽ nhận giá bán sau khi đã nhập kho.'}</div>
        </div>
        ${isExisting ? '' : `<button type="button" class="ghost-btn" style="padding:7px 10px;color:var(--danger);" onclick="removeProductVariantRow(this)">Bỏ biến thể</button>`}
      </div>
      <div class="form-grid-2">
        <div class="form-group">
          <label>SKU *</label>
          <input type="text" class="input-control variant-sku" value="${esc(variant.sku)}" required placeholder="Ví dụ: LEGO-CITY-RED">
        </div>
        <div class="form-group">
          <label>Trạng thái biến thể</label>
          <select class="input-control variant-status">
            <option value="1" ${(variant.status ?? 1) === 1 ? 'selected' : ''}>Đang kinh doanh</option>
            <option value="0" ${variant.status === 0 ? 'selected' : ''}>Tạm ngưng</option>
          </select>
        </div>
        <div class="form-group">
          <label>Giá bán biến thể (VNĐ)</label>
          <input type="number" min="0" step="1000" class="input-control variant-price" value="${variant.price ?? ''}" ${canSetPrice ? '' : 'disabled'} title="${esc(priceHint)}" placeholder="Nhập sau khi có tồn kho">
          <small style="display:block;margin-top:5px;color:${canSetPrice ? 'var(--success)' : 'var(--slate-500)'};">${esc(priceHint)}</small>
        </div>
        <div class="form-group">
          <label>Giá vốn tham khảo (VNĐ)</label>
          <input type="number" min="0" step="1000" class="input-control variant-cost-price" value="${variant.costPrice ?? ''}" placeholder="Có thể cập nhật khi lập phiếu nhập">
        </div>
        <div class="form-group">
          <label>Khối lượng (gram)</label>
          <input type="number" min="0" step="1" class="input-control variant-weight" value="${variant.weight ?? ''}" placeholder="Không bắt buộc">
        </div>
        <div class="form-group">
          <label>URL hình ảnh riêng của biến thể</label>
          <input type="url" class="input-control variant-image-url" value="${esc(variant.imageUrl)}" placeholder="https://example.com/bien-the.jpg">
        </div>
      </div>
      <div style="margin-top:12px;">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;">
          <label style="font-weight:700;">Thuộc tính biến thể</label>
          <button type="button" class="secondary-btn" style="padding:7px 10px;" onclick="addVariantAttributeRow('${rowKey}')">+ Thêm thuộc tính</button>
        </div>
        <div id="variantAttributes_${rowKey}" class="variant-attributes">
          ${attributes.map(renderVariantAttributeRow).join('')}
        </div>
      </div>
    </section>`;
}

function renderProductVariantsSection(product) {
  const variants = productVariantsOf(product);
  const initialVariants = variants.length > 0 ? variants : [{}];
  return `
    <div class="form-section-card" style="margin-top:20px;">
      <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;">
        <div>
          <h3 style="margin:0;">Biến thể sản phẩm *</h3>
          <p style="margin:5px 0 0;color:var(--slate-500);font-size:13px;">Thêm SKU và các thuộc tính tự do cho từng phiên bản. Giá bán chỉ mở khi biến thể đã có tồn kho.</p>
        </div>
        <button type="button" class="secondary-btn" onclick="addProductVariantRow()">+ Thêm biến thể</button>
      </div>
      <div id="productVariantsEditor">
        ${initialVariants.map(renderProductVariantEditor).join('')}
      </div>
    </div>`;
}

window.addProductVariantRow = function() {
  const editor = document.getElementById('productVariantsEditor');
  if (!editor) return;
  const temp = document.createElement('div');
  temp.innerHTML = renderProductVariantEditor({});
  editor.appendChild(temp.firstElementChild);
};

window.removeProductVariantRow = function(button) {
  const row = button.closest('.product-variant-editor');
  if (row) row.remove();
};

window.addVariantAttributeRow = function(rowKey) {
  const attributes = document.getElementById(`variantAttributes_${rowKey}`);
  if (!attributes) return;
  const temp = document.createElement('div');
  temp.innerHTML = renderVariantAttributeRow({});
  attributes.appendChild(temp.firstElementChild);
};

window.removeVariantAttributeRow = function(button) {
  const row = button.closest('.variant-attribute-row');
  if (row) row.remove();
};

function collectProductVariants() {
  const variants = [];
  const seenSkus = new Set();
  const rows = document.querySelectorAll('.product-variant-editor');
  if (rows.length === 0) throw new Error('Vui lòng giữ lại ít nhất một biến thể sản phẩm.');

  rows.forEach(row => {
    const sku = row.querySelector('.variant-sku')?.value.trim();
    if (!sku) throw new Error('SKU của biến thể không được để trống.');
    const normalizedSku = sku.toUpperCase();
    if (seenSkus.has(normalizedSku)) throw new Error(`SKU '${sku}' đang bị trùng trong sản phẩm này.`);
    seenSkus.add(normalizedSku);

    const attributes = [];
    row.querySelectorAll('.variant-attribute-row').forEach((attributeRow, displayOrder) => {
      const attributeName = attributeRow.querySelector('.variant-attribute-name')?.value.trim() || '';
      const attributeValue = attributeRow.querySelector('.variant-attribute-value')?.value.trim() || '';
      if (attributeName || attributeValue) {
        if (!attributeName || !attributeValue) {
          throw new Error('Mỗi thuộc tính biến thể cần đủ tên và giá trị.');
        }
        attributes.push({ attributeName, attributeValue, displayOrder });
      }
    });

    const priceInput = row.querySelector('.variant-price');
    const costPriceInput = row.querySelector('.variant-cost-price');
    const weightInput = row.querySelector('.variant-weight');
    const price = !priceInput.disabled && priceInput.value !== '' ? Number(priceInput.value) : null;
    const costPrice = costPriceInput.value !== '' ? Number(costPriceInput.value) : null;
    const weight = weightInput.value !== '' ? Number(weightInput.value) : null;
    if ((price !== null && price < 0) || (costPrice !== null && costPrice < 0) || (weight !== null && weight < 0)) {
      throw new Error('Giá và khối lượng không được là số âm.');
    }

    variants.push({
      variantId: Number(row.dataset.variantId) || null,
      sku,
      attributes,
      price,
      costPrice,
      weight,
      imageUrl: row.querySelector('.variant-image-url')?.value.trim() || null,
      status: Number(row.querySelector('.variant-status')?.value || 1)
    });
  });
  return variants;
}

function renderFormFields(key, r) {
  const v = r || {};
  switch (key) {
    case 'products': {
      const canSetBasePrice = hasAvailableStock(v);
      const basePriceHint = canSetBasePrice
        ? 'Sản phẩm đã có tồn kho: có thể cập nhật giá bán cơ sở.'
        : 'Chưa có tồn kho. Duyệt phiếu nhập NCC trước khi nhập giá bán cơ sở.';
      return `
        <div class="form-grid-2">
          <div class="form-group full">
            <label>Tên sản phẩm đồ chơi *</label>
            <input name="name" class="input-control" value="${esc(v.name)}" required placeholder="Ví dụ: Bộ xếp hình Lego City Cảnh Sát">
          </div>
          <div class="form-group">
            <label>Danh mục *</label>
            <div style="display:flex;gap:8px;">
              <select name="categoryId" class="input-control" required id="prodCatSelect">
                <option value="">-- Chọn danh mục --</option>
                ${ref.categories.map(c => `<option value="${c.id || c.categoryId}" ${v.categoryId == (c.id || c.categoryId) ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
              </select>
              <button type="button" class="secondary-btn" title="Thêm danh mục mới" onclick="quickAddRef('category')">+</button>
            </div>
          </div>
          <div class="form-group">
            <label>Thương hiệu *</label>
            <div style="display:flex;gap:8px;">
              <select name="brandId" class="input-control" required id="prodBrandSelect">
                <option value="">-- Chọn thương hiệu --</option>
                ${ref.brands.map(b => `<option value="${b.id || b.brandId}" ${v.brandId == (b.id || b.brandId) ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}
              </select>
              <button type="button" class="secondary-btn" title="Thêm thương hiệu mới" onclick="quickAddRef('brand')">+</button>
            </div>
          </div>
          <div class="form-group">
            <label>Giá bán cơ sở (VNĐ)</label>
            <input name="basePrice" type="number" min="0" step="1000" class="input-control" value="${v.basePrice ?? ''}" ${canSetBasePrice ? '' : 'disabled'} title="${esc(basePriceHint)}" placeholder="Nhập sau khi có tồn kho">
            <small style="display:block;margin-top:5px;color:${canSetBasePrice ? 'var(--success)' : 'var(--slate-500)'};">${esc(basePriceHint)}</small>
          </div>
          <div class="form-group">
            <label>Trạng thái kinh doanh</label>
            <select name="status" class="input-control">
              <option value="1" ${v.status === 1 || v.status === undefined ? 'selected' : ''}>Đang kinh doanh</option>
              <option value="2" ${v.status === 2 ? 'selected' : ''}>Thanh lý / ngừng nhập mới</option>
              <option value="0" ${v.status === 0 ? 'selected' : ''}>Tạm ngưng</option>
            </select>
          </div>
          <div class="form-group">
            <label>Độ tuổi phù hợp (tháng)</label>
            <div style="display:flex;gap:10px;">
              <input name="ageFrom" type="number" min="0" class="input-control" value="${v.ageFrom || ''}" placeholder="Từ (tháng)">
              <input name="ageTo" type="number" min="0" class="input-control" value="${v.ageTo || ''}" placeholder="Đến (tháng)">
            </div>
          </div>
          <div class="form-group">
            <label>Giới tính phù hợp</label>
            <select name="gender" class="input-control">
              <option value="3" ${v.gender === 3 ? 'selected' : ''}>Cả hai (Bé trai & Bé gái)</option>
              <option value="1" ${v.gender === 1 ? 'selected' : ''}>Bé trai</option>
              <option value="2" ${v.gender === 2 ? 'selected' : ''}>Bé gái</option>
            </select>
          </div>
          <div class="form-group full">
            <label>Mô tả chi tiết sản phẩm *</label>
            <textarea name="description" class="input-control" rows="4" required placeholder="Nhập mô tả sản phẩm, chất liệu, tính năng...">${esc(v.description)}</textarea>
          </div>
          <div class="form-group full">
            <label>URL hình ảnh sản phẩm</label>
            <input name="imageUrl" type="url" class="input-control" value="${esc(v.imageUrl)}" placeholder="https://example.com/hinh-san-pham.jpg">
          </div>
        </div>
        ${renderProductVariantsSection(v)}
      `;
    }

    case 'categories':
    case 'brands':
      return `
        <div class="form-grid-2">
          <div class="form-group full">
            <label>Tên gọi *</label>
            <input name="name" class="input-control" value="${esc(v.name)}" required placeholder="Nhập tên...">
          </div>
          <div class="form-group full">
            <label>Mô tả</label>
            <textarea name="description" class="input-control" rows="3" placeholder="Nhập mô tả tóm tắt...">${esc(v.description)}</textarea>
          </div>
          <div class="form-group">
            <label>Trạng thái</label>
            <select name="isActive" class="input-control">
              <option value="true" ${v.isActive !== false ? 'selected' : ''}>Hoạt động</option>
              <option value="false" ${v.isActive === false ? 'selected' : ''}>Tạm khóa</option>
            </select>
          </div>
        </div>
      `;

    case 'suppliers':
      return `
        <div class="form-grid-2">
          <div class="form-group">
            <label>Tên nhà cung cấp *</label>
            <input name="name" class="input-control" value="${esc(v.name)}" required placeholder="Ví dụ: Công ty Cổ phần Đồ Chơi Việt Nam">
          </div>
          <div class="form-group">
            <label>Số điện thoại *</label>
            <input name="phone" class="input-control" value="${esc(v.phone)}" required placeholder="0901234567">
          </div>
          <div class="form-group">
            <label>Email liên hệ</label>
            <input name="email" type="email" class="input-control" value="${esc(v.email)}" placeholder="ncc@domain.com">
          </div>
          <div class="form-group">
            <label>Mã số thuế</label>
            <input name="taxCode" class="input-control" value="${esc(v.taxCode)}" placeholder="0312345678">
          </div>
          <div class="form-group full">
            <label>Địa chỉ trụ sở / Kho xuất hàng</label>
            <input name="address" class="input-control" value="${esc(v.address)}" placeholder="Số 123 Đường XYZ, Quận 1, TP.HCM">
          </div>
          <div class="form-group">
            <label>Trạng thái hợp tác</label>
            <select name="isActive" class="input-control">
              <option value="true" ${v.isActive !== false ? 'selected' : ''}>Đang hoạt động</option>
              <option value="false" ${v.isActive === false ? 'selected' : ''}>Tạm ngưng</option>
            </select>
          </div>
        </div>
      `;

    case 'imports':
      return renderPurchaseOrderForm(v);

    case 'promotions':
      return `
        <div class="form-grid-2">
          <div class="form-group full">
            <label>Tên chương trình khuyến mãi *</label>
            <input name="name" class="input-control" value="${esc(v.name)}" required placeholder="Ví dụ: Siêu Sale Trung Thu 2026">
          </div>
          <div class="form-group">
            <label>Loại giảm giá *</label>
            <select name="promotionType" class="input-control">
              <option value="0" ${v.promotionType === 0 ? 'selected' : ''}>Phần trăm (%)</option>
              <option value="1" ${v.promotionType === 1 ? 'selected' : ''}>Số tiền cố định (đ)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Giá trị giảm *</label>
            <input name="discountValue" type="number" min="0" step="any" class="input-control" value="${v.discountValue || ''}" required placeholder="10 (nếu là %) hoặc 50000 (nếu là VNĐ)">
          </div>
          <div class="form-group">
            <label>Ngày bắt đầu *</label>
            <input name="startDate" type="date" class="input-control" value="${v.startDate ? v.startDate.split('T')[0] : new Date().toISOString().split('T')[0]}" required>
          </div>
          <div class="form-group">
            <label>Ngày kết thúc *</label>
            <input name="endDate" type="date" class="input-control" value="${v.endDate ? v.endDate.split('T')[0] : new Date(Date.now() + 7*86400000).toISOString().split('T')[0]}" required>
          </div>
          <div class="form-group">
            <label>Giá trị đơn hàng tối thiểu (đ)</label>
            <input name="minOrderAmount" type="number" min="0" class="input-control" value="${v.minOrderAmount || 0}">
          </div>
          <div class="form-group">
            <label>Trạng thái</label>
            <select name="status" class="input-control">
              <option value="1" ${v.status === undefined || v.status === 1 ? 'selected' : ''}>Đang kích hoạt</option>
              <option value="0" ${v.status === 0 ? 'selected' : ''}>Tạm ngưng</option>
            </select>
          </div>
          <div class="form-group full">
            <label>Mô tả chương trình</label>
            <textarea name="description" class="input-control" rows="3">${esc(v.description)}</textarea>
          </div>
        </div>
      `;

    case 'vouchers':
      return `
        <div class="form-grid-2">
          <div class="form-group">
            <label>Mã Voucher (Code) *</label>
            <input name="code" class="input-control" value="${esc(v.code)}" required placeholder="SALE50K" style="text-transform:uppercase;font-weight:700;">
          </div>
          <div class="form-group">
            <label>Tên Voucher *</label>
            <input name="name" class="input-control" value="${esc(v.name || v.code)}" required placeholder="Giảm 50K cho đơn từ 300K">
          </div>
          <div class="form-group">
            <label>Loại giảm giá</label>
            <select name="discountType" class="input-control">
              <option value="1" ${v.discountType === 1 ? 'selected' : ''}>Số tiền cố định (đ)</option>
              <option value="0" ${v.discountType === 0 ? 'selected' : ''}>Phần trăm (%)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Giá trị giảm *</label>
            <input name="discountValue" type="number" min="0" class="input-control" value="${v.discountValue || ''}" required placeholder="50000">
          </div>
          <div class="form-group">
            <label>Đơn hàng tối thiểu (đ)</label>
            <input name="minOrderAmount" type="number" min="0" class="input-control" value="${v.minimumOrderValue ?? v.minOrderAmount ?? 0}">
          </div>
          <div class="form-group">
            <label>Điểm cần đổi</label>
            <input name="requiredPoints" type="number" min="0" class="input-control" value="${v.requiredPoints || 0}" placeholder="Ví dụ: 100">
            <small style="color:var(--slate-400);">Nhập 0 nếu là voucher thường, không đổi bằng điểm.</small>
          </div>
          <div class="form-group">
            <label>Số lượt dùng tối đa</label>
            <input name="maxUsage" type="number" min="1" class="input-control" value="${v.usageLimit ?? v.maxUsage ?? 100}">
          </div>
          <div class="form-group">
            <label>Hạn sử dụng *</label>
            <input name="expiryDate" type="date" class="input-control" value="${(v.endDate || v.expiryDate) ? (v.endDate || v.expiryDate).split('T')[0] : new Date(Date.now() + 30*86400000).toISOString().split('T')[0]}" required>
          </div>
          <div class="form-group">
            <label>Trạng thái</label>
            <select name="isActive" class="input-control">
              <option value="true" ${v.status === undefined ? v.isActive !== false ? 'selected' : '' : v.status === 1 ? 'selected' : ''}>Khả dụng</option>
              <option value="false" ${v.status === undefined ? v.isActive === false ? 'selected' : '' : v.status !== 1 ? 'selected' : ''}>Khóa</option>
            </select>
          </div>
        </div>
      `;

    default:
      return `<p>Biểu mẫu chưa được định nghĩa.</p>`;
  }
}

// ── 4. PURCHASE ORDER (PHIẾU ĐẶT HÀNG NCC) BUILDER ───────────
function renderPurchaseOrderForm(v) {
  const today = new Date().toISOString().split('T')[0];
  const randomCode = 'PO-' + new Date().getFullYear() + String(new Date().getMonth()+1).padStart(2,'0') + String(new Date().getDate()).padStart(2,'0') + '-' + Math.floor(1000 + Math.random() * 9000);
  const code = v.receiptCode || randomCode;
  const existingDetails = v.importReceiptDetails || [];
  const orderedByName = v.orderedByName || currentUser?.fullName || currentUser?.userName || 'Tài khoản đang đăng nhập';

  return `
    <div class="form-grid-2" style="margin-bottom:24px;">
      <div class="form-group">
        <label>Nhà cung cấp *</label>
        <select name="supplierId" class="input-control" required id="poSupplierSelect">
          <option value="">-- Chọn nhà cung cấp --</option>
          ${ref.suppliers.map(s => `<option value="${s.id || s.supplierId}" ${v.supplierId == (s.id || s.supplierId) ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Mã phiếu đặt hàng *</label>
        <input name="receiptCode" class="input-control" value="${esc(code)}" required placeholder="PO-2026-001">
      </div>
      <div class="form-group">
        <label>Ngày đặt hàng *</label>
        <input name="importDate" type="date" class="input-control" value="${v.importDate ? v.importDate.split('T')[0] : today}" required>
      </div>
      <div class="form-group">
        <label>Người đặt</label>
        <input class="input-control" value="${esc(orderedByName)}" readonly aria-label="Người đặt hàng">
      </div>
      <div class="form-group">
        <label>Ghi chú đặt hàng</label>
        <input name="note" class="input-control" value="${esc(v.note || '')}" placeholder="Ghi chú điều khoản, thời gian dự kiến giao hàng...">
      </div>
    </div>

    <div class="form-section-card">
      <h4>
        <span>Danh sách sản phẩm đặt hàng từ nhà cung cấp</span>
        <button type="button" class="primary-btn" style="padding:6px 14px;font-size:12px;" onclick="addPurchaseOrderItemRow()">+ Thêm mặt hàng</button>
      </h4>
      <div class="order-items-builder">
        <table class="order-items-table">
          <thead>
            <tr>
              <th>Sản phẩm & Biến thể SKU *</th>
              <th style="width:140px;">Số lượng đặt *</th>
              <th style="width:180px;">Đơn giá nhập (đ) *</th>
              <th style="width:180px;">Thành tiền (đ)</th>
              <th style="width:50px;"></th>
            </tr>
          </thead>
          <tbody id="poItemsBody">
            ${existingDetails.length > 0 ? existingDetails.map((item, idx) => renderPurchaseOrderItemRow(item, idx)).join('') : ''}
          </tbody>
          <tfoot>
            <tr style="background:var(--slate-50);font-weight:700;">
              <td colspan="3" style="text-align:right;padding:12px 14px;">Tổng giá trị đơn đặt hàng:</td>
              <td style="padding:12px 14px;color:var(--primary);font-size:16px;" id="poTotalAmountDisplay">0 đ</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `;
}

let poRowIndex = 0;
function renderPurchaseOrderItemRow(item = {}, idx = null) {
  const rIdx = idx !== null ? idx : poRowIndex++;
  const variantOptions = (ref.products || []).map(p => {
    return `<optgroup label="${esc(p.name)}">
      ${productVariantsOf(p).map(vr => {
        const vId = vr.variantId || vr.id;
        const isSel = item.variantId == vId;
        return `<option value="${vId}" ${isSel ? 'selected' : ''}>${esc(p.name)} - SKU: ${esc(vr.sku || 'N/A')}</option>`;
      }).join('')}
    </optgroup>`;
  }).join('');

  const qty = item.quantity || 10;
  const cost = item.unitCost || 0;
  const total = qty * cost;

  return `
    <tr class="po-item-row" id="poRow_${rIdx}">
      <td>
        <select class="input-control po-variant-select" required onchange="calculatePOTotals()">
          <option value="">-- Chọn sản phẩm & SKU --</option>
          ${variantOptions}
        </select>
      </td>
      <td>
        <input type="number" min="1" class="input-control po-qty-input" value="${qty}" required oninput="calculatePOTotals()">
      </td>
      <td>
        <input type="number" min="0" step="1000" class="input-control po-cost-input" value="${cost}" required oninput="calculatePOTotals()">
      </td>
      <td>
        <span class="po-row-subtotal" style="font-weight:700;color:var(--slate-800);">${money(total)}</span>
      </td>
      <td style="text-align:center;">
        <button type="button" class="icon-action-btn del" title="Xóa dòng" onclick="removePurchaseOrderItemRow('poRow_${rIdx}')">✕</button>
      </td>
    </tr>
  `;
}

window.addPurchaseOrderItemRow = function() {
  const tbody = document.getElementById('poItemsBody');
  if (!tbody) return;
  const temp = document.createElement('tbody');
  temp.innerHTML = renderPurchaseOrderItemRow({}, poRowIndex++);
  tbody.appendChild(temp.firstElementChild);
  calculatePOTotals();
};

window.removePurchaseOrderItemRow = function(rowId) {
  const row = document.getElementById(rowId);
  if (row) {
    row.remove();
    calculatePOTotals();
  }
};

window.calculatePOTotals = function() {
  let grandTotal = 0;
  document.querySelectorAll('.po-item-row').forEach(row => {
    const qty = Number(row.querySelector('.po-qty-input')?.value || 0);
    const cost = Number(row.querySelector('.po-cost-input')?.value || 0);
    const sub = qty * cost;
    const subEl = row.querySelector('.po-row-subtotal');
    if (subEl) subEl.textContent = money(sub);
    grandTotal += sub;
  });
  const display = document.getElementById('poTotalAmountDisplay');
  if (display) display.textContent = money(grandTotal);
};

// ── 5. FORM SUBMISSION HANDLER ──────────────────────────────
async function handleFormSubmit(e, key, index) {
  e.preventDefault();
  const m = MODULES[key];
  const isEdit = index !== null;
  const record = isEdit ? cache[key][index] : null;
  const form = e.target;
  const fd = new FormData(form);
  let payload = Object.fromEntries(fd.entries());

  if (key === 'imports') {
    const supplierId = Number(payload.supplierId);
    if (!supplierId) {
      toast('Vui lòng chọn nhà cung cấp.', 'error');
      return;
    }

    const details = [];
    const rows = document.querySelectorAll('.po-item-row');
    if (rows.length === 0) {
      toast('Phiếu đặt hàng phải có ít nhất một mặt hàng.', 'error');
      return;
    }

    for (const r of rows) {
      const vSelect = r.querySelector('.po-variant-select');
      const variantId = Number(vSelect?.value);
      const quantity = Number(r.querySelector('.po-qty-input')?.value);
      const unitCost = Number(r.querySelector('.po-cost-input')?.value);

      if (!variantId) {
        toast('Vui lòng chọn sản phẩm cho từng dòng.', 'error');
        return;
      }
      if (quantity <= 0) {
        toast('Số lượng đặt hàng phải lớn hơn 0.', 'error');
        return;
      }

      details.push({ variantId, quantity, unitCost });
    }

    payload = {
      supplierId: supplierId,
      receiptCode: payload.receiptCode,
      importDate: new Date(payload.importDate).toISOString(),
      note: payload.note || '',
      status: 1, // Chờ duyệt
      details: details
    };
  } else if (key === 'products') {
    try {
      const basePriceInput = form.querySelector('[name="basePrice"]');
      payload.categoryId = Number(payload.categoryId);
      payload.brandId = Number(payload.brandId);
      payload.basePrice = !basePriceInput.disabled && basePriceInput.value !== ''
        ? Number(basePriceInput.value)
        : null;
      payload.status = Number(payload.status);
      payload.gender = Number(payload.gender);
      payload.ageFrom = payload.ageFrom ? Number(payload.ageFrom) : null;
      payload.ageTo = payload.ageTo ? Number(payload.ageTo) : null;
      payload.isNew = record?.isNew ?? true;
      payload.variants = collectProductVariants();
    } catch (err) {
      toast(err.message, 'error');
      return;
    }
  } else if (key === 'categories' || key === 'brands' || key === 'suppliers') {
    payload.isActive = payload.isActive === 'true';
  } else if (key === 'promotions') {
    payload.promotionType = Number(payload.promotionType);
    payload.discountValue = Number(payload.discountValue);
    payload.minOrderAmount = Number(payload.minOrderAmount || 0);
    payload.status = Number(payload.status);
    payload.startDate = new Date(payload.startDate).toISOString();
    payload.endDate = new Date(payload.endDate).toISOString();
  } else if (key === 'vouchers') {
    payload.discountType = Number(payload.discountType);
    payload.discountValue = Number(payload.discountValue);
    payload.minimumOrderValue = Number(payload.minOrderAmount || 0);
    payload.requiredPoints = Number(payload.requiredPoints || 0);
    payload.usageLimit = Number(payload.maxUsage || 100);
    payload.status = payload.isActive === 'true' ? 1 : 0;
    payload.startDate = isEdit && record?.startDate
      ? new Date(record.startDate).toISOString()
      : new Date().toISOString();
    payload.endDate = new Date(payload.expiryDate).toISOString();
    delete payload.minOrderAmount;
    delete payload.maxUsage;
    delete payload.isActive;
    delete payload.expiryDate;
  }

  try {
    const id = record ? (record.productId || record.id || record.categoryId || record.brandId || record.supplierId || record.importReceiptId || record.promotionId || record.voucherId) : '';
    const url = isEdit ? `${m.endpoint}/${id}` : m.endpoint;
    const method = isEdit ? 'PUT' : 'POST';

    if (key === 'products' && isEdit) {
      const variants = payload.variants;
      delete payload.variants;
      await api(url, { method, body: JSON.stringify(payload) });

      for (const variant of variants) {
        const variantId = variant.variantId;
        delete variant.variantId;
        await api(
          variantId ? `Product/variants/${variantId}` : `Product/${id}/variants`,
          { method: variantId ? 'PUT' : 'POST', body: JSON.stringify(variant) }
        );
      }
    } else {
      await api(url, {
        method,
        body: JSON.stringify(payload)
      });
    }

    toast(isEdit ? 'Cập nhật thành công!' : 'Tạo mới thành công!', 'success');
    await loadRef();
    renderList(key);
  } catch (err) {
    toast(`Lỗi lưu dữ liệu: ${err.message}`, 'error');
  }
}

// ── 6. PURCHASE ORDER DETAIL & APPROVAL (DUYỆT NHẬP KHO) ─────
async function showImportDetail(id) {
  try {
    const receipt = await api(`ImportReceipt/${id}`);
    if (!receipt) {
      toast('Không tìm thấy phiếu đặt hàng.', 'error');
      return;
    }

    const st = IMPORT_STATUS_MAP[receipt.status] || { label: 'Chờ duyệt', pill: 'warning' };
    const canApprove = receipt.status === 1 || receipt.status === 2;
    const canCancel = receipt.status === 1;

    app.innerHTML = `
      <div class="form-view-panel">
        <div class="form-view-header">
          <div class="form-header-title">
            <button class="back-link-btn" onclick="renderList('imports')">← Quay lại danh sách phiếu</button>
            <div>
              <h2>Chi tiết Phiếu Đặt Hàng #${esc(receipt.receiptCode || receipt.importReceiptId)}</h2>
              <p>Người đặt: ${esc(receipt.orderedByName || 'Chưa xác định')} &bull; Ngày tạo: ${fmtDate(receipt.importDate || receipt.createdAt)} &bull; Trạng thái: ${pill(st.label, st.pill)}</p>
            </div>
          </div>
          <div class="form-actions" style="margin:0;padding:0;border:none;">
            ${canApprove ? `
              <button class="success-btn" onclick="approvePurchaseOrder(${receipt.importReceiptId})">
                <span>✓</span> Duyệt phiếu & Nhập kho
              </button>
            ` : ''}
            ${canCancel ? `
              <button class="danger-btn" onclick="cancelPurchaseOrder(${receipt.importReceiptId})">
                <span>✕</span> Hủy phiếu đặt
              </button>
            ` : ''}
          </div>
        </div>

        <div class="form-body">
          <div id="inlineApprovalNotice"></div>

          <div class="form-grid-3" style="margin-bottom:24px;">
            <div class="stat-card" style="margin:0;">
              <div class="stat-label">Nhà cung cấp</div>
              <div class="stat-value" style="font-size:18px;margin:8px 0 0;">${esc(receipt.supplierName || 'Nhà cung cấp')}</div>
            </div>
            <div class="stat-card" style="margin:0;">
              <div class="stat-label">Tổng giá trị đơn đặt</div>
              <div class="stat-value" style="font-size:22px;color:var(--primary);margin:8px 0 0;">${money(receipt.totalAmount)}</div>
            </div>
            <div class="stat-card" style="margin:0;">
              <div class="stat-label">Ghi chú</div>
              <p style="font-size:13.5px;color:var(--slate-700);margin-top:8px;">${esc(receipt.note || 'Không có ghi chú.')}</p>
            </div>
          </div>

          <div class="form-section-card">
            <h4>Danh sách mặt hàng trong phiếu đặt</h4>
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Sản phẩm / Biến thể</th>
                    <th>Mã SKU</th>
                    <th>Số lượng đặt</th>
                    <th>Đã nhận vào kho</th>
                    <th>Đơn giá nhập</th>
                    <th>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  ${(receipt.importReceiptDetails || []).map(d => `
                    <tr>
                      <td><strong>${esc(d.productName || 'Sản phẩm')}</strong></td>
                      <td><code>${esc(d.sku || 'SKU')}</code></td>
                      <td><strong>${d.quantity}</strong></td>
                      <td><span style="color:${d.receivedQuantity >= d.quantity ? 'var(--success)' : 'var(--warning)'};font-weight:700;">${d.receivedQuantity || 0}</span> / ${d.quantity}</td>
                      <td>${money(d.unitCost)}</td>
                      <td><strong style="color:var(--primary);">${money(d.totalAmount)}</strong></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    toast(`Lỗi: ${err.message}`, 'error');
  }
}

window.approvePurchaseOrder = async function(id) {
  const notice = document.getElementById('inlineApprovalNotice');
  if (!notice) return;

  notice.innerHTML = `
    <div class="inline-confirm-box success">
      <div class="confirm-text">
        <b>Xác nhận duyệt phiếu & nhập hàng vào kho?</b>
        <p>Hệ thống sẽ cập nhật số lượng tồn kho thực tế của các sản phẩm trong phiếu và ghi nhận lịch sử giao dịch kho.</p>
      </div>
      <div class="confirm-actions">
        <button class="ghost-btn" onclick="document.getElementById('inlineApprovalNotice').innerHTML=''">Hủy</button>
        <button class="success-btn" onclick="executeApprovePurchaseOrder(${id})">Xác nhận Duyệt</button>
      </div>
    </div>
  `;
};

window.executeApprovePurchaseOrder = async function(id) {
  try {
    await api(`ImportReceipt/${id}/approve`, { method: 'POST' });
    toast('Duyệt phiếu & Nhập tồn kho thành công!', 'success');
    await loadRef();
    showImportDetail(id);
  } catch (err) {
    toast(`Lỗi duyệt phiếu: ${err.message}`, 'error');
  }
};

window.cancelPurchaseOrder = async function(id) {
  const notice = document.getElementById('inlineApprovalNotice');
  if (!notice) return;

  notice.innerHTML = `
    <div class="inline-confirm-box warning">
      <div class="confirm-text">
        <b>Bạn có chắc muốn hủy phiếu đặt hàng này?</b>
        <p>Phiếu sau khi hủy sẽ không thể nhập kho được nữa.</p>
      </div>
      <div class="confirm-actions">
        <button class="ghost-btn" onclick="document.getElementById('inlineApprovalNotice').innerHTML=''">Đóng</button>
        <button class="danger-btn" onclick="executeCancelPurchaseOrder(${id})">Hủy phiếu ngay</button>
      </div>
    </div>
  `;
};

window.executeCancelPurchaseOrder = async function(id) {
  try {
    await api(`ImportReceipt/${id}/cancel`, { method: 'POST' });
    toast('Đã hủy phiếu đặt hàng.', 'success');
    showImportDetail(id);
  } catch (err) {
    toast(`Lỗi: ${err.message}`, 'error');
  }
};

// ── 7. ORDER DETAIL VIEW & STATUS UPDATE ─────────────────────
async function showOrderDetail(id) {
  try {
    const order = await api(`Order/${id}`);
    if (!order) {
      toast('Không tìm thấy đơn hàng.', 'error');
      return;
    }

    app.innerHTML = `
      <div class="form-view-panel">
        <div class="form-view-header">
          <div class="form-header-title">
            <button class="back-link-btn" onclick="renderList('orders')">← Quay lại danh sách đơn hàng</button>
            <div>
              <h2>Chi tiết Đơn hàng #${esc(order.orderCode || order.orderId)}</h2>
              <p>Ngày đặt: ${fmtDateTime(order.orderDate || order.createdAt)}</p>
            </div>
          </div>
          <div>
            ${pill(ORDER_STATUS_LABELS[order.status] || 'Đang xử lý', order.status === 4 ? 'success' : (order.status === 5 ? 'danger' : 'warning'))}
          </div>
        </div>

        <div class="form-body">
          <div class="form-grid-3" style="margin-bottom:24px;">
            <div class="form-section-card" style="margin:0;">
              <h4>Thông tin khách hàng</h4>
              <p><strong>Họ tên:</strong> ${esc(order.customerName || order.shipping?.receiverName || 'Khách vãng lai')}</p>
              <p><strong>SĐT:</strong> ${esc(order.phoneNumber || order.shipping?.receiverPhone || '—')}</p>
              <p><strong>Email:</strong> ${esc(order.customerEmail || '—')}</p>
            </div>
            <div class="form-section-card" style="margin:0;">
              <h4>Địa chỉ giao hàng</h4>
              <p><strong>Người nhận:</strong> ${esc(order.shipping?.receiverName || order.customerName || '—')}</p>
              <p><strong>SĐT nhận hàng:</strong> ${esc(order.shipping?.receiverPhone || order.phoneNumber || '—')}</p>
              <p>${esc(order.shipping?.address || 'Chưa có địa chỉ giao hàng')}</p>
              <p><strong>Ghi chú đơn hàng:</strong> ${esc(order.note || 'Không có ghi chú.')}</p>
            </div>
            <div class="form-section-card" style="margin:0;">
              <h4>Cập nhật trạng thái đơn</h4>
              <div style="display:flex;gap:8px;margin-top:10px;">
                <select class="input-control" id="orderNewStatusSelect">
                  ${ORDER_STATUS_LABELS.map((label, stIdx) => `
                    <option value="${stIdx}" ${order.status === stIdx ? 'selected' : ''}>${label}</option>
                  `).join('')}
                </select>
                <button class="primary-btn" style="white-space:nowrap;" onclick="updateOrderStatusAction(${order.orderId})">Cập nhật</button>
              </div>
            </div>
          </div>

          <div class="form-section-card">
            <h4>Sản phẩm trong đơn hàng</h4>
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Sản phẩm</th>
                    <th>Đơn giá</th>
                    <th>Số lượng</th>
                    <th>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  ${(order.orderDetails || order.items || []).map(it => `
                    <tr>
                      <td><strong>${esc(it.productName || 'Sản phẩm')}</strong></td>
                      <td>${money(it.unitPrice)}</td>
                      <td><strong>${it.quantity}</strong></td>
                      <td><strong style="color:var(--primary);">${money(it.totalPrice || (it.unitPrice * it.quantity))}</strong></td>
                    </tr>
                  `).join('')}
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="3" style="text-align:right;font-weight:700;">Tổng tiền thanh toán:</td>
                    <td style="font-size:16px;font-weight:800;color:var(--primary);">${money(order.finalAmount || order.totalAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    toast(`Lỗi tải đơn hàng: ${err.message}`, 'error');
  }
}

window.updateOrderStatusAction = async function(id) {
  const newSt = Number(document.getElementById('orderNewStatusSelect')?.value);
  try {
    await api(`Order/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: newSt })
    });
    toast('Cập nhật trạng thái đơn hàng thành công!', 'success');
    showOrderDetail(id);
  } catch (err) {
    toast(`Lỗi: ${err.message}`, 'error');
  }
};

// ── 8. INLINE USER ROLE MANAGEMENT & PASSWORD ───────────────
function showUserRoleForm(index) {
  const user = cache.users[index];
  if (!user) return;

  app.innerHTML = `
    <div class="form-view-panel">
      <div class="form-view-header">
        <div class="form-header-title">
          <button class="back-link-btn" onclick="renderList('users')">← Quay lại danh sách người dùng</button>
          <div>
            <h2>Phân quyền tài khoản: ${esc(user.fullName || user.email)}</h2>
            <p>Email: ${esc(user.email)}</p>
          </div>
        </div>
      </div>

      <div class="form-body">
        <div class="form-grid-2">
          <div class="form-group">
            <label>Chọn vai trò mới (Role) *</label>
            <select class="input-control" id="inPageRoleSelect">
              <option value="Admin" ${user.role === 'Admin' ? 'selected' : ''}>Admin (Quản trị toàn quyền)</option>
              <option value="Manager" ${user.role === 'Manager' ? 'selected' : ''}>Manager (Quản lý cửa hàng)</option>
              <option value="Staff" ${user.role === 'Staff' ? 'selected' : ''}>Staff (Nhân viên vận hành)</option>
              <option value="Customer" ${user.role === 'Customer' ? 'selected' : ''}>Customer (Khách hàng)</option>
            </select>
          </div>
        </div>
        <div class="form-footer-actions" style="padding:0;background:transparent;border:none;">
          <button class="ghost-btn" onclick="renderList('users')">Hủy</button>
          <button class="primary-btn" onclick="saveUserRoleAction('${user.userId || user.id}')">Lưu phân quyền</button>
        </div>
      </div>
    </div>
  `;
}

window.saveUserRoleAction = async function(userId) {
  const role = document.getElementById('inPageRoleSelect')?.value;
  try {
    await api('Auth/assign-role', {
      method: 'POST',
      body: JSON.stringify({ userId, role })
    });
    toast('Cập nhật vai trò người dùng thành công!', 'success');
    renderList('users');
  } catch (err) {
    toast(`Lỗi: ${err.message}`, 'error');
  }
};

window.toggleUserStatus = async function(userId) {
  try {
    await api(`Auth/users/${userId}/toggle-status`, { method: 'POST' });
    toast('Cập nhật trạng thái tài khoản thành công!', 'success');
    renderList('users');
  } catch (err) {
    toast(`Lỗi: ${err.message}`, 'error');
  }
};

// Admin Change Password In-Page
document.getElementById('adminChangePassBtn')?.addEventListener('click', () => {
  app.innerHTML = `
    <div class="form-view-panel">
      <div class="form-view-header">
        <div class="form-header-title">
          <button class="back-link-btn" onclick="navigate()">← Quay lại</button>
          <div>
            <h2>Đổi mật khẩu tài khoản Quản trị</h2>
            <p>Vui lòng nhập mật khẩu hiện tại và thiết lập mật khẩu mới.</p>
          </div>
        </div>
      </div>

      <form id="adminChangePassForm" onsubmit="handleAdminChangePass(event)">
        <div class="form-body">
          <div class="form-grid-2">
            <div class="form-group full">
              <label>Mật khẩu hiện tại *</label>
              <input name="currentPassword" type="password" class="input-control" required placeholder="Nhập mật khẩu cũ">
            </div>
            <div class="form-group">
              <label>Mật khẩu mới *</label>
              <input name="newPassword" type="password" minlength="6" class="input-control" required placeholder="Tối thiểu 6 ký tự">
            </div>
            <div class="form-group">
              <label>Xác nhận mật khẩu mới *</label>
              <input name="confirmPassword" type="password" minlength="6" class="input-control" required placeholder="Nhập lại mật khẩu mới">
            </div>
          </div>
        </div>
        <div class="form-footer-actions">
          <button type="button" class="ghost-btn" onclick="navigate()">Hủy bỏ</button>
          <button type="submit" class="primary-btn">Cập nhật mật khẩu mới</button>
        </div>
      </form>
    </div>
  `;
});

async function handleAdminChangePass(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const data = Object.fromEntries(fd.entries());
  if (data.newPassword !== data.confirmPassword) {
    toast('Mật khẩu xác nhận không khớp.', 'error');
    return;
  }
  try {
    await api('Auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    toast('Đổi mật khẩu thành công!', 'success');
    navigate();
  } catch (err) {
    toast(`Lỗi: ${err.message}`, 'error');
  }
}

// ── 9. INLINE DELETE CONFIRMATION ───────────────────────────
function confirmDelete(key, index) {
  const m = MODULES[key];
  const record = cache[key][index];
  const tbody = document.getElementById('listTableBody');
  const rows = tbody.querySelectorAll('tr');
  const targetRow = rows[index];
  if (!targetRow) return;

  const id = record.productId || record.id || record.categoryId || record.brandId || record.supplierId || record.importReceiptId || record.promotionId || record.voucherId;

  targetRow.innerHTML = `
    <td colspan="${m.columns.length + 1}" style="padding:16px 20px;background:var(--danger-bg);">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <span style="color:var(--danger);font-weight:700;">
          ⚠ Bạn có chắc chắn muốn xóa mục này? Hành động này không thể hoàn tác.
        </span>
        <div style="display:flex;gap:8px;">
          <button class="ghost-btn" style="padding:6px 14px;font-size:12px;" onclick="renderList('${key}')">Hủy</button>
          <button class="danger-btn" style="padding:6px 14px;font-size:12px;" onclick="executeDelete('${key}', '${id}')">Xóa vĩnh viễn</button>
        </div>
      </div>
    </td>
  `;
}

async function executeDelete(key, id) {
  const m = MODULES[key];
  try {
    await api(`${m.endpoint}/${id}`, { method: 'DELETE' });
    toast('Đã xóa thành công!', 'success');
    renderList(key);
  } catch (err) {
    toast(`Lỗi xóa: ${err.message}`, 'error');
  }
}

// Quick Add Reference on the fly
window.quickAddRef = async function(type) {
  const name = prompt(type === 'category' ? 'Nhập tên danh mục mới:' : 'Nhập tên thương hiệu mới:');
  if (!name || !name.trim()) return;
  try {
    const ep = type === 'category' ? 'Category' : 'Brand';
    const res = await api(ep, {
      method: 'POST',
      body: JSON.stringify({ name: name.trim(), description: '', isActive: true })
    });
    await loadRef();
    const selectId = type === 'category' ? 'prodCatSelect' : 'prodBrandSelect';
    const sel = document.getElementById(selectId);
    if (sel && res?.id) {
      sel.innerHTML = `<option value="">-- Chọn --</option>` + (type === 'category' ? ref.categories : ref.brands).map(item => `
        <option value="${item.id || item.categoryId || item.brandId}" ${item.id == res.id ? 'selected' : ''}>${esc(item.name)}</option>
      `).join('');
      sel.value = res.id;
    }
    toast(`Thêm ${type === 'category' ? 'danh mục' : 'thương hiệu'} thành công!`, 'success');
  } catch (err) {
    toast(`Lỗi: ${err.message}`, 'error');
  }
};

// ── 10. AUTH & INIT ─────────────────────────────────────────
document.getElementById('logoutButton')?.addEventListener('click', () => {
  localStorage.removeItem('toyStoreToken');
  localStorage.removeItem('toyStoreUser');
  location.replace('/customer.html');
});

document.getElementById('menuToggle')?.addEventListener('click', () => {
  document.getElementById('sidebar')?.classList.toggle('open');
});

// Chỉ tài khoản thuộc khu vực quản trị mới được mở trang Admin.
const adminPortalRoles = ['admin', 'manager', 'staff'];
const canAccessAdminPortal = user => adminPortalRoles.includes(String(user?.role || '').trim().toLowerCase());

// Không đăng nhập hoặc không có quyền quản trị thì trở về trang khách hàng.
if (!token || !canAccessAdminPortal(currentUser)) {
  location.replace('/customer.html');
} else {
  document.querySelector('.app-shell')?.classList.add('show');
  if (currentUser) {
    const uName = document.getElementById('currentUserName');
    const uRole = document.getElementById('userRole');
    const uAvatar = document.getElementById('userAvatar');
    if (uName) uName.textContent = currentUser.fullName || currentUser.userName || 'Admin';
    if (uRole) uRole.textContent = currentUser.role || 'Quản trị viên';
    if (uAvatar) uAvatar.textContent = (currentUser.fullName || currentUser.userName || 'AD').slice(0, 2).toUpperCase();
  }
  checkApiStatus();
  loadRef().then(navigate);
}
