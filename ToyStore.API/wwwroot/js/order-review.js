(() => {
  'use strict';

  const API_BASE = (window.location.protocol === 'file:' || (window.location.port && window.location.port !== '5225'))
    ? 'http://localhost:5225'
    : '';
  const root = document.getElementById('orderReviewContent');
  const money = value => `${Number(value || 0).toLocaleString('vi-VN')}đ`;
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const getPendingOrder = () => {
    try { return JSON.parse(localStorage.getItem('toyStorePendingOrder') || 'null'); }
    catch { return null; }
  };

  function recordPurchasedProducts(items) {
    let user;
    try { user = JSON.parse(localStorage.getItem('toyStoreUser') || 'null'); } catch { user = null; }
    if (!user?.userId || !Array.isArray(items)) return;

    const key = `toyStoreProductBehavior:${user.userId}`;
    let behavior;
    try { behavior = JSON.parse(localStorage.getItem(key) || '{}'); } catch { behavior = {}; }
    behavior.views = behavior.views && typeof behavior.views === 'object' ? behavior.views : {};
    behavior.purchases = behavior.purchases && typeof behavior.purchases === 'object' ? behavior.purchases : {};

    items.forEach(item => {
      if (!item?.productId) return;
      const old = behavior.purchases[item.productId] || {};
      behavior.purchases[item.productId] = {
        productId: Number(item.productId),
        categoryId: item.categoryId ?? old.categoryId ?? null,
        quantity: Number(old.quantity || 0) + Number(item.quantity || 1),
        lastPurchasedAt: new Date().toISOString()
      };
    });
    localStorage.setItem(key, JSON.stringify(behavior));
  }

  function showToast(message, type = 'success') {
    const toast = document.getElementById('customerToast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `customer-toast ${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3200);
  }

  function showEmpty(message = 'Chưa có đơn hàng cần xác nhận.') {
    root.innerHTML = `
      <section class="review-card review-empty">
        <div style="font-size:44px;">🛍</div>
        <h1>${escapeHtml(message)}</h1>
        <p style="color:var(--text-muted);">Hãy quay lại giỏ hàng để chọn sản phẩm và xem chi tiết trước khi đặt.</p>
        <a class="review-primary" href="/products.html" style="display:inline-block;width:auto;margin-top:20px;">Mua sắm ngay</a>
      </section>`;
  }

  function renderReview() {
    const pending = getPendingOrder();
    if (!pending?.items?.length || !pending.customer) {
      showEmpty();
      return;
    }

    const subtotal = pending.items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
    const shippingFee = subtotal >= 500000 ? 0 : 30000;
    const total = subtotal + shippingFee;
    const paymentName = pending.paymentMethod === 'Banking' ? 'Chuyển khoản ngân hàng' : 'Thanh toán khi nhận hàng (COD)';
    const points = Math.floor(total / 10000);

    root.innerHTML = `
      <div class="order-review-head">
        <div>
          <div class="order-review-crumb"><a href="/products.html">Sản phẩm</a><span>›</span><span>Xác nhận đơn</span></div>
          <h1>Kiểm tra đơn hàng</h1>
          <p>Vui lòng kiểm tra đầy đủ thông tin trước khi đặt hàng.</p>
        </div>
        <div class="order-review-steps"><span class="order-review-step">1. Giỏ hàng</span><span class="order-review-step active">2. Xem chi tiết</span><span class="order-review-step">3. Đặt hàng</span></div>
      </div>
      <div class="order-review-grid">
        <div>
          <section class="review-card"><h2>Sản phẩm đã chọn</h2>${pending.items.map(item => `
            <article class="review-item">
              <img src="${escapeHtml(item.imageUrl || 'https://placehold.co/100x100?text=Toy')}" alt="${escapeHtml(item.name)}">
              <div><h3>${escapeHtml(item.name)}</h3><small>${money(item.price)} × ${Number(item.quantity || 1)}</small></div>
              <strong>${money(Number(item.price || 0) * Number(item.quantity || 1))}</strong>
            </article>`).join('')}</section>
          <section class="review-card"><h2>Thông tin nhận hàng</h2>
            <div class="review-info"><div><span>Người nhận</span><p>${escapeHtml(pending.customer.fullName)}</p></div><div><span>Số điện thoại</span><p>${escapeHtml(pending.customer.phone)}</p></div><div style="grid-column:1/-1;"><span>Địa chỉ</span><p>${escapeHtml(pending.customer.address)}</p></div>${pending.note ? `<div style="grid-column:1/-1;"><span>Ghi chú</span><p>${escapeHtml(pending.note)}</p></div>` : ''}</div>
          </section>
        </div>
        <aside class="review-card"><h2>Tổng đơn hàng</h2>
          <div class="review-total-row"><span>Tạm tính</span><strong>${money(subtotal)}</strong></div>
          <div class="review-total-row"><span>Phí giao hàng</span><strong>${shippingFee ? money(shippingFee) : 'Miễn phí'}</strong></div>
          <div class="review-total-row"><span>Thanh toán</span><strong>${escapeHtml(paymentName)}</strong></div>
          <div class="review-total-row total"><span>Tổng cộng</span><strong>${money(total)}</strong></div>
          <div class="review-reward-note">🎁 Điểm thưởng dự kiến: <strong>+${points} điểm</strong>. Điểm chỉ được cộng khi đơn hàng hoàn tất.</div>
          <button class="review-primary" id="placeOrderBtn">Đặt hàng</button>
          <button class="review-secondary" id="backToCheckoutBtn">Quay lại chỉnh sửa</button>
        </aside>
      </div>`;

    document.getElementById('placeOrderBtn')?.addEventListener('click', () => placeOrder(pending));
    document.getElementById('backToCheckoutBtn')?.addEventListener('click', () => history.back());
  }

  async function placeOrder(pending) {
    const token = localStorage.getItem('toyStoreToken');
    if (!token) {
      showToast('Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.', 'error');
      return;
    }

    const button = document.getElementById('placeOrderBtn');
    if (button) { button.disabled = true; button.textContent = 'Đang tạo đơn...'; }

    try {
      const profileResponse = await fetch(`${API_BASE}/api/Customer/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const profile = await profileResponse.json().catch(() => ({}));
      if (!profileResponse.ok || !profile.customerId) throw new Error('Vui lòng hoàn thiện hồ sơ khách hàng trước khi đặt hàng.');

      const payload = {
        customerId: profile.customerId,
        paymentMethod: pending.paymentMethod === 'Banking' ? 1 : 0,
        note: pending.note || '',
        shipping: {
          receiverName: pending.customer.fullName,
          receiverPhone: pending.customer.phone,
          address: pending.customer.address,
          shippingMethod: 0
        },
        orderDetails: pending.orderDetails
      };
      const response = await fetch(`${API_BASE}/api/Order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || result.title || 'Không thể tạo đơn hàng.');

      recordPurchasedProducts(pending.items);
      localStorage.removeItem('toyStorePendingOrder');
      localStorage.removeItem('toyStoreCart');
      root.innerHTML = `<section class="review-card review-success"><div class="mark">✓</div><h1>Đặt hàng thành công!</h1><p style="color:var(--text-muted);margin:8px 0 20px;">Mã đơn hàng của bạn là <strong>#${escapeHtml(result.orderCode || result.orderId)}</strong>. Chúng tôi sẽ sớm xác nhận đơn hàng.</p><a class="review-primary" href="/products.html" style="display:inline-block;width:auto;">Tiếp tục mua sắm</a></section>`;
      showToast('Đơn hàng đã được tạo thành công.');
    } catch (error) {
      showToast(`Lỗi đặt hàng: ${error.message}`, 'error');
      if (button) { button.disabled = false; button.textContent = 'Đặt hàng'; }
    }
  }

  renderReview();
})();
