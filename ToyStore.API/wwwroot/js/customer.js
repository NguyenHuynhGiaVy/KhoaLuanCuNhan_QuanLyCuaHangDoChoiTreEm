const grid = document.getElementById('productGrid');
const searchInput = document.getElementById('productSearch');
const sortSelect = document.getElementById('productSort');
const resultCount = document.getElementById('resultCount');
let products = [];
let categories = [];
let activeFilter = 'all';
let currentPage = 1;
const pageSize = 16;
let cartCount = Number(localStorage.getItem('toyStoreCartCount') || 0);

const escapeHtml = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const money = v => v == null ? 'Liên hệ' : `${Number(v).toLocaleString('vi-VN')}đ`;

function showToast(m) {
    const t = document.getElementById('customerToast');
    if (!t) return;
    t.textContent = m; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2400);
}

function updateCart() {
    const c = document.getElementById('cartCount');
    if (c) c.textContent = cartCount;
    localStorage.setItem('toyStoreCartCount', cartCount);
}

function updateApiStatus(online, message = '') {
    const status = document.getElementById('customerApiStatus');
    if (!status) return;
    status.textContent = online ? 'API đang kết nối' : 'API không kết nối';
    status.className = `customer-api-status ${online ? 'online' : 'offline'}`;
    if (message) status.title = message;
}

async function checkApi() {
    try {
        const response = await fetch('/api/Health', { cache: 'no-store' });
        updateApiStatus(response.ok);
        return response.ok;
    } catch {
        updateApiStatus(false, 'Không thể kết nối tới ToyStore API');
        return false;
    }
}

async function loadData() {
    try {
        const [resP, resC] = await Promise.all([fetch('/api/Product'), fetch('/api/Category')]);
        if (!resP.ok || !resC.ok) throw new Error(`API phản hồi lỗi (${resP.status}/${resC.status})`);

        const newProducts = await resP.json();
        const newCategories = await resC.json();

        // Chỉ re-render nếu có sự thay đổi dữ liệu để tránh giật trang
        if (JSON.stringify(products) !== JSON.stringify(newProducts) || JSON.stringify(categories) !== JSON.stringify(newCategories)) {
            products = newProducts;
            categories = newCategories;
            renderCategories();
            renderHomeCategories();
            renderProducts();
            renderHomeProducts();
        }
        updateApiStatus(true);
    } catch (e) {
        updateApiStatus(false, e.message);
        if (grid) grid.innerHTML = '<div class="empty-state">Không thể tải sản phẩm. Vui lòng thử lại.</div>';
        console.error('Lỗi tải dữ liệu:', e);
    }
}

function renderCategories() {
    const list = document.getElementById('categoryList');
    if (!list) return;
    list.innerHTML = `<button class="category-filter ${activeFilter==='all'?'active':''}" data-filter="all">Tất cả sản phẩm <span>(${products.length})</span></button>` +
        categories.map(c => {
            const count = products.filter(p => String(p.categoryId) === String(c.id)).length;
            return `<button class="category-filter ${activeFilter==String(c.id)?'active':''}" data-filter="${c.id}">${escapeHtml(c.name)} <span>(${count})</span></button>`;
        }).join('');
}

function renderHomeCategories() {
    const list = document.getElementById('homeCategoryList');
    if (!list) return;
    const icons = ['◈', '♢', '✦', '♡'];
    list.innerHTML = categories.length
        ? categories.slice(0, 4).map((category, index) => `<div><span class="category-icon ${index % 2 ? 'coral' : ''}">${icons[index]}</span><b>${escapeHtml(category.name)}</b><small>${products.filter(p => String(p.categoryId) === String(category.id)).length} sản phẩm</small></div>`).join('')
        : '<div><b>Chưa có danh mục</b><small>Danh mục sẽ được cập nhật sớm</small></div>';
}

function productCard(p) {
    return `<article class="product-card"><a class="product-link" href="/product-detail.html?id=${p.productId}" aria-label="Xem chi tiết ${escapeHtml(p.name)}"><div class="product-img"><img src="${escapeHtml(p.imageUrl || 'https://placehold.co/400x400?text=ToyStore')}" alt="${escapeHtml(p.name)}" loading="lazy"></div><div class="product-detail"><small>${escapeHtml(p.categoryName || 'Đồ chơi')}</small><h3>${escapeHtml(p.name)}</h3><div class="product-price"><b>${money(p.basePrice)}</b></div></div></a><button class="add-cart" data-id="${p.productId}">Thêm vào giỏ</button></article>`;
}

function renderHomeProducts() {
    const homeGrid = document.getElementById('homeProductGrid');
    if (!homeGrid) return;
    homeGrid.innerHTML = products.length ? products.slice(0, 8).map(productCard).join('') : '<div class="empty-state">Chưa có sản phẩm.</div>';
}

function renderProducts() {
    if (!grid) return;
    const query = searchInput?.value.toLowerCase() || '';
    let filtered = products.filter(p => {
        const matchSearch = p.name.toLowerCase().includes(query) || (p.categoryName||'').toLowerCase().includes(query);
        const matchCat = activeFilter === 'all' || String(p.categoryId) === activeFilter;
        return matchSearch && matchCat;
    });

    if (sortSelect?.value === 'priceAsc') filtered.sort((a,b) => a.basePrice - b.basePrice);
    else if (sortSelect?.value === 'priceDesc') filtered.sort((a,b) => b.basePrice - a.basePrice);
    else if (sortSelect?.value === 'name') filtered.sort((a,b) => a.name.localeCompare(b.name));

    if (resultCount) resultCount.textContent = `${filtered.length} Sản phẩm`;

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    currentPage = Math.min(currentPage, totalPages);
    const start = (currentPage - 1) * pageSize;
    const pageProducts = filtered.slice(start, start + pageSize);
    grid.innerHTML = pageProducts.map(productCard).join('') || '<div class="empty-state">Không tìm thấy sản phẩm phù hợp.</div>';
    renderPagination(totalPages);
}

function renderPagination(totalPages) {
    const pagination = document.getElementById('productPagination');
    if (!pagination) return;
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        pagination.hidden = true;
        return;
    }
    pagination.hidden = false;
    let buttons = `<button type="button" class="page-button" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''} aria-label="Trang trước">←</button>`;
    for (let page = 1; page <= totalPages; page++) {
        buttons += `<button type="button" class="page-button ${page === currentPage ? 'active' : ''}" data-page="${page}">${page}</button>`;
    }
    buttons += `<button type="button" class="page-button" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''} aria-label="Trang sau">→</button>`;
    pagination.innerHTML = buttons;
}

// Lắng nghe sự kiện click vào danh mục
document.addEventListener('click', e => {
    const btn = e.target.closest('.category-filter');
    if (btn) {
        document.querySelectorAll('.category-filter').forEach(i => i.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.dataset.filter;
        currentPage = 1;
        renderProducts();
    }

    const pageButton = e.target.closest('[data-page]');
    if (pageButton && !pageButton.disabled) {
        currentPage = Number(pageButton.dataset.page);
        renderProducts();
        document.getElementById('products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (e.target.closest('.add-cart')) {
        cartCount++; updateCart();
        showToast("Đã thêm vào giỏ hàng!");
    }
});

searchInput?.addEventListener('input', () => { currentPage = 1; renderProducts(); });
sortSelect?.addEventListener('change', () => { currentPage = 1; renderProducts(); });

// Khởi chạy và thiết lập Real-time (30 giây cập nhật 1 lần)
updateCart();
checkApi();
loadData();
setInterval(() => { checkApi(); loadData(); }, 30000);
