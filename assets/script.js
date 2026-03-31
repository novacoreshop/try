const STORAGE_KEYS = {
  cart: 'novacore-cart',
  adminSession: 'novacore-admin-session',
  adminToken: 'novacore-admin-token'
};

const API_BASE = '/api';
const ADMIN_PASSWORD = 'novacore2025';
const PAGE_ROUTES = {
  home: '/',
  shop: '/shop',
  about: '/about',
  contact: '/contact',
  tracking: '/tracking',
  custom: '/custom',
  shipping: '/shipping',
  'size-guide': '/size-guide',
  privacy: '/privacy',
  terms: '/terms',
  cookies: '/cookies',
  'admin-login': '/admin-login',
  admin: '/admin',
  product: '/product'
};
const PAGE_TITLES = {
  home: 'NOVA CORE — Premium Streetwear',
  shop: 'Shop — NOVA CORE',
  about: 'About — NOVA CORE',
  contact: 'Contact — NOVA CORE',
  tracking: 'Track Order — NOVA CORE',
  custom: 'Custom Orders — NOVA CORE',
  shipping: 'Shipping & Returns — NOVA CORE',
  'size-guide': 'Size Guide — NOVA CORE',
  privacy: 'Privacy Policy — NOVA CORE',
  terms: 'Terms of Service — NOVA CORE',
  cookies: 'Cookie Policy — NOVA CORE',
  'admin-login': 'Admin Login — NOVA CORE',
  admin: 'Admin Dashboard — NOVA CORE',
  product: 'Product Details — NOVA CORE'
};
const ROUTE_PAGES = Object.fromEntries(Object.entries(PAGE_ROUTES).map(([page, route]) => [route, page]));
const COLOR_NAMES = {
  '#1a1a1a': 'Phantom Black',
  '#3a3836': 'Warm Charcoal',
  '#c8bfb0': 'Sand Beige',
  '#2c2420': 'Mocha',
  '#f0ede8': 'Off White'
};
const defaultProducts = [
  {id:1,name:'Core Oversized Hoodie',cat:'hoodies',price:185,sale:null,badge:'new',desc:'400GSM French Terry. Garment-washed. Dropped shoulder silhouette.',stock:24,colors:['#1a1a1a','#3a3836','#c8bfb0']},
  {id:2,name:'Phantom Graphic Tee',cat:'tees',price:95,sale:null,badge:'new',desc:'240GSM heavyweight cotton. Screen-printed Nova Core graphic.',stock:38,colors:['#1a1a1a','#f0ede8']},
  {id:3,name:'Core Capsule Hoodie',cat:'hoodies',price:220,sale:165,badge:'ltd',desc:'Limited colourway. Same construction as Core Hoodie — fewer made.',stock:5,colors:['#2c2420','#c8bfb0']},
  {id:4,name:'Structured 6-Panel Cap',cat:'hats',price:75,sale:null,badge:'',desc:'Structured crown, adjustable clasp. Embroidered NC logo.',stock:19,colors:['#1a1a1a','#3a3836','#c8bfb0']},
  {id:5,name:'Volume Shorts',cat:'shorts',price:115,sale:null,badge:'new',desc:'Relaxed wide-leg short. 340GSM fleece-back. Side pockets.',stock:22,colors:['#1a1a1a','#3a3836']},
  {id:6,name:'Essential Heavyweight Tee',cat:'tees',price:85,sale:null,badge:'',desc:'Classic fit. 280GSM ring-spun cotton. The everyday piece.',stock:0,colors:['#1a1a1a','#3a3836','#f0ede8','#2c2420']},
  {id:7,name:'NC Quarter Zip',cat:'hoodies',price:155,sale:null,badge:'',desc:'Half-zip pullover. Brushed interior. Minimal Nova Core chest logo.',stock:14,colors:['#1a1a1a','#c8bfb0']},
  {id:8,name:'Dad Hat — Washed Black',cat:'hats',price:65,sale:null,badge:'',desc:'Unstructured low-profile cap. Pre-curved brim. Tonal embroidery.',stock:31,colors:['#1a1a1a']},
  {id:9,name:'Arc Graphic Tee',cat:'tees',price:90,sale:75,badge:'ltd',desc:'Limited run Arc Series. Oversized print, heavyweight cotton.',stock:8,colors:['#1a1a1a','#f0ede8']}
];
const sampleOrders = {
  'NC-123456': {
    email: 'your@email.com',
    item: '1× Core Oversized Hoodie (M, Phantom Black)',
    dates: ['Mar 28, 2026', 'Mar 29, 2026', 'Mar 30, 2026 — Estimated delivery Apr 2'],
    finalText: 'Estimated: Apr 2, 2026',
    state: ['done', 'done', 'current', 'pending']
  },
  'NC-009284': {
    email: 'jordan@example.com',
    item: '2× Phantom Graphic Tee',
    dates: ['Mar 21, 2026', 'Mar 22, 2026', 'Mar 23, 2026'],
    finalText: 'Delivered Mar 25, 2026',
    state: ['done', 'done', 'done', 'done']
  }
};

