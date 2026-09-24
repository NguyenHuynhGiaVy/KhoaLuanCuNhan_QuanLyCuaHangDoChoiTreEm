const detailRoot = document.getElementById('productDetail');
const relatedRoot = document.getElementById('relatedProducts');
const reviewsRoot = document.getElementById('productReviews');
const detailId = new URLSearchParams(window.location.search).get('id');
const placeholderImage = 'https://placehold.co/800x800?text=ToyStore';
let detailProduct = null;
let detailVariants = [];
let selectedVariant = null;
let detailQuantity = 1;
let detailCartCount = Number(localStorage.getItem('toyStoreCartCount') || 0);
let productReviews = [];
let reviewEligibility = { state: 'anonymous', purchases: [] };
let selectedReviewRating = 5;

(function () {
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  const money = value => value == null ? 'Liên hệ' : `${Number(value).toLocaleString('vi-VN')}đ`;
  const imageOf = product => product?.imageUrl || placeholderImage;

  function updateCart() {
    document.getElementById('cartCount').textContent = detailCartCount;
    localStorage.setItem('toyStoreCartCount', detailCartCount);
  }

  function toast(message) {
    const node = document.getElementById('customerToast');
    node.textContent = message;
    node.classList.add('show');
    setTimeout(() => node.classList.remove('show'), 2400);
  }

  function detailAuthToken() {
    return localStorage.getItem('toyStoreToken');
  }

  function reviewStars(rating) {
    const value = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
    return Array.from({ length: 5 }, (_, index) => `<span class="${index < value ? 'is-filled' : ''}">★</span>`).join('');
  }

  function reviewDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Mới đây';
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function reviewComment(value) {
    return escapeHtml(value).replace(/\n/g, '<br>');
  }

  function getReviewStats() {
    const counts = [0, 0, 0, 0, 0, 0];
    productReviews.forEach(review => {
      const rating = Number(review.rating);
      if (rating >= 1 && rating <= 5) counts[rating] += 1;
    });
    const total = productReviews.length;
    const average = total
      ? productReviews.reduce((sum, review) => sum + (Number(review.rating) || 0), 0) / total
      : 0;
    return { counts, total, average };
  }

  function updateDetailReviewSummary() {
    const summary = document.getElementById('detailReviewSummary');
    const stars = document.getElementById('detailReviewStars');
    if (!summary || !stars) return;
    const stats = getReviewStats();
    summary.textContent = stats.total
      ? `${stats.average.toFixed(1)} · ${stats.total} đánh giá`
      : 'Chưa có đánh giá';
    stars.innerHTML = reviewStars(stats.average || 0);
  }

  function reviewComposerMarkup() {
    if (reviewEligibility.state === 'loading') {
      return '<div class="review-composer review-composer-message">Đang kiểm tra đơn hàng đã mua của bạn...</div>';
    }

    if (reviewEligibility.state === 'anonymous') {
      return '<div class="review-composer review-composer-message"><div><strong>Bạn đã dùng sản phẩm này?</strong><p>Đăng nhập để gửi nhận xét và đánh giá bằng số sao.</p></div><button type="button" class="review-outline-btn" id="reviewLoginButton">Đăng nhập để đánh giá</button></div>';
    }

    if (reviewEligibility.state === 'profile') {
      return '<div class="review-composer review-composer-message"><div><strong>Hoàn thiện hồ sơ khách hàng</strong><p>Hồ sơ giúp ToyStore xác minh đơn mua trước khi nhận đánh giá.</p></div><button type="button" class="review-outline-btn" id="reviewProfileButton">Cập nhật hồ sơ</button></div>';
    }

    if (reviewEligibility.state !== 'eligible' || !reviewEligibility.purchases.length) {
      return '<div class="review-composer review-composer-message"><div><strong>Đánh giá từ khách đã mua hàng</strong><p>Bạn có thể gửi nhận xét sau khi đơn hàng chứa sản phẩm này đã hoàn thành.</p></div></div>';
    }

    return `
      <form class="review-composer" id="productReviewForm">
        <div class="review-composer-heading"><div><strong>Viết nhận xét của bạn</strong><p>Chia sẻ trải nghiệm thật để giúp các phụ huynh khác lựa chọn.</p></div><span class="verified-purchase">✓ Đã mua hàng</span></div>
        <div class="review-form-grid">
          <label class="review-field"><span>Đơn hàng đã hoàn thành</span><select id="reviewPurchaseSelection">${reviewEligibility.purchases.map(purchase => `<option value="${purchase.orderId}:${purchase.variantId}">${escapeHtml(purchase.label)}</option>`).join('')}</select></label>
          <div class="review-field"><span>Đánh giá của bạn</span><div class="review-star-picker" aria-label="Chọn số sao">${[1, 2, 3, 4, 5].map(rating => `<button type="button" class="review-rating-choice ${rating <= selectedReviewRating ? 'is-selected' : ''}" data-review-rating="${rating}" aria-label="${rating} sao">★</button>`).join('')}<b id="reviewRatingText">${selectedReviewRating}/5 sao</b></div></div>
        </div>
        <label class="review-field review-comment-field"><span>Nhận xét của bạn</span><textarea id="reviewComment" rows="4" maxlength="2000" required placeholder="Sản phẩm có phù hợp với bé không? Chất lượng, màu sắc, đóng gói thế nào?"></textarea></label>
        <div class="review-submit-row"><small>Đánh giá sẽ hiển thị kèm ngày bạn gửi.</small><button class="review-submit-btn" type="submit">Gửi đánh giá</button></div>
      </form>`;
  }

  function renderReviews() {
    if (!reviewsRoot) return;
    const stats = getReviewStats();
    const ratingRows = [5, 4, 3, 2, 1].map(rating => {
      const count = stats.counts[rating];
      const width = stats.total ? Math.round((count / stats.total) * 100) : 0;
      return `<div class="rating-distribution-row"><span>${rating} <i>★</i></span><div class="rating-bar"><b style="width:${width}%"></b></div><strong>${count}</strong></div>`;
    }).join('');
    const reviewList = stats.total
      ? productReviews.map(review => `<article class="customer-review-card"><div class="review-avatar">${escapeHtml((review.customerName || 'K').trim().charAt(0).toUpperCase())}</div><div class="customer-review-copy"><div class="customer-review-head"><div><strong>${escapeHtml(review.customerName || 'Khách hàng ToyStore')}</strong><div class="review-stars" aria-label="${Number(review.rating) || 0} trên 5 sao">${reviewStars(review.rating)}</div></div><time datetime="${escapeHtml(review.createdAt || '')}">${reviewDate(review.createdAt)}</time></div><p>${reviewComment(review.comment || '')}</p></div></article>`).join('')
      : '<div class="reviews-empty"><span>☆</span><div><strong>Chưa có nhận xét nào</strong><p>Hãy là người đầu tiên chia sẻ trải nghiệm về sản phẩm này.</p></div></div>';

    reviewsRoot.innerHTML = `
      <div class="product-reviews-heading"><div><span>TRẢI NGHIỆM THỰC TẾ</span><h2 id="productReviewsTitle">Đánh giá từ khách hàng</h2><p>Những nhận xét từ khách đã hoàn tất đơn hàng tại ToyStore.</p></div><div class="reviews-total"><b>${stats.total}</b><span>đánh giá</span></div></div>
      <div class="reviews-overview"><div class="reviews-average"><strong>${stats.total ? stats.average.toFixed(1) : '—'}</strong><div class="review-stars review-stars-large">${reviewStars(stats.average)}</div><span>${stats.total ? `Dựa trên ${stats.total} đánh giá` : 'Chưa có đánh giá'}</span></div><div class="rating-distribution">${ratingRows}</div></div>
      ${reviewComposerMarkup()}
      <div class="customer-review-list">${reviewList}</div>`;

    updateDetailReviewSummary();
  }

  async function loadReviews() {
    if (!detailId) return;
    try {
      const response = await fetch(`/api/ProductReview/by-product/${detailId}`);
      if (!response.ok) throw new Error('Không thể tải đánh giá.');
      productReviews = await response.json();
    } catch (error) {
      productReviews = [];
    }
    renderReviews();
  }

  async function loadReviewEligibility() {
    const token = detailAuthToken();
    if (!token || !detailProduct) {
      reviewEligibility = { state: 'anonymous', purchases: [] };
      renderReviews();
      return;
    }

    reviewEligibility = { state: 'loading', purchases: [] };
    renderReviews();
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const profileResponse = await fetch('/api/Customer/profile', { headers });
      if (profileResponse.status === 404) {
        reviewEligibility = { state: 'profile', purchases: [] };
        renderReviews();
        return;
      }
      if (!profileResponse.ok) throw new Error('Không thể tải hồ sơ khách hàng.');

      const profile = await profileResponse.json();
      const [ordersResponse, ownReviewsResponse] = await Promise.all([
        fetch(`/api/Order/customer/${profile.customerId}`, { headers }),
        fetch(`/api/ProductReview/by-customer/${profile.customerId}`, { headers })
      ]);
      if (!ordersResponse.ok) throw new Error('Không thể kiểm tra đơn hàng.');

      const orders = await ordersResponse.json();
      const ownReviews = ownReviewsResponse.ok ? await ownReviewsResponse.json() : [];
      const reviewedKeys = new Set((ownReviews || [])
        .filter(review => Number(review.productId) === Number(detailProduct.productId))
        .map(review => `${review.orderId}:${review.variantId}`));
      const variantsById = new Map(detailVariants.map(variant => [Number(variant.variantId), variant]));
      const purchases = (orders || [])
        .filter(order => Number(order.status) === 4)
        .flatMap(order => (order.orderDetails || []).map(detail => ({ order, detail })))
        .filter(({ detail }) => variantsById.has(Number(detail.variantId)))
        .filter(({ order, detail }) => !reviewedKeys.has(`${order.orderId}:${detail.variantId}`))
        .map(({ order, detail }) => {
          const variant = variantsById.get(Number(detail.variantId));
          return {
            orderId: Number(order.orderId),
            variantId: Number(detail.variantId),
            label: `${variantLabel(variant)} · Đơn #${order.orderCode || order.orderId}`
          };
        });

      reviewEligibility = { state: purchases.length ? 'eligible' : 'ineligible', purchases };
    } catch (error) {
      reviewEligibility = { state: 'ineligible', purchases: [] };
    }
    renderReviews();
  }

  function variantAttributes(variant) {
    return (variant?.attributes || []).filter(attribute => attribute.attributeName && attribute.attributeValue);
  }

  function variantLabel(variant) {
    const attributes = variantAttributes(variant);
    return attributes.length ? attributes.map(attribute => `${attribute.attributeName}: ${attribute.attributeValue}`).join(' · ') : `SKU ${variant?.sku || ''}`;
  }

  function stockState(variant) {
    const rawQuantity = variant?.availableQuantity;
    if (rawQuantity === null || rawQuantity === undefined || rawQuantity === '') {
      return { type: 'pending', quantity: 0, canPurchase: false, label: 'Hàng chưa về' };
    }

    const quantity = Number(rawQuantity);
    if (!Number.isFinite(quantity)) {
      return { type: 'pending', quantity: 0, canPurchase: false, label: 'Hàng chưa về' };
    }

    if (quantity <= 0) {
      return { type: 'out', quantity: 0, canPurchase: false, label: 'Tạm hết hàng' };
    }

    if (Number(variant?.price || 0) <= 0) {
      return { type: 'pending', quantity, canPurchase: false, label: 'Chưa cập nhật giá bán' };
    }

    return {
      type: quantity >= 10 ? 'available' : 'low',
      quantity,
      canPurchase: true,
      label: `Còn ${quantity} sản phẩm`
    };
  }

  function stockStatusMarkup() {
    const stock = stockState(selectedVariant);
    return `<div class="stock-status stock-status--${stock.type}" id="detailStockStatus" role="status"><span aria-hidden="true"></span><strong>${escapeHtml(stock.label)}</strong></div>`;
  }

  function updateStockAndPurchaseControls() {
    const stock = stockState(selectedVariant);
    detailQuantity = stock.canPurchase ? Math.min(Math.max(1, detailQuantity), stock.quantity) : 1;

    const status = document.getElementById('detailStockStatus');
    if (status) {
      status.className = `stock-status stock-status--${stock.type}`;
      status.innerHTML = `<span aria-hidden="true"></span><strong>${escapeHtml(stock.label)}</strong>`;
    }

    const quantityNode = document.getElementById('detailQuantity');
    if (quantityNode) quantityNode.textContent = detailQuantity;

    const minus = document.getElementById('detailQuantityMinus');
    const plus = document.getElementById('detailQuantityPlus');
    if (minus) minus.disabled = !stock.canPurchase || detailQuantity <= 1;
    if (plus) plus.disabled = !stock.canPurchase || detailQuantity >= stock.quantity;

    ['addDetailCart', 'buyNow'].forEach(id => {
      const button = document.getElementById(id);
      if (!button) return;
      button.disabled = !stock.canPurchase;
      const label = button.querySelector('.purchase-action-label');
      if (label) {
        label.textContent = stock.canPurchase
          ? (id === 'buyNow' ? 'Mua ngay' : 'Thêm vào giỏ hàng')
          : stock.label;
      }
    });

    const metaTitle = document.getElementById('detailStockMetaTitle');
    const metaHint = document.getElementById('detailStockMetaHint');
    if (metaTitle) metaTitle.textContent = stock.canPurchase ? 'Kho hàng ToyStore' : stock.label;
    if (metaHint) metaHint.textContent = stock.canPurchase
      ? `Có thể đặt tối đa ${stock.quantity} sản phẩm.`
      : (stock.type === 'pending'
        ? (stock.label === 'Chưa cập nhật giá bán'
          ? 'Sản phẩm đang chờ cập nhật giá bán.'
          : 'Sản phẩm chưa có thông tin nhập kho.')
        : 'Vui lòng chọn sản phẩm khác hoặc quay lại sau.');
  }

  function renderDetail() {
    const product = detailProduct;
    detailVariants = product.productVariants || [];
    selectedVariant = detailVariants.find(variant => stockState(variant).canPurchase) || detailVariants[0] || null;
    detailQuantity = 1;
    document.title = `${product.name} - ToyStore`;
    document.getElementById('detailCategory').textContent = product.categoryName || 'Đồ chơi';
    document.getElementById('detailBreadcrumbName').textContent = product.name;

    const images = [imageOf(product), ...detailVariants.map(variant => variant.imageUrl).filter(Boolean)].filter((image, index, all) => all.indexOf(image) === index);
    const stock = stockState(selectedVariant);
    detailRoot.innerHTML = `
      <div class="detail-gallery">
        <div class="gallery-main"><span class="detail-badge">${product.isNew ? 'MỚI VỀ' : 'ĐỒ CHƠI ĐƯỢC YÊU THÍCH'}</span><img id="mainProductImage" src="${escapeHtml(images[0])}" alt="${escapeHtml(product.name)}"></div>
        <div class="gallery-thumbs">${images.map((image, index) => `<button class="gallery-thumb ${index === 0 ? 'active' : ''}" data-image="${escapeHtml(image)}"><img src="${escapeHtml(image)}" alt=""></button>`).join('')}</div>
        <div class="gallery-commitments" aria-label="Cam kết ToyStore">
          <p><span>✓</span>Sản phẩm đúng mô tả, an toàn cho bé</p>
          <p><span>✓</span>Đổi trả miễn phí nếu phát hiện lỗi</p>
          <p><span>✓</span>Đóng gói cẩn thận, giao hàng toàn quốc</p>
        </div>
      </div>
      <div class="detail-copy">
        <span class="detail-kicker">${escapeHtml(product.categoryName || 'ĐỒ CHƠI TRẺ EM')}</span>
        <h1>${escapeHtml(product.name)}</h1>
        <div class="detail-rating"><span class="detail-review-stars" id="detailReviewStars">${reviewStars(getReviewStats().average)}</span><button type="button" class="detail-review-link" id="detailReviewLink"><u id="detailReviewSummary">Chưa có đánh giá</u></button><i>SKU: ${escapeHtml(selectedVariant?.sku || 'Đang cập nhật')}</i></div>
        <div class="detail-price">${money(selectedVariant?.price ?? product.basePrice)}</div>
        ${stockStatusMarkup()}
        <p class="detail-description">${escapeHtml(product.description || 'Một món đồ chơi thú vị cho những giờ chơi đầy sáng tạo và khám phá.')}</p>
        ${renderVariantChoices()}
        <div class="buy-row">
          <div class="quantity-control">
            <button type="button" id="detailQuantityMinus" data-quantity="minus" aria-label="Giảm số lượng" ${stock.canPurchase ? '' : 'disabled'}>−</button>
            <strong id="detailQuantity">1</strong>
            <button type="button" id="detailQuantityPlus" data-quantity="plus" aria-label="Tăng số lượng" ${stock.canPurchase && stock.quantity > 1 ? '' : 'disabled'}>+</button>
          </div>
          <button type="button" class="buy-button" id="addDetailCart" ${stock.canPurchase ? '' : 'disabled'}><span class="purchase-action-label">${stock.canPurchase ? 'Thêm vào giỏ hàng' : stock.label}</span> <span>→</span></button>
        </div>
        <button type="button" class="buy-now-button" id="buyNow" ${stock.canPurchase ? '' : 'disabled'}><span class="purchase-action-label">${stock.canPurchase ? 'Mua ngay' : stock.label}</span></button>
        <div class="detail-meta">
          <div><span>✓</span><p><strong id="detailStockMetaTitle">${stock.canPurchase ? 'Kho hàng ToyStore' : stock.label}</strong><small id="detailStockMetaHint">${stock.canPurchase ? `Có thể đặt tối đa ${stock.quantity} sản phẩm.` : (stock.label === 'Chưa cập nhật giá bán' ? 'Sản phẩm đang chờ cập nhật giá bán.' : (stock.type === 'pending' ? 'Sản phẩm chưa có thông tin nhập kho.' : 'Vui lòng chọn sản phẩm khác hoặc quay lại sau.'))}</small></p></div>
          <div><span>♧</span><p><strong>Đóng gói cẩn thận</strong><small>Kiểm tra trước khi nhận</small></p></div>
        </div>
      </div>`;
    updateStockAndPurchaseControls();
  }

  function renderVariantChoices() {
    if (!detailVariants.length) return '';
    const groups = new Map();
    detailVariants.forEach(variant => variantAttributes(variant).forEach(attribute => {
      if (!groups.has(attribute.attributeName)) groups.set(attribute.attributeName, new Set());
      groups.get(attribute.attributeName).add(attribute.attributeValue);
    }));
    return `<div class="variant-choices">${[...groups.entries()].map(([name, values]) => `<div class="variant-group"><strong>${escapeHtml(name)}</strong><div>${[...values].map(value => `<button type="button" class="variant-choice" data-attribute-name="${escapeHtml(name)}" data-attribute-value="${escapeHtml(value)}">${escapeHtml(value)}</button>`).join('')}</div></div>`).join('')}</div>`;
  }

  function updateVariantView() {
    const image = document.getElementById('mainProductImage');
    if (!selectedVariant) return;
    document.querySelector('.detail-price').textContent = money(selectedVariant.price);
    document.querySelector('.detail-rating i').textContent = `SKU: ${selectedVariant.sku || 'Đang cập nhật'}`;
    if (selectedVariant.imageUrl) image.src = selectedVariant.imageUrl;
    document.querySelectorAll('.variant-choice').forEach(button => {
      button.classList.toggle('selected', variantAttributes(selectedVariant).some(attribute => attribute.attributeName === button.dataset.attributeName && attribute.attributeValue === button.dataset.attributeValue));
    });
    updateStockAndPurchaseControls();
  }

  function selectVariantByChoice(button) {
    const name = button.dataset.attributeName;
    const value = button.dataset.attributeValue;
    const compatible = detailVariants.filter(variant => variantAttributes(variant).some(attribute => attribute.attributeName === name && attribute.attributeValue === value));
    if (compatible.length) {
      selectedVariant = compatible.find(variant => stockState(variant).canPurchase) || compatible[0];
      detailQuantity = 1;
      updateVariantView();
    }
  }

  function renderRelated(products) {
    const related = products.filter(product => product.productId !== detailProduct.productId && product.categoryId === detailProduct.categoryId).slice(0, 4);
    relatedRoot.innerHTML = related.length ? related.map(product => `<a class="related-card" href="/product-detail.html?id=${product.productId}"><div class="related-card-image"><img src="${escapeHtml(imageOf(product))}" alt="${escapeHtml(product.name)}"></div><div class="related-card-body"><small>${escapeHtml(product.categoryName || 'Đồ chơi')}</small><h3>${escapeHtml(product.name)}</h3><div class="related-card-price"><b>${money(product.basePrice)}</b><span>→</span></div></div></a>`).join('') : '<p class="muted">Chưa có sản phẩm liên quan.</p>';
  }

  async function loadDetail() {
    if (!detailId) {
      detailRoot.innerHTML = '<div class="detail-empty"><h1>Không tìm thấy sản phẩm</h1><a href="/products.html">Quay lại danh sách</a></div>';
      return;
    }
    try {
      const [productResponse, productsResponse] = await Promise.all([fetch(`/api/Product/${detailId}`), fetch('/api/Product')]);
      if (!productResponse.ok) throw new Error('Không tìm thấy sản phẩm');
      detailProduct = await productResponse.json();
      if (Number(detailProduct.status) === 0) {
        detailRoot.innerHTML = '<div class="detail-empty"><h1>Sản phẩm hiện tạm ngưng kinh doanh</h1><a href="/products.html">Quay lại danh sách</a></div>';
        return;
      }
      renderDetail();
      renderReviews();
      void loadReviews();
      void loadReviewEligibility();
      if (typeof window.recordProductView === 'function') window.recordProductView(detailProduct);
      renderRelated(await productsResponse.json());
      document.getElementById('customerApiStatus').textContent = 'API đang kết nối';
      document.getElementById('customerApiStatus').classList.add('online');
    } catch (error) {
      detailRoot.innerHTML = `<div class="detail-empty"><h1>Không thể tải sản phẩm</h1><p>${escapeHtml(error.message)}</p><a href="/products.html">Quay lại danh sách</a></div>`;
    }
  }

  document.addEventListener('click', event => {
    const reviewRating = event.target.closest('[data-review-rating]');
    if (reviewRating) {
      selectedReviewRating = Number(reviewRating.dataset.reviewRating) || 5;
      document.querySelectorAll('.review-rating-choice').forEach(button => {
        button.classList.toggle('is-selected', Number(button.dataset.reviewRating) <= selectedReviewRating);
      });
      const text = document.getElementById('reviewRatingText');
      if (text) text.textContent = `${selectedReviewRating}/5 sao`;
    }
    if (event.target.closest('#reviewLoginButton, #reviewProfileButton')) {
      document.getElementById('custAccountBtn')?.click();
    }
    if (event.target.closest('#detailReviewLink')) {
      reviewsRoot?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    const thumb = event.target.closest('.gallery-thumb');
    if (thumb) {
      document.getElementById('mainProductImage').src = thumb.dataset.image;
      document.querySelectorAll('.gallery-thumb').forEach(node => node.classList.remove('active'));
      thumb.classList.add('active');
    }
    const choice = event.target.closest('.variant-choice');
    if (choice) selectVariantByChoice(choice);
    const quantity = event.target.closest('[data-quantity]');
    if (quantity) {
      const stock = stockState(selectedVariant);
      if (!stock.canPurchase) {
        toast(stock.label);
        return;
      }
      if (quantity.dataset.quantity === 'plus' && detailQuantity >= stock.quantity) {
        updateStockAndPurchaseControls();
        toast(`Bạn chỉ có thể chọn tối đa ${stock.quantity} sản phẩm.`);
        return;
      }
      detailQuantity = Math.max(1, detailQuantity + (quantity.dataset.quantity === 'plus' ? 1 : -1));
      updateStockAndPurchaseControls();
    }
    if (event.target.closest('#addDetailCart, #buyNow')) {
      if (detailProduct) {
        const stock = stockState(selectedVariant);
        if (!stock.canPurchase) {
          toast(stock.label);
          return;
        }
        const isBuyNow = !!event.target.closest('#buyNow');
        if (typeof addToCart === 'function') {
          addToCart({
            productId: detailProduct.productId,
            variantId: selectedVariant?.variantId || detailProduct.productId,
            name: detailProduct.name,
            price: selectedVariant?.price ?? detailProduct.basePrice,
            imageUrl: selectedVariant?.imageUrl || imageOf(detailProduct),
            quantity: detailQuantity,
            sku: selectedVariant?.sku || '',
            stockQuantity: stock.quantity
          });
          if (isBuyNow && typeof openCheckoutModal === 'function') {
            openCheckoutModal();
          }
        }
      }
    }
  });

  document.addEventListener('submit', async event => {
    const form = event.target.closest('#productReviewForm');
    if (!form) return;
    event.preventDefault();

    const selection = document.getElementById('reviewPurchaseSelection')?.value || '';
    const purchase = reviewEligibility.purchases.find(item => `${item.orderId}:${item.variantId}` === selection);
    const comment = document.getElementById('reviewComment')?.value.trim() || '';
    if (!purchase || !comment) {
      toast('Vui lòng chọn đơn hàng và nhập nhận xét.');
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Đang gửi...';
    }
    try {
      const response = await fetch('/api/ProductReview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${detailAuthToken()}`
        },
        body: JSON.stringify({
          productId: Number(detailProduct.productId),
          variantId: purchase.variantId,
          orderId: purchase.orderId,
          customerId: 0,
          rating: selectedReviewRating,
          comment
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data === 'string' ? data : (data.message || 'Không thể gửi đánh giá.'));

      selectedReviewRating = 5;
      toast('Cảm ơn bạn! Đánh giá đã được đăng.');
      await loadReviews();
      await loadReviewEligibility();
    } catch (error) {
      toast(error.message || 'Không thể gửi đánh giá.');
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Gửi đánh giá';
      }
    }
  });

  loadDetail();
})();
