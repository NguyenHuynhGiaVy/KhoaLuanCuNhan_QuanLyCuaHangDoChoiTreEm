const detailRoot = document.getElementById('productDetail');
const relatedRoot = document.getElementById('relatedProducts');
const detailId = new URLSearchParams(window.location.search).get('id');
const placeholderImage = 'https://placehold.co/800x800?text=ToyStore';
let detailProduct = null;
let detailVariants = [];
let selectedVariant = null;
let detailQuantity = 1;
let detailCartCount = Number(localStorage.getItem('toyStoreCartCount') || 0);

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

function variantAttributes(variant) {
  return (variant?.attributes || []).filter(attribute => attribute.attributeName && attribute.attributeValue);
}

function variantLabel(variant) {
  const attributes = variantAttributes(variant);
  return attributes.length ? attributes.map(attribute => `${attribute.attributeName}: ${attribute.attributeValue}`).join(' · ') : `SKU ${variant?.sku || ''}`;
}

function renderDetail() {
  const product = detailProduct;
  detailVariants = product.productVariants || [];
  selectedVariant = detailVariants[0] || null;
  document.title = `${product.name} - ToyStore`;
  document.getElementById('detailCategory').textContent = product.categoryName || 'Đồ chơi';
  document.getElementById('detailBreadcrumbName').textContent = product.name;

  const images = [imageOf(product), ...detailVariants.map(variant => variant.imageUrl).filter(Boolean)].filter((image, index, all) => all.indexOf(image) === index);
  detailRoot.innerHTML = `<div class="detail-gallery"><div class="gallery-main"><span class="detail-badge">${product.isNew ? 'MỚI VỀ' : 'ĐỒ CHƠI ĐƯỢC YÊU THÍCH'}</span><img id="mainProductImage" src="${escapeHtml(images[0])}" alt="${escapeHtml(product.name)}"></div><div class="gallery-thumbs">${images.map((image, index) => `<button class="gallery-thumb ${index === 0 ? 'active' : ''}" data-image="${escapeHtml(image)}"><img src="${escapeHtml(image)}" alt=""></button>`).join('')}</div></div><div class="detail-copy"><span class="detail-kicker">${escapeHtml(product.categoryName || 'ĐỒ CHƠI TRẺ EM')}</span><h1>${escapeHtml(product.name)}</h1><div class="detail-rating"><span>★★★★★</span><u>Đánh giá sản phẩm</u><i>SKU: ${escapeHtml(selectedVariant?.sku || 'Đang cập nhật')}</i></div><div class="detail-price">${money(selectedVariant?.price ?? product.basePrice)}</div><p class="detail-description">${escapeHtml(product.description || 'Một món đồ chơi thú vị cho những giờ chơi đầy sáng tạo và khám phá.')}</p>${renderVariantChoices()}<div class="buy-row"><div class="quantity-control"><button type="button" data-quantity="minus" aria-label="Giảm số lượng">−</button><strong id="detailQuantity">1</strong><button type="button" data-quantity="plus" aria-label="Tăng số lượng">+</button></div><button type="button" class="buy-button" id="addDetailCart">Thêm vào giỏ hàng <span>→</span></button></div><button type="button" class="buy-now-button" id="buyNow">Mua ngay</button><div class="detail-meta"><div><span>✓</span><p><strong>Còn hàng</strong><small>Giao hàng từ ToyStore</small></p></div><div><span>♧</span><p><strong>Đóng gói cẩn thận</strong><small>Kiểm tra trước khi nhận</small></p></div></div></div>`;
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
}

function selectVariantByChoice(button) {
  const name = button.dataset.attributeName;
  const value = button.dataset.attributeValue;
  const compatible = detailVariants.filter(variant => variantAttributes(variant).some(attribute => attribute.attributeName === name && attribute.attributeValue === value));
  if (compatible.length) {
    selectedVariant = compatible[0];
    updateVariantView();
  }
}

function renderRelated(products) {
  const related = products.filter(product => product.productId !== detailProduct.productId && product.categoryId === detailProduct.categoryId).slice(0, 4);
  relatedRoot.innerHTML = related.length ? related.map(product => `<a class="related-card" href="/product-detail.html?id=${product.productId}"><div><img src="${escapeHtml(imageOf(product))}" alt="${escapeHtml(product.name)}"></div><small>${escapeHtml(product.categoryName || 'Đồ chơi')}</small><h3>${escapeHtml(product.name)}</h3><b>${money(product.basePrice)}</b></a>`).join('') : '<p class="muted">Chưa có sản phẩm liên quan.</p>';
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
    renderDetail();
    renderRelated(await productsResponse.json());
    document.getElementById('customerApiStatus').textContent = 'API đang kết nối';
    document.getElementById('customerApiStatus').classList.add('online');
  } catch (error) {
    detailRoot.innerHTML = `<div class="detail-empty"><h1>Không thể tải sản phẩm</h1><p>${escapeHtml(error.message)}</p><a href="/products.html">Quay lại danh sách</a></div>`;
  }
}

document.addEventListener('click', event => {
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
    detailQuantity = Math.max(1, detailQuantity + (quantity.dataset.quantity === 'plus' ? 1 : -1));
    document.getElementById('detailQuantity').textContent = detailQuantity;
  }
  if (event.target.closest('#addDetailCart, #buyNow')) {
    if (detailProduct) {
      const isBuyNow = !!event.target.closest('#buyNow');
      if (typeof addToCart === 'function') {
        addToCart({
          productId: detailProduct.productId,
          variantId: selectedVariant?.variantId || detailProduct.productId,
          name: detailProduct.name,
          price: selectedVariant?.price ?? detailProduct.basePrice,
          imageUrl: selectedVariant?.imageUrl || imageOf(detailProduct),
          quantity: detailQuantity,
          sku: selectedVariant?.sku || ''
        });
        if (isBuyNow && typeof openCheckoutModal === 'function') {
          openCheckoutModal();
        }
      }
    }
  }
});

loadDetail();