let cart = [];
let products = [];
let currentProduct = null;
let currentFilter = 'all';
let currentSearch = '';
let mobileNavOpen = false;
let isAdminLoggedIn = sessionStorage.getItem(STORAGE_KEYS.adminSession) === 'true';
let adminToken = sessionStorage.getItem(STORAGE_KEYS.adminToken) || '';
let toastTimer = null;

if (!adminToken) {
  isAdminLoggedIn = false;
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function cloneProducts(items) {
  return items.map(item => ({...item, colors: [...item.colors]}));
}

function saveCart() {
  saveJSON(STORAGE_KEYS.cart, cart);
}

function clearAdminSession() {
  isAdminLoggedIn = false;
  adminToken = '';
  sessionStorage.removeItem(STORAGE_KEYS.adminSession);
  sessionStorage.removeItem(STORAGE_KEYS.adminToken);
}

function handleAdminFailure(error) {
  const message = error?.message || 'Admin action failed.';
  if (message.toLowerCase().includes('admin sign-in required')) {
    clearAdminSession();
    const loginError = document.getElementById('loginError');
    if (loginError) {
      loginError.textContent = 'Session expired. Please sign in again.';
      loginError.style.display = 'block';
    }
    navigate('admin-login');
  }
  showToast(message);
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : {};

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data;
}

function getAdminHeaders() {
  return adminToken ? {'X-Admin-Token': adminToken} : {};
}

function syncCartProducts() {
  cart = cart.reduce((items, entry) => {
    const latestProduct = products.find(product => product.id === entry.product.id);
    if (!latestProduct) return items;

    const maxQty = Math.max(latestProduct.stock || 0, 1);
    items.push({
      ...entry,
      product: latestProduct,
      qty: Math.max(1, Math.min(entry.qty, maxQty))
    });
    return items;
  }, []);

  if (currentProduct) {
    currentProduct = products.find(product => product.id === currentProduct.id) || null;
  }

  saveCart();
}

async function hydrateState() {
  cart = loadJSON(STORAGE_KEYS.cart, []);

  try {
    const data = await apiRequest('/products');
    products = Array.isArray(data.products) && data.products.length
      ? data.products
      : cloneProducts(defaultProducts);
  } catch (error) {
    console.warn('Using fallback product data.', error);
    products = cloneProducts(defaultProducts);
  }

  syncCartProducts();
}

async function refreshProducts() {
  const data = await apiRequest('/products');
  products = Array.isArray(data.products) ? data.products : [];
  syncCartProducts();
}

function normalisePath(path = '/') {
  if (!path || path === '/') return '/';
  return path.replace(/\/+$/, '') || '/';
}

function getPageFromLocation() {
  const hashPage = window.location.hash.replace('#', '').trim();
  if (hashPage && PAGE_ROUTES[hashPage]) {
    return hashPage;
  }

  return ROUTE_PAGES[normalisePath(window.location.pathname)] || 'home';
}

function getRouteForPage(page) {
  return PAGE_ROUTES[page] || PAGE_ROUTES.home;
}

function syncUrl(page, options = {}) {
  const {replace = false, productId = null} = options;
  const route = getRouteForPage(page);
  const search = page === 'product' && productId ? `?id=${encodeURIComponent(productId)}` : '';
  const nextUrl = `${route}${search}`;
  const currentUrl = `${normalisePath(window.location.pathname)}${window.location.search}`;

  if (currentUrl === nextUrl) return;

  history[replace ? 'replaceState' : 'pushState'](null, '', nextUrl);
}

function updateActiveNav(page) {
  document.querySelectorAll('[data-page]').forEach(link => {
    const isActive = link.dataset.page === page;
    link.classList.toggle('is-active', isActive);
    if (isActive) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

function wirePageLinks() {
  document.querySelectorAll('a[onclick*="navigate("]').forEach(link => {
    const onclick = link.getAttribute('onclick') || '';
    const match = onclick.match(/navigate\('([^']+)'\)/);
    if (!match) return;

    const page = match[1];
    link.dataset.page = page;
    link.setAttribute('href', getRouteForPage(page));
    link.addEventListener('click', event => {
      event.preventDefault();
    });
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formatCategory(cat) {
  return cat === 'tees' ? 'T-Shirts' : cat.charAt(0).toUpperCase() + cat.slice(1);
}

function getColorName(value) {
  return COLOR_NAMES[value?.toLowerCase?.()] || value || 'Core Tone';
}

function getProductMark(cat) {
  return cat === 'hoodies' ? 'HD' : cat === 'tees' ? 'TE' : cat === 'hats' ? 'HT' : 'SH';
}

function createBannerWord(text, direction) {
  const word = document.createElement('span');
  word.className = `banner-word banner-word-${direction}`;
  word.setAttribute('aria-hidden', 'true');

  let offset = 0;
  text.split(' ').filter(Boolean).forEach(part => {
    const chunk = document.createElement('span');
    chunk.className = 'banner-chunk';

    [...part].forEach(letter => {
      const letterSpan = document.createElement('span');
      letterSpan.className = 'banner-letter';
      letterSpan.style.setProperty('--i', offset);
      letterSpan.textContent = letter;
      chunk.appendChild(letterSpan);
      offset += 1;
    });

    word.appendChild(chunk);
  });

  return word;
}

function initAnimatedBanners() {
  document.querySelectorAll('[data-animated-banner]').forEach(title => {
    if (title.dataset.bannerReady === 'true') return;

    const source = title.textContent.replace(/\s+/g, ' ').trim();
    if (!source) return;

    const words = source.split(' ');
    const splitIndex = words.length > 1 ? Math.ceil(words.length / 2) : 1;
    const leftText = words.slice(0, splitIndex).join(' ');
    const rightText = words.slice(splitIndex).join(' ');

    title.classList.add('animated-banner-title');
    title.setAttribute('aria-label', source);
    title.textContent = '';
    title.appendChild(createBannerWord(leftText, 'left'));

    if (rightText) {
      title.appendChild(createBannerWord(rightText, 'right'));
    }

    title.dataset.bannerReady = 'true';
  });
}

function showPage(page, shouldSyncUrl = true, options = {}) {
  if (page === 'admin' && !isAdminLoggedIn) {
    page = 'admin-login';
  }

  const target = document.getElementById(`page-${page}`) || document.getElementById('page-home');
  const resolvedPage = target.id.replace('page-', '');
  document.querySelectorAll('.page').forEach(section => section.classList.remove('active'));
  target.classList.add('active');
  document.title = PAGE_TITLES[resolvedPage] || PAGE_TITLES.home;
  updateActiveNav(resolvedPage);
  window.scrollTo(0, 0);

  if (mobileNavOpen) {
    toggleMobileNav();
  }

  if (resolvedPage === 'shop') renderShopGrid();
  if (resolvedPage === 'admin') renderAdminProducts();
  if (shouldSyncUrl) syncUrl(resolvedPage, options);
}

function navigate(page, options = {}) {
  showPage(page, true, options);
  return false;
}

window.addEventListener('popstate', () => {
  restoreRouteState();
});

window.addEventListener('hashchange', () => {
  restoreRouteState();
});

window.addEventListener('load', () => {
  setTimeout(() => {
    const loader = document.getElementById('loader');
    if (!loader) return;
    loader.style.transition = 'opacity 0.6s';
    loader.style.opacity = '0';
    setTimeout(() => {
      loader.style.display = 'none';
    }, 600);
  }, 1200);
});

window.addEventListener('scroll', () => {
  const nav = document.getElementById('mainNav');
  if (!nav) return;
  nav.classList.toggle('scrolled', window.scrollY > 60);
});

function toggleMobileNav() {
  mobileNavOpen = !mobileNavOpen;
  const nav = document.getElementById('mobileNav');
  const hamburger = document.querySelector('.hamburger');
  if (!nav || !hamburger) return;

  nav.classList.toggle('open', mobileNavOpen);
  hamburger.children[0].style.transform = mobileNavOpen ? 'rotate(45deg) translate(5px, 5px)' : '';
  hamburger.children[1].style.opacity = mobileNavOpen ? '0' : '1';
  hamburger.children[2].style.transform = mobileNavOpen ? 'rotate(-45deg) translate(5px, -5px)' : '';
}

function focusShopSearch() {
  navigate('shop');
  window.setTimeout(() => {
    const input = document.getElementById('shopSearchInput');
    if (!input) return;
    input.focus();
    input.select();
    renderSearchSuggestions();
  }, 80);
  return false;
}

function productCardHTML(product, showQuick = true) {
  const stockClass = product.stock === 0 ? 'sold' : product.badge === 'ltd' ? 'ltd' : product.badge === 'new' ? 'new' : '';
  const badgeLabel = product.stock === 0 ? 'Sold Out' : product.badge === 'ltd' ? 'Limited' : product.badge === 'new' ? 'New' : '';
  const colorDots = product.colors.map(color => `<div class="color-dot" style="background:${color}" title="${getColorName(color)}"></div>`).join('');
  const priceHTML = product.sale
    ? `<span class="product-price sale">$${product.sale}</span><span class="product-price-orig">$${product.price}</span>`
    : `<span class="product-price">$${product.price}</span>`;

  return `
    <div class="product-card" onclick="openProduct(${product.id})">
      <div class="product-img-wrap">
        <div class="product-img-placeholder">
          <span>${getProductMark(product.cat)}</span>
        </div>
        ${badgeLabel ? `<div class="product-badge badge-${stockClass}">${badgeLabel}</div>` : ''}
        ${showQuick && product.stock > 0 ? `
          <div class="product-quick">
            <button class="quick-btn" onclick="event.stopPropagation();openProduct(${product.id})">View</button>
            <button class="quick-btn primary" onclick="event.stopPropagation();quickAddToCart(${product.id})">+ Cart</button>
          </div>` : ''}
      </div>
      <div class="product-info">
        <div class="product-name">${product.name}</div>
        <div class="product-cat">${formatCategory(product.cat)}</div>
        <div class="product-price-row">${priceHTML}</div>
        <div class="product-colors">${colorDots}</div>
      </div>
    </div>`;
}

function initFeaturedGrid() {
  const grid = document.getElementById('featuredGrid');
  if (!grid) return;
  const featured = products.filter(product => product.badge || product.sale).slice(0, 4);
  grid.innerHTML = featured.map(product => productCardHTML(product)).join('');
}

function getSearchableText(product) {
  return [
    product.name,
    formatCategory(product.cat),
    product.desc,
    ...(product.colors || []).map(color => getColorName(color))
  ].join(' ').toLowerCase();
}

function renderSearchSuggestions() {
  const input = document.getElementById('shopSearchInput');
  const panel = document.getElementById('shopSearchSuggestions');
  if (!input || !panel) return;

  const query = input.value.trim().toLowerCase();
  if (!query) {
    panel.innerHTML = '';
    panel.classList.remove('open');
    return;
  }

  const matches = products
    .filter(product => getSearchableText(product).includes(query))
    .slice(0, 6);

  panel.innerHTML = matches.length
    ? matches.map(product => `
        <button class="search-suggestion" onclick="chooseSearchSuggestion(${product.id})">
          <span>
            <span class="search-suggestion-name">${product.name}</span>
            <span class="search-suggestion-meta">${formatCategory(product.cat)} · $${product.sale || product.price}</span>
          </span>
          <strong>View</strong>
        </button>
      `).join('')
    : `<div class="search-empty">No matches yet. Try “hoodie”, “tee”, or “hat”.</div>`;

  panel.classList.add('open');
}

function closeSearchSuggestions() {
  const panel = document.getElementById('shopSearchSuggestions');
  if (!panel) return;
  panel.classList.remove('open');
}

function getFilteredProducts() {
  const searchTerm = currentSearch.trim().toLowerCase();

  return products.filter(product => {
    const matchesFilter = currentFilter === 'all'
      ? true
      : currentFilter === 'limited'
        ? product.badge === 'ltd'
        : product.cat === currentFilter;

    if (!matchesFilter) return false;
    if (!searchTerm) return true;

    return getSearchableText(product).includes(searchTerm);
  });
}

function renderShopGrid() {
  const grid = document.getElementById('shopGrid');
  const status = document.getElementById('shopSearchStatus');
  if (!grid) return;

  const filtered = getFilteredProducts();
  const queryLabel = currentSearch.trim();

  grid.innerHTML = filtered.length
    ? filtered.map(product => productCardHTML(product)).join('')
    : `<div style="padding:32px;background:var(--charcoal);color:var(--muted-grey)">No products matched ${queryLabel ? `“${queryLabel}”` : 'this filter'} yet.</div>`;

  if (status) {
    if (queryLabel && filtered.length) {
      status.textContent = `${filtered.length} result${filtered.length === 1 ? '' : 's'} found for “${queryLabel}”.`;
    } else if (queryLabel) {
      status.textContent = `No exact matches for “${queryLabel}” yet. Try a broader keyword.`;
    } else {
      status.textContent = 'Start typing and we’ll suggest matching products instantly.';
    }
  }
}

function handleSearchInput(value) {
  currentSearch = value.trim();
  renderShopGrid();
  renderSearchSuggestions();
}

function chooseSearchSuggestion(id) {
  const product = products.find(item => item.id === id);
  const input = document.getElementById('shopSearchInput');
  if (!product || !input) return;

  input.value = product.name;
  currentSearch = product.name;
  renderShopGrid();
  closeSearchSuggestions();
  openProduct(id);
}

function runProductSearch() {
  const input = document.getElementById('shopSearchInput');
  if (!input) return;

  currentSearch = input.value.trim();
  renderShopGrid();
  renderSearchSuggestions();

  const matches = getFilteredProducts();
  if (!currentSearch) {
    showToast('Start typing a product name or category to search.');
    return;
  }

  if (matches.length === 1) {
    closeSearchSuggestions();
    openProduct(matches[0].id);
    return;
  }

  showToast(matches.length
    ? `${matches.length} matching products found.`
    : `No products found for “${currentSearch}”.`);
}

function filterProducts(cat, btn) {
  currentFilter = cat;
  document.querySelectorAll('.filter-btn').forEach(button => button.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderShopGrid();
  renderSearchSuggestions();
}

function sortProducts(value) {
  if (value === 'price-asc') products.sort((a, b) => (a.sale || a.price) - (b.sale || b.price));
  else if (value === 'price-desc') products.sort((a, b) => (b.sale || b.price) - (a.sale || a.price));
  else if (value === 'new') products.sort((a, b) => Number(b.badge === 'new') - Number(a.badge === 'new'));
  else products.sort((a, b) => a.id - b.id);

  renderShopGrid();
  initFeaturedGrid();
}

function openProduct(id, options = {}) {
  const product = products.find(item => item.id === id);
  if (!product) return;

  currentProduct = product;
  document.getElementById('detailName').textContent = product.name;
  document.getElementById('detailPrice').innerHTML = product.sale
    ? `$${product.sale} <span class="orig">$${product.price}</span>`
    : `$${product.price}`;
  document.getElementById('detailDesc').textContent = product.desc;
  document.getElementById('galleryLabel').textContent = getProductMark(product.cat);
  document.getElementById('gallerySubLabel').textContent = `${formatCategory(product.cat)} / ${product.stock > 0 ? `${product.stock} in stock` : 'Sold out'}`;

  const colorOptions = document.getElementById('colorOptions');
  colorOptions.innerHTML = product.colors.map((color, index) => {
    const colorName = getColorName(color);
    return `<div class="color-swatch ${index === 0 ? 'active' : ''}" style="background:${color}" title="${colorName}" onclick="selectColor(this,'${colorName}')"></div>`;
  }).join('');

  document.getElementById('selectedColor').textContent = getColorName(product.colors[0]);
  document.getElementById('qtyInput').value = 1;
  document.querySelectorAll('.size-btn:not(.unavail)').forEach(button => button.classList.remove('active'));
  const defaultSize = document.querySelector('.size-btn:not(.unavail):nth-child(3)') || document.querySelector('.size-btn:not(.unavail)');
  if (defaultSize) defaultSize.classList.add('active');

  if (options.syncRoute === false) {
    showPage('product', false);
    return;
  }

  navigate('product', {productId: product.id, replace: Boolean(options.replaceRoute)});
}

function selectColor(el, name) {
  document.querySelectorAll('.color-swatch').forEach(swatch => swatch.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('selectedColor').textContent = name;
}

function selectSize(btn) {
  document.querySelectorAll('.size-btn:not(.unavail)').forEach(button => button.classList.remove('active'));
  btn.classList.add('active');
}

function changeQty(delta) {
  const input = document.getElementById('qtyInput');
  const current = Number.parseInt(input.value, 10) || 1;
  input.value = Math.max(1, Math.min(10, current + delta));
}

function toggleAcc(header) {
  const body = header.nextElementSibling;
  const arrow = header.querySelector('.acc-arrow');
  const isOpen = body.style.maxHeight && body.style.maxHeight !== '0px';

  document.querySelectorAll('.acc-body').forEach(item => {
    item.style.maxHeight = '0px';
  });
  document.querySelectorAll('.acc-arrow').forEach(item => {
    item.textContent = '+';
  });

  if (!isOpen) {
    body.style.maxHeight = `${body.scrollHeight}px`;
    arrow.textContent = '−';
  }
}

function openCart() {
  document.getElementById('cartOverlay').classList.add('open');
  document.getElementById('cartDrawer').classList.add('open');
  renderCart();
}

function closeCart() {
  document.getElementById('cartOverlay').classList.remove('open');
  document.getElementById('cartDrawer').classList.remove('open');
}

function addToCartFromDetail() {
  if (!currentProduct) return;
  const qty = Number.parseInt(document.getElementById('qtyInput').value, 10) || 1;
  const activeSize = document.querySelector('.size-btn.active:not(.unavail)');
  const size = activeSize ? activeSize.textContent : 'M';
  addToCart(currentProduct, qty, size);
}

function quickAddToCart(id) {
  const product = products.find(item => item.id === id);
  if (product) addToCart(product, 1, 'M');
}

function addToCart(product, qty, size) {
  if (product.stock === 0) {
    showToast('This item is sold out.');
    return;
  }

  const key = `${product.id}-${size}`;
  const existing = cart.find(item => item.key === key);
  const currentQty = existing ? existing.qty : 0;
  const nextQty = currentQty + qty;

  if (nextQty > product.stock) {
    showToast(`Only ${product.stock} left in stock.`);
    if (existing) existing.qty = product.stock;
    else cart.push({key, product, size, qty: product.stock});
  } else if (existing) {
    existing.qty = nextQty;
  } else {
    cart.push({key, product, size, qty});
  }

  saveCart();
  updateCartCount();
  renderCart();
  showToast(`${product.name} added to cart`);
}

function removeFromCart(key) {
  cart = cart.filter(item => item.key !== key);
  saveCart();
  updateCartCount();
  renderCart();
}

function changeCartQty(key, delta) {
  const item = cart.find(entry => entry.key === key);
  if (!item) return;

  item.qty = Math.max(1, Math.min(item.product.stock || 10, item.qty + delta));
  saveCart();
  renderCart();
  updateCartCount();
}

function renderCart() {
  const container = document.getElementById('cartItemsContainer');
  const footer = document.getElementById('cartFooter');
  const countEl = document.getElementById('cartItemCount');
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  countEl.textContent = totalItems;

  if (cart.length === 0) {
    container.innerHTML = `<div class="cart-empty"><div class="cart-empty-icon">◻</div><p>Your cart is empty.<br>Start adding some pieces.</p><a href="#" onclick="closeCart();navigate('shop')" class="btn-outline" style="margin-top:16px;display:inline-block">Shop Now</a></div>`;
    footer.style.display = 'none';
    return;
  }

  const subtotal = cart.reduce((sum, item) => sum + (item.product.sale || item.product.price) * item.qty, 0);
  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-img">${getProductMark(item.product.cat)}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${item.product.name}</div>
        <div class="cart-item-variant">Size: ${item.size}</div>
        <div class="cart-item-price">$${((item.product.sale || item.product.price) * item.qty).toFixed(0)}</div>
        <div class="cart-item-qty">
          <button class="ciq-btn" onclick="changeCartQty('${item.key}',-1)">−</button>
          <span class="ciq-num">${item.qty}</span>
          <button class="ciq-btn" onclick="changeCartQty('${item.key}',1)">+</button>
          <span class="cart-item-remove" onclick="removeFromCart('${item.key}')">Remove</span>
        </div>
      </div>
    </div>`).join('');

  document.getElementById('cartSubtotal').textContent = `$${subtotal.toFixed(0)}`;
  footer.style.display = 'block';
}

function updateCartCount() {
  document.getElementById('cartCount').textContent = cart.reduce((sum, item) => sum + item.qty, 0);
}

function checkout() {
  showToast('Checkout demo is ready. Connect a payment gateway when you are ready to launch.');
  closeCart();
}

function applyTrackingState(order) {
  const icons = Array.from(document.querySelectorAll('#trackingResult .step-icon'));
  const finalDate = document.querySelector('#trackingResult .tracking-step:last-child .step-date');

  icons.forEach((icon, index) => {
    const state = order.state[index];
    icon.className = `step-icon ${state}`;
    icon.textContent = state === 'done' ? '✓' : state === 'current' ? '→' : '○';
  });

  finalDate.textContent = order.finalText;
}

async function trackOrder() {
  const orderNumber = document.getElementById('trackOrderNum').value.trim().toUpperCase();
  const email = document.getElementById('trackEmail').value.trim().toLowerCase();
  const result = document.getElementById('trackingResult');

  if (!orderNumber || !email) {
    showToast('Please enter your order number and email.');
    result.classList.remove('visible');
    return;
  }

  if (!isValidEmail(email)) {
    showToast('Please enter a valid email address.');
    result.classList.remove('visible');
    return;
  }

  try {
    const data = await apiRequest(`/orders/track?orderNumber=${encodeURIComponent(orderNumber)}&email=${encodeURIComponent(email)}`);
    const order = data.order;

    document.getElementById('trackOrderId').textContent = order.orderNumber || orderNumber;
    document.getElementById('trackOrderName').textContent = order.item;
    document.getElementById('stepDate1').textContent = order.dates[0];
    document.getElementById('stepDate2').textContent = order.dates[1];
    document.getElementById('stepDate3').textContent = order.dates[2];
    applyTrackingState(order);
    result.classList.add('visible');
    showToast('Order found!');
  } catch (error) {
    result.classList.remove('visible');
    showToast(error.message || 'Unable to look up that order right now.');
  }
}

async function adminLogin() {
  const passwordInput = document.getElementById('adminPassword');
  const password = passwordInput.value;
  const error = document.getElementById('loginError');

  if (!password.trim()) {
    error.textContent = 'Please enter the admin password.';
    error.style.display = 'block';
    passwordInput.focus();
    return;
  }

  try {
    const data = await apiRequest('/admin/login', {
      method: 'POST',
      body: JSON.stringify({password})
    });

    isAdminLoggedIn = true;
    adminToken = data.token;
    sessionStorage.setItem(STORAGE_KEYS.adminSession, 'true');
    sessionStorage.setItem(STORAGE_KEYS.adminToken, adminToken);
    error.style.display = 'none';
    passwordInput.value = '';
    navigate('admin');
    renderAdminProducts();
    showToast('Welcome back to the dashboard.');
  } catch (err) {
    clearAdminSession();
    error.textContent = err.message || 'Incorrect password. Please try again.';
    error.style.display = 'block';
    passwordInput.value = '';
    passwordInput.focus();
  }
}

async function adminLogout() {
  try {
    if (adminToken) {
      await apiRequest('/admin/logout', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({})
      });
    }
  } catch (error) {
    console.warn('Logout request failed.', error);
  }

  clearAdminSession();
  navigate('home');
  showToast('Logged out successfully.');
}

function adminSection(name, btn) {
  document.querySelectorAll('.admin-section').forEach(section => section.classList.remove('active'));
  document.querySelectorAll('.admin-tab').forEach(tab => tab.classList.remove('active'));

  const target = document.getElementById(`admin-${name}`);
  if (target) target.classList.add('active');
  if (btn?.classList) btn.classList.add('active');
}

function renderAdminProducts() {
  const tbody = document.getElementById('adminProductBody');
  if (!tbody) return;

  tbody.innerHTML = products.map(product => {
    const stockClass = product.stock === 0 ? 'out' : product.stock <= 8 ? 'low' : 'in';
    const stockLabel = product.stock === 0 ? 'Out of Stock' : product.stock <= 8 ? 'Low Stock' : 'In Stock';

    return `<tr>
      <td><div class="product-thumb-cell"><div class="product-thumb-sm">${product.id}</div><span>${product.name}</span></div></td>
      <td style="text-transform:capitalize">${formatCategory(product.cat)}</td>
      <td>${product.sale ? `<span style="color:var(--accent)">$${product.sale}</span> <span style="text-decoration:line-through;color:var(--muted-grey);font-size:0.78rem">$${product.price}</span>` : `$${product.price}`}</td>
      <td><span class="stock-badge ${stockClass}">${stockLabel} (${product.stock})</span></td>
      <td><div class="action-btns"><button class="action-btn edit" onclick="editProduct(${product.id})">Edit</button><button class="action-btn del" onclick="deleteProduct(${product.id})">Delete</button></div></td>
    </tr>`;
  }).join('');

  document.getElementById('adminProductCount').textContent = products.length;
}

async function addProduct() {
  const name = document.getElementById('newProductName').value.trim();
  const cat = document.getElementById('newProductCat').value;
  const price = Number.parseInt(document.getElementById('newProductPrice').value, 10);
  const saleRaw = document.getElementById('newProductSale').value;
  const sale = saleRaw ? Number.parseInt(saleRaw, 10) : null;
  const stock = Number.parseInt(document.getElementById('newProductStock').value, 10) || 0;
  const badge = document.getElementById('newProductBadge').value;
  const desc = document.getElementById('newProductDesc').value.trim();

  if (!name || !Number.isFinite(price) || price <= 0) {
    showToast('Please enter a valid product name and price.');
    return;
  }

  try {
    const data = await apiRequest('/products', {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({
        name,
        cat,
        price,
        sale,
        badge,
        desc: desc || 'Premium Nova Core piece.',
        stock,
        colors: ['#1a1a1a']
      })
    });

    document.getElementById('newProductName').value = '';
    document.getElementById('newProductPrice').value = '';
    document.getElementById('newProductSale').value = '';
    document.getElementById('newProductStock').value = '';
    document.getElementById('newProductDesc').value = '';
    document.getElementById('newProductBadge').value = '';

    await refreshProducts();
    renderAdminProducts();
    renderShopGrid();
    initFeaturedGrid();
    adminSection('products', document.querySelector('.admin-tab:nth-child(2)'));
    showToast(data.message || `${name} added successfully.`);
  } catch (error) {
    handleAdminFailure(error);
  }
}

async function editProduct(id) {
  const product = products.find(item => item.id === id);
  if (!product) return;

  const name = prompt('Product name:', product.name);
  if (name === null) return;
  const price = prompt('Price ($):', product.price);
  if (price === null) return;
  const stock = prompt('Stock count:', product.stock);
  if (stock === null) return;

  const payload = {
    ...product,
    name: name.trim() || product.name,
    price: Number.parseInt(price, 10) || product.price,
    stock: Math.max(0, Number.parseInt(stock, 10) || 0)
  };

  try {
    const data = await apiRequest(`/products/${id}`, {
      method: 'PUT',
      headers: getAdminHeaders(),
      body: JSON.stringify(payload)
    });

    await refreshProducts();
    renderAdminProducts();
    renderShopGrid();
    initFeaturedGrid();
    showToast(data.message || `${payload.name} updated.`);
  } catch (error) {
    handleAdminFailure(error);
  }
}

async function deleteProduct(id) {
  const product = products.find(item => item.id === id);
  if (!product) return;

  if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;

  try {
    const data = await apiRequest(`/products/${id}`, {
      method: 'DELETE',
      headers: getAdminHeaders()
    });

    await refreshProducts();
    cart = cart.filter(item => item.product.id !== id);
    saveCart();
    renderAdminProducts();
    renderShopGrid();
    initFeaturedGrid();
    renderCart();
    updateCartCount();
    showToast(data.message || `${product.name} deleted.`);
  } catch (error) {
    handleAdminFailure(error);
  }
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 3200);
}

async function subscribeNewsletter() {
  const activePage = document.querySelector('.page.active') || document;
  const inputs = Array.from(activePage.querySelectorAll('.newsletter-form input[type="email"]'));
  const input = inputs.find(field => field.value.trim()) || inputs[0];
  const email = input?.value.trim().toLowerCase();

  if (!email || !isValidEmail(email)) {
    showToast('Please enter a valid email address.');
    return;
  }

  try {
    const data = await apiRequest('/newsletter', {
      method: 'POST',
      body: JSON.stringify({email})
    });
    input.value = '';
    showToast(data.message || 'You\'re in. Welcome to Nova Core.');
  } catch (error) {
    showToast(error.message || 'Unable to join the newsletter right now.');
  }
}

async function submitContact() {
  const scope = document.querySelector('#page-contact .contact-right');
  const fields = scope.querySelectorAll('.form-input');
  const [firstName, lastName, email, orderNumber, subject, message] = fields;

  if (!firstName.value.trim() || !email.value.trim() || !subject.value.trim() || !message.value.trim()) {
    showToast('Please fill in your name, email, subject, and message.');
    return;
  }

  if (!isValidEmail(email.value.trim())) {
    showToast('Please enter a valid email address.');
    return;
  }

  try {
    const data = await apiRequest('/contact', {
      method: 'POST',
      body: JSON.stringify({
        firstName: firstName.value.trim(),
        lastName: lastName.value.trim(),
        email: email.value.trim().toLowerCase(),
        orderNumber: orderNumber.value.trim().toUpperCase(),
        subject: subject.value.trim(),
        message: message.value.trim()
      })
    });

    fields.forEach(field => {
      field.value = '';
    });

    showToast(data.message || 'Message sent. We\'ll be in touch within 24 hours.');
  } catch (error) {
    showToast(error.message || 'Unable to send your message right now.');
  }
}

async function submitCustom() {
  const scope = document.querySelector('#page-custom .custom-form');
  const fields = scope.querySelectorAll('.form-input');
  const [name, email, requestType, baseGarment, brief, budget, timeline] = fields;

  if (!name.value.trim() || !email.value.trim() || !brief.value.trim()) {
    showToast('Please add your name, email, and design brief.');
    return;
  }

  if (!isValidEmail(email.value.trim())) {
    showToast('Please enter a valid email address.');
    return;
  }

  try {
    const data = await apiRequest('/custom', {
      method: 'POST',
      body: JSON.stringify({
        name: name.value.trim(),
        email: email.value.trim().toLowerCase(),
        requestType: requestType.value,
        baseGarment: baseGarment.value,
        brief: brief.value.trim(),
        budget: budget.value,
        timeline: timeline.value
      })
    });

    fields.forEach(field => {
      if (field.tagName === 'SELECT') {
        field.selectedIndex = 0;
      } else {
        field.value = '';
      }
    });

    showToast(data.message || 'Request received. We\'ll review and contact you within 48 hours.');
  } catch (error) {
    showToast(error.message || 'Unable to submit your request right now.');
  }
}

function selectCustom(el) {
  document.querySelectorAll('.custom-option').forEach(option => option.classList.remove('active'));
  el.classList.add('active');

  const requestType = document.querySelector('#page-custom .custom-form select');
  if (!requestType) return;

  const title = el.querySelector('.custom-option-title')?.textContent?.trim();
  const matchingOption = Array.from(requestType.options).find(option => option.text === title);
  if (matchingOption) {
    requestType.value = matchingOption.value;
  }
}

function restoreRouteState() {
  const page = getPageFromLocation();
  const resolvedPage = page === 'admin' && !isAdminLoggedIn ? 'admin-login' : page;

  if (resolvedPage === 'product') {
    const params = new URLSearchParams(window.location.search);
    const requestedId = Number.parseInt(params.get('id'), 10);
    const fallbackId = products.some(product => product.id === requestedId) ? requestedId : products[0]?.id;

    if (fallbackId) {
      openProduct(fallbackId, {replaceRoute: true});
      return;
    }
  }

  showPage(resolvedPage, false);
  syncUrl(resolvedPage, {replace: true, productId: currentProduct?.id});
}

document.addEventListener('click', event => {
  if (!event.target.closest('.shop-search')) {
    closeSearchSuggestions();
  }
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    closeCart();
    closeSearchSuggestions();
    if (mobileNavOpen) toggleMobileNav();
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  initAnimatedBanners();
  wirePageLinks();
  await hydrateState();
  initFeaturedGrid();
  renderShopGrid();
  renderCart();
  updateCartCount();
  renderAdminProducts();
  restoreRouteState();
});
