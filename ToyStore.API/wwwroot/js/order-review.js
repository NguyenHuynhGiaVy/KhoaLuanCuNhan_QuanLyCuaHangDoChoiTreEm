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
  const getCurrentUserId = () => {
    try { return JSON.parse(localStorage.getItem('toyStoreUser') || 'null')?.userId || null; }
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
    if (!pending.accountUserId || pending.accountUserId !== getCurrentUserId()) {
      localStorage.removeItem('toyStorePendingOrder');
      showEmpty('Phiên xác nhận đơn không còn hiệu lực.');
      return;
    }
    if (pending.paymentMethod === 'ZaloPay' && pending.createdOrderId && pending.zaloPaymentUrl) {
      renderZaloPaySandboxPayment(pending);
      return;
    }

    const originalSubtotal = pending.items.reduce((sum, item) =>
      sum + Number(item.originalPrice ?? item.price ?? 0) * Number(item.quantity || 1), 0);
    const subtotal = pending.items.reduce((sum, item) =>
      sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
    const promotionDiscount = Math.max(0, originalSubtotal - subtotal);
    const voucherDiscount = Math.min(subtotal, Math.max(0, Number(pending.voucherDiscount || 0)));
    const shippingFee = subtotal >= 500000 ? 0 : 30000;
    const total = Math.max(0, subtotal - voucherDiscount + shippingFee);
    const isZaloPay = pending.paymentMethod === 'ZaloPay';
    const paymentName = isZaloPay
      ? 'ZaloPay Sandbox'
      : pending.paymentMethod === 'Banking'
        ? 'Chuyển khoản ngân hàng'
        : 'Thanh toán khi nhận hàng (COD)';
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
          <section class="review-card"><h2>Sản phẩm đã chọn</h2>${pending.items.map(item => {
            const variantText = item.variantAttributes || item.variantAttributesText || (item.sku ? `SKU: ${item.sku}` : '');
            return `
            <article class="review-item">
              <img src="${escapeHtml(item.imageUrl || 'https://placehold.co/100x100?text=Toy')}" alt="${escapeHtml(item.name)}">
              <div style="flex:1;min-width:0;">
                <h3 style="margin-bottom:3px;">${escapeHtml(item.name)}</h3>
                ${variantText ? `
                  <div style="margin-bottom:4px;">
                    <span style="display:inline-block;background:#f1f5f9;border:1px solid #e2e8f0;padding:2px 8px;border-radius:4px;font-size:11.5px;color:#334155;font-weight:600;">
                      🏷️ ${escapeHtml(variantText)}
                    </span>
                  </div>
                ` : ''}
                <small>${Number(item.originalPrice ?? item.price) > Number(item.price) ? `<del class="original-price">${money(item.originalPrice)}</del> ` : ''}${money(item.price)} × ${Number(item.quantity || 1)}</small>
              </div>
              <strong>${money(Number(item.price || 0) * Number(item.quantity || 1))}</strong>
            </article>`;
          }).join('')}</section>
          <section class="review-card"><h2>Thông tin nhận hàng</h2>
            <div class="review-info"><div><span>Người nhận</span><p>${escapeHtml(pending.customer.fullName)}</p></div><div><span>Số điện thoại</span><p>${escapeHtml(pending.customer.phone)}</p></div><div style="grid-column:1/-1;"><span>Địa chỉ</span><p>${escapeHtml(pending.customer.address)}</p></div>${pending.note ? `<div style="grid-column:1/-1;"><span>Ghi chú</span><p>${escapeHtml(pending.note)}</p></div>` : ''}</div>
          </section>
        </div>
        <aside class="review-card"><h2>Tổng đơn hàng</h2>
          <div class="review-total-row"><span>Tạm tính</span><strong>${money(originalSubtotal)}</strong></div>
          ${promotionDiscount > 0 ? `<div class="review-total-row"><span>Khuyến mãi sản phẩm</span><strong style="color:var(--success);">−${money(promotionDiscount)}</strong></div>` : ''}
          ${voucherDiscount > 0 ? `<div class="review-total-row"><span>Voucher ${pending.voucherCode ? `(${escapeHtml(pending.voucherCode)})` : ''}</span><strong style="color:var(--success);">−${money(voucherDiscount)}</strong></div>` : ''}
          <div class="review-total-row"><span>Phí giao hàng</span><strong>${shippingFee ? money(shippingFee) : 'Miễn phí'}</strong></div>
          <div class="review-total-row"><span>Thanh toán</span><strong>${escapeHtml(paymentName)}</strong></div>
          <div class="review-total-row total"><span>Tổng cộng</span><strong>${money(total)}</strong></div>
          <div class="review-reward-note">🎁 Điểm thưởng dự kiến: <strong>+${points} điểm</strong>. Điểm chỉ được cộng khi đơn hàng hoàn tất.</div>
          <button class="review-primary" id="placeOrderBtn">${isZaloPay ? 'Tạo đơn & mở ZaloPay Sandbox' : 'Đặt hàng'}</button>
          <button class="review-secondary" id="backToCheckoutBtn">Quay lại chỉnh sửa</button>
        </aside>
      </div>`;

    document.getElementById('placeOrderBtn')?.addEventListener('click', () => placeOrder(pending));
    document.getElementById('backToCheckoutBtn')?.addEventListener('click', () => history.back());
  }

  async function placeOrder(pending) {
    const token = localStorage.getItem('toyStoreToken');
    const currentUserId = getCurrentUserId();
    if (!token || !currentUserId || pending.accountUserId !== currentUserId) {
      localStorage.removeItem('toyStorePendingOrder');
      showToast('Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.', 'error');
      return;
    }

    const isZaloPay = pending.paymentMethod === 'ZaloPay';
    // Mở cửa sổ ngay trong lần nhấn của khách để trình duyệt không chặn popup;
    // sau khi API tạo giao dịch xong, cửa sổ này sẽ được điều hướng đến ZaloPay.
    const zaloPayWindow = isZaloPay ? window.open('', 'zalopaySandbox') : null;
    const button = document.getElementById('placeOrderBtn');
    if (button) { button.disabled = true; button.textContent = 'Đang tạo đơn...'; }

    try {
      const profileResponse = await fetch(`${API_BASE}/api/Customer/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const profile = await profileResponse.json().catch(() => ({}));
      if (!profileResponse.ok || !profile.customerId || profile.userId !== currentUserId) {
        throw new Error('Phiên tài khoản đã thay đổi. Vui lòng tạo lại đơn hàng.');
      }

      let result;
      if (isZaloPay && pending.createdOrderId) {
        result = { orderId: pending.createdOrderId, orderCode: pending.createdOrderCode };
      } else {
        const payload = {
          customerId: profile.customerId,
          paymentMethod: isZaloPay ? 2 : pending.paymentMethod === 'Banking' ? 1 : 0,
          note: pending.note || '',
          voucherCode: pending.voucherCode || null,
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
        result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || result.title || 'Không thể tạo đơn hàng.');

        if (isZaloPay) {
          pending.createdOrderId = result.orderId;
          pending.createdOrderCode = result.orderCode;
          localStorage.setItem('toyStorePendingOrder', JSON.stringify(pending));
        }
      }

      if (isZaloPay) {
        if (!result.orderId) throw new Error('Không xác định được đơn hàng để thanh toán ZaloPay.');
        if (pending.zaloPaymentUrl) {
          if (zaloPayWindow && !zaloPayWindow.closed) {
            zaloPayWindow.location.href = pending.zaloPaymentUrl;
          }
          renderZaloPaySandboxPayment(pending);
          return;
        }
        if (button) button.textContent = 'Đang tạo phiên ZaloPay...';

        const zaloResponse = await fetch(`${API_BASE}/api/ZaloPay/orders/${encodeURIComponent(result.orderId)}/create`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const zaloPayment = await zaloResponse.json().catch(() => ({}));
        if (zaloPayment.isPaid) {
          zaloPayWindow?.close();
          recordPurchasedProducts(pending.items);
          localStorage.removeItem('toyStorePendingOrder');
          localStorage.removeItem('toyStoreCart');
          renderPaymentSuccess(result.orderId, result.orderCode);
          return;
        }
        if (zaloResponse.status === 409) {
          zaloPayWindow?.close();
          renderZaloPaySandboxPayment(pending, { orderId: result.orderId, orderCode: result.orderCode });
          return;
        }
        if (!zaloResponse.ok || !zaloPayment.orderUrl) {
          throw new Error(zaloPayment.message || 'Không thể khởi tạo thanh toán ZaloPay.');
        }

        // Chỉ xoá giỏ sau khi khách bấm xác nhận thanh toán mô phỏng.
        pending.zaloPaymentUrl = zaloPayment.orderUrl;
        localStorage.setItem('toyStorePendingOrder', JSON.stringify(pending));
        if (zaloPayWindow && !zaloPayWindow.closed) {
          zaloPayWindow.location.href = zaloPayment.orderUrl;
        }
        renderZaloPaySandboxPayment(pending, { orderId: result.orderId, orderCode: result.orderCode });
        return;
      }

      recordPurchasedProducts(pending.items);
      localStorage.removeItem('toyStorePendingOrder');
      localStorage.removeItem('toyStoreCart');
      const finalOrderId = result.orderId || result.orderCode;
      root.innerHTML = `
        <section class="review-card review-success">
          <div class="mark">✓</div>
          <h1>Đặt hàng thành công!</h1>
          <p style="color:var(--text-muted);margin:8px 0 20px;">Mã đơn hàng của bạn là <strong>#${escapeHtml(result.orderCode || result.orderId)}</strong>. Cửa hàng đã ghi nhận đơn hàng của bạn.</p>
          <div style="display:flex;justify-content:center;gap:12px;flex-wrap:wrap;">
            <button type="button" class="review-primary" id="viewCreatedOrderBtn" style="width:auto;padding:12px 24px;">👁 Xem chi tiết đơn hàng</button>
            <a class="review-secondary" href="/products.html" style="display:inline-flex;align-items:center;width:auto;padding:12px 24px;text-decoration:none;">Tiếp tục mua sắm</a>
          </div>
        </section>`;
      
      document.getElementById('viewCreatedOrderBtn')?.addEventListener('click', () => {
        if (typeof window.showOrderDetailModal === 'function') {
          window.showOrderDetailModal(finalOrderId);
        } else {
          location.href = `/customer.html`;
        }
      });

      showToast('Đơn hàng đã được tạo thành công.');
    } catch (error) {
      zaloPayWindow?.close();
      showToast(`Lỗi đặt hàng: ${error.message}`, 'error');
      if (button) { button.disabled = false; button.textContent = 'Đặt hàng'; }
    }
  }

  function clearConfirmedPayment(pending) {
    if (pending?.accountUserId === getCurrentUserId()) {
      recordPurchasedProducts(pending.items);
      localStorage.removeItem('toyStorePendingOrder');
      localStorage.removeItem('toyStoreCart');
    }
  }

  function renderPaymentSuccess(orderId, orderCode) {
    root.innerHTML = `
      <section class="review-card review-success">
        <div class="mark">✓</div>
        <h1>Đã xác nhận thanh toán!</h1>
        <p style="color:var(--text-muted);margin:8px 0 20px;">Đơn hàng <strong>#${escapeHtml(orderCode || orderId)}</strong> đã được ghi nhận là đã thanh toán. Cửa hàng sẽ xử lý đơn trong thời gian sớm nhất.</p>
        <a class="review-primary" href="/customer.html" style="display:inline-flex;align-items:center;width:auto;padding:12px 24px;text-decoration:none;">Xem đơn hàng của tôi</a>
      </section>`;
  }

  function renderZaloPaySandboxPayment(pending, payment = {}) {
    const orderId = Number(payment.orderId || pending?.createdOrderId);
    const orderCode = payment.orderCode || pending?.createdOrderCode || orderId;
    const paymentUrl = pending?.zaloPaymentUrl || '';
    const subtotal = (pending?.items || []).reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
    const voucherDiscount = Math.min(subtotal, Math.max(0, Number(pending?.voucherDiscount || 0)));
    const total = subtotal - voucherDiscount + (subtotal >= 500000 ? 0 : 30000);

    root.innerHTML = `
      <section class="review-card review-success" style="max-width:680px;margin:32px auto;">
        <div style="font-size:42px;">💳</div>
        <h1>Thanh toán ZaloPay Sandbox</h1>
        <p style="color:var(--text-muted);margin:8px 0;">Đơn hàng <strong>#${escapeHtml(orderCode)}</strong> đã được tạo với tổng tiền <strong>${money(Math.max(0, total))}</strong>.</p>
        <p style="color:var(--text-muted);margin:8px 0 20px;">Mở trang ZaloPay ở tab mới để xem QR/cổng thanh toán. Đây là luồng kiểm thử, nên sau đó bấm nút xác nhận bên dưới để giả lập khách đã thanh toán.</p>
        ${paymentUrl ? `<a class="review-primary" href="${escapeHtml(paymentUrl)}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;width:auto;padding:12px 24px;text-decoration:none;margin:0 6px 12px;">Mở ZaloPay Sandbox ↗</a>` : ''}
        <button type="button" class="review-primary" id="confirmSandboxPaymentBtn" style="width:auto;padding:12px 24px;margin:0 6px 12px;">✓ Xác nhận đã thanh toán</button>
        <p style="font-size:13px;color:var(--text-muted);margin-top:14px;">Nút này chỉ hoạt động trong môi trường Sandbox, không thực hiện giao dịch tiền thật.</p>
      </section>`;

    document.getElementById('confirmSandboxPaymentBtn')?.addEventListener('click', () => confirmSandboxPayment(orderId, orderCode, pending));
  }

  async function confirmSandboxPayment(orderId, orderCode, pending) {
    const token = localStorage.getItem('toyStoreToken');
    const button = document.getElementById('confirmSandboxPaymentBtn');
    if (!token || !Number.isInteger(orderId) || orderId <= 0) {
      showToast('Không thể xác nhận thanh toán. Vui lòng đăng nhập lại.', 'error');
      return;
    }

    if (button) { button.disabled = true; button.textContent = 'Đang xác nhận...'; }
    try {
      const response = await fetch(`${API_BASE}/api/ZaloPay/orders/${encodeURIComponent(orderId)}/confirm-sandbox-payment`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.isPaid) {
        throw new Error(result.message || 'Không thể xác nhận thanh toán mô phỏng.');
      }

      clearConfirmedPayment(pending);
      renderPaymentSuccess(result.orderId || orderId, result.orderCode || orderCode);
      showToast('Đơn hàng đã được đánh dấu là đã thanh toán.');
    } catch (error) {
      showToast(`Lỗi xác nhận thanh toán: ${error.message}`, 'error');
      if (button) { button.disabled = false; button.textContent = '✓ Xác nhận đã thanh toán'; }
    }
  }

  async function renderZaloPayReturn() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('zalopay') !== 'return') return false;

    const orderId = Number(params.get('orderId'));
    const token = localStorage.getItem('toyStoreToken');
    if (!Number.isInteger(orderId) || orderId <= 0 || !token) {
      showEmpty('Không thể kiểm tra kết quả thanh toán ZaloPay.');
      return true;
    }

    root.innerHTML = `
      <section class="review-card review-empty">
        <div style="font-size:44px;">⌛</div>
        <h1>Đang kiểm tra thanh toán ZaloPay...</h1>
        <p style="color:var(--text-muted);">Vui lòng chờ trong giây lát.</p>
      </section>`;

    try {
      const response = await fetch(`${API_BASE}/api/ZaloPay/orders/${encodeURIComponent(orderId)}/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const payment = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payment.message || 'Không thể kiểm tra trạng thái thanh toán.');

      if (payment.isPaid) {
        const pending = getPendingOrder();
        clearConfirmedPayment(pending);
        renderPaymentSuccess(payment.orderId || orderId, payment.orderCode);
        return true;
      }

      renderZaloPaySandboxPayment(getPendingOrder(), { orderId, orderCode: payment.orderCode });
    } catch (error) {
      showEmpty(error.message || 'Không thể kiểm tra trạng thái thanh toán ZaloPay.');
    }
    return true;
  }

  renderZaloPayReturn().then(isZaloPayReturn => {
    if (!isZaloPayReturn) renderReview();
  });
})();
