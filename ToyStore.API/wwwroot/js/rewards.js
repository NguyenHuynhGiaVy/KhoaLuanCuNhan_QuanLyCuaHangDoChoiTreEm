'use strict';

(() => {
  const rewardsApiBase = (window.location.protocol === 'file:' || (window.location.port && window.location.port !== '5225'))
    ? 'http://localhost:5225'
    : '';
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const money = value => `${Number(value || 0).toLocaleString('vi-VN')}đ`;
  const number = value => Number(value || 0).toLocaleString('vi-VN');

  function notify(message, type = 'success') {
    if (typeof showToast === 'function') {
      showToast(message, type);
      return;
    }

    const toast = document.getElementById('customerToast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `customer-toast ${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3200);
  }

  function getToken() {
    return localStorage.getItem('toyStoreToken');
  }

  function setHero(customerName = 'Khách hàng', points = 0) {
    const name = document.getElementById('rewardCustomerName');
    const pointNode = document.getElementById('rewardPointBalance');
    if (name) name.textContent = customerName;
    if (pointNode) pointNode.textContent = number(points);
  }

  function renderGuest(message = 'Đăng nhập để xem điểm tích lũy và đổi voucher dành riêng cho bạn.') {
    setHero('Khách hàng', 0);
    document.getElementById('rewardsContent').innerHTML = `
      <section class="rewards-guest">
        <h2>Đăng nhập để đổi quà</h2>
        <p>${escapeHtml(message)}</p>
        <button class="rewards-login-btn" id="rewardsLoginButton">Đăng nhập / Đăng ký</button>
      </section>`;
  }

  function tier(points) {
    if (points >= 1000) return '💎 Hạng Kim Cương';
    if (points >= 300) return '🥇 Hạng Vàng';
    if (points >= 100) return '🥈 Hạng Bạc';
    return '🥉 Hạng Đồng';
  }

  function voucherCard(voucher, points) {
    const cost = Number(voucher.requiredPoints || 0);
    const shortage = Math.max(0, cost - points);
    const progress = Math.min(100, cost ? Math.round((points / cost) * 100) : 100);
    const isRedeemed = voucher.isRedeemed === true;
    const isLocked = shortage > 0;
    const className = `${isRedeemed ? 'is-redeemed' : ''} ${isLocked ? 'is-locked' : ''}`.trim();
    const discount = voucher.discountType === 0
      ? `Giảm ${number(voucher.discountValue)}%`
      : `Giảm ${money(voucher.discountValue)}`;
    const minimum = Number(voucher.minimumOrderValue || 0) > 0
      ? `Áp dụng cho đơn từ ${money(voucher.minimumOrderValue)}`
      : 'Áp dụng cho mọi đơn hàng';
    const expiry = voucher.endDate ? new Date(voucher.endDate).toLocaleDateString('vi-VN') : 'Đang cập nhật';
    const buttonLabel = isRedeemed
      ? `✓ Đã đổi · ${escapeHtml(voucher.code)}`
      : isLocked
        ? `Cần thêm ${number(shortage)} điểm`
        : `Redeem ${number(cost)} điểm`;

    return `
      <article class="reward-voucher-card ${className}">
        <div class="reward-card-top">
          <span class="reward-discount">${discount}</span>
          <code class="reward-code">${escapeHtml(voucher.code)}</code>
        </div>
        <h3>${escapeHtml(voucher.name)}</h3>
        <p>${minimum}</p>
        <p>Hạn sử dụng: ${escapeHtml(expiry)}</p>
        <div class="reward-points-cost"><b>${number(cost)}</b> điểm để đổi</div>
        <div class="reward-progress" aria-label="Tiến độ điểm"><span style="width:${progress}%"></span></div>
        <button class="reward-redeem-btn" data-voucher-id="${voucher.voucherId}" ${isRedeemed || isLocked ? 'disabled' : ''}>${buttonLabel}</button>
      </article>`;
  }

  function historyItem(item) {
    const isSpent = Number(item.points) < 0;
    const points = Number(item.points);
    const createdAt = item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : '';
    return `
      <div class="reward-history-item ${isSpent ? 'is-spent' : ''}">
        <span class="reward-history-icon">${isSpent ? '🎁' : '✦'}</span>
        <div><p>${escapeHtml(item.description)}</p><small>${escapeHtml(createdAt)}</small></div>
        <strong class="reward-history-points">${points > 0 ? '+' : ''}${number(points)}</strong>
      </div>`;
  }

  function renderSummary(summary) {
    const points = Number(summary.loyaltyPoint || 0);
    setHero(summary.customerName || 'Khách hàng', points);
    const vouchers = summary.redeemableVouchers || [];
    const transactions = summary.transactions || [];

    document.getElementById('rewardsContent').innerHTML = `
      <section class="rewards-section" aria-labelledby="rewardVouchersHeading">
        <div class="rewards-section-heading">
          <div><p class="rewards-kicker" style="color:var(--primary);">ĐỔI ĐIỂM LẤY ƯU ĐÃI</p><h2 id="rewardVouchersHeading">Voucher dành cho bạn</h2></div>
          <p>Chọn voucher phù hợp với số điểm hiện có.</p>
        </div>
        <div class="reward-voucher-grid">
          ${vouchers.length ? vouchers.map(voucher => voucherCard(voucher, points)).join('') : '<div class="rewards-empty" style="grid-column:1/-1;">Hiện chưa có voucher đổi điểm đang hiệu lực. Vui lòng quay lại sau.</div>'}
        </div>
      </section>
      <section class="rewards-section rewards-bottom-grid">
        <article class="reward-panel"><h3>Lịch sử điểm thưởng</h3><div class="reward-history">${transactions.length ? transactions.map(historyItem).join('') : '<div class="rewards-empty">Bạn chưa có giao dịch điểm nào.</div>'}</div></article>
        <aside class="reward-panel"><h3>${tier(points)}</h3><div class="reward-rule-list">
          <div><span>1</span><p>Tích <b>1 điểm</b> cho mỗi 10.000đ giá trị đơn hàng.</p></div>
          <div><span>2</span><p>Đổi voucher ngay khi bạn có đủ số điểm yêu cầu.</p></div>
          <div><span>3</span><p>Voucher đã đổi sẽ được ghi nhận trong lịch sử điểm của bạn.</p></div>
        </div></aside>
      </section>`;
  }

  async function loadRewards() {
    const token = getToken();
    if (!token) {
      renderGuest();
      return;
    }

    try {
      const response = await fetch(`${rewardsApiBase}/api/LoyaltyTransaction/summary`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });

      if (response.status === 401 || response.status === 403) {
        renderGuest('Vui lòng đăng nhập bằng tài khoản khách hàng để sử dụng chương trình tích điểm.');
        return;
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Không thể tải thông tin điểm thưởng.');
      renderSummary(data);
    } catch (error) {
      document.getElementById('rewardsContent').innerHTML = `<section class="rewards-empty">${escapeHtml(error.message)}</section>`;
    }
  }

  document.addEventListener('click', async event => {
    if (event.target.closest('#rewardsLoginButton')) {
      document.getElementById('custAccountBtn')?.click();
      return;
    }

    const redeemButton = event.target.closest('[data-voucher-id]');
    if (!redeemButton || redeemButton.disabled) return;

    const token = getToken();
    if (!token) {
      renderGuest();
      return;
    }

    redeemButton.disabled = true;
    try {
      const response = await fetch(`${rewardsApiBase}/api/LoyaltyTransaction/redeem/${redeemButton.dataset.voucherId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Không thể đổi voucher.');

      notify(`Đổi thành công voucher ${data.code}. Đã dùng ${number(data.pointsSpent)} điểm.`, 'success');
      await loadRewards();
    } catch (error) {
      notify(error.message, 'error');
      redeemButton.disabled = false;
    }
  });

  loadRewards();
})();
