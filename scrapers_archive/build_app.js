const fs = require('fs');
const path = require('path');

const enriched = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/data/enriched_products.json'), 'utf8'));

const appJsCode = `/**
 * HĀNIM ACCESSORIES - E-Commerce Front-End Catalog Logic
 * Integrated with Real Scraped Daraz Products and Local Image Assets
 */

// Configuration
const CONFIG = {
  whatsappNumber: "923001234567", // Seller's WhatsApp phone number (format: 923XXXXXXXXX)
  darazStoreUrl: "https://www.daraz.pk/qoa1xzag/?q=All-Products&from=wangpu&langFlag=en&pageTypeId=2",
  freeDeliveryThreshold: 1500,
  standardDeliveryFee: 200,
  currency: "Rs. "
};

// Genuine Scraped Products from Daraz (29 Real Products)
const PRODUCTS = ${JSON.stringify(enriched, null, 2)};

// App State
let state = {
  cart: [],
  activeCategory: "all",
  searchQuery: "",
  selectedModalVariant: null
};

// DOM References
const productGrid = document.getElementById("productGrid");
const categoryTabs = document.getElementById("categoryTabs");
const searchInput = document.getElementById("searchInput");
const productCountText = document.getElementById("productCountText");
const cartDrawer = document.getElementById("cartDrawer");
const drawerOverlay = document.getElementById("drawerOverlay");
const openCartBtn = document.getElementById("openCartBtn");
const closeCartBtn = document.getElementById("closeCartBtn");
const drawerBody = document.getElementById("drawerBody");
const cartCountBadge = document.getElementById("cartCountBadge");
const drawerCount = document.getElementById("drawerCount");
const drawerSubtotal = document.getElementById("drawerSubtotal");
const drawerShipping = document.getElementById("drawerShipping");
const drawerTotal = document.getElementById("drawerTotal");
const shippingText = document.getElementById("shippingText");
const shippingProgress = document.getElementById("shippingProgress");
const progressPercent = document.getElementById("progressPercent");
const sendWhatsAppOrderBtn = document.getElementById("sendWhatsAppOrderBtn");
const orderNoteInput = document.getElementById("orderNoteInput");
const quickViewOverlay = document.getElementById("quickViewOverlay");
const quickViewCard = document.getElementById("quickViewCard");
const closeQuickViewBtn = document.getElementById("closeQuickViewBtn");
const quickViewContent = document.getElementById("quickViewContent");
const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toastMessage");

// Initialize on DOM Ready
document.addEventListener("DOMContentLoaded", () => {
  loadCartFromStorage();
  renderProducts();
  setupEventListeners();
  setupAccordion();
});

// Load cart from LocalStorage if available
function loadCartFromStorage() {
  try {
    const saved = localStorage.getItem("hanim_cart");
    if (saved) {
      state.cart = JSON.parse(saved);
      updateCartUI();
    }
  } catch (e) {
    console.warn("Could not read cart from localStorage", e);
  }
}

// Save cart to LocalStorage
function saveCartToStorage() {
  try {
    localStorage.setItem("hanim_cart", JSON.stringify(state.cart));
  } catch (e) {
    console.warn("Could not save cart to localStorage", e);
  }
}

// Render Products Grid
function renderProducts() {
  const filtered = PRODUCTS.filter(item => {
    const matchCategory = state.activeCategory === "all" || item.category === state.activeCategory;
    const q = state.searchQuery.toLowerCase();
    const matchSearch = q === "" || 
      item.title.toLowerCase().includes(q) ||
      item.id.includes(q) ||
      (item.description && item.description.toLowerCase().includes(q)) ||
      (item.categoryLabel && item.categoryLabel.toLowerCase().includes(q)) ||
      (item.variants && item.variants.some(v => v.toLowerCase().includes(q)));
    return matchCategory && matchSearch;
  });

  // Update counter text
  if (productCountText) {
    productCountText.textContent = "Showing " + filtered.length + " of " + PRODUCTS.length + " genuine bracelets";
  }

  if (filtered.length === 0) {
    productGrid.innerHTML = \`
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px;">
        <p style="font-size: 1.2rem; color: var(--text-dark); margin-bottom: 8px;">No bracelets found matching "\` + escapeHtml(state.searchQuery) + \`".</p>
        <p style="color: var(--text-muted); font-size: 0.9rem;">Try selecting "All Bracelets" or searching for "golden", "black", or "baby".</p>
      </div>
    \`;
    return;
  }

  productGrid.innerHTML = filtered.map(product => {
    const hasDiscount = product.discount && product.discount.trim() !== "";
    const hasOriginalPrice = product.originalPrice && product.originalPrice > product.price;
    const variantsPreview = product.variants && product.variants.length > 0 
      ? '<div class="card-variants-tag"><span>' + escapeHtml(product.variants.slice(0, 2).join(' • ')) + (product.variants.length > 2 ? ' +' + (product.variants.length - 2) : '') + '</span></div>'
      : '';

    return \`
      <article class="product-card" data-id="\` + product.id + \`">
        <div class="card-media">
          <span class="card-badge \` + product.badgeClass + \`">\` + escapeHtml(product.badge) + \`</span>
          <span class="card-sku-tag">#\` + product.id + \`</span>
          <img src="\` + product.mainImage + \`" alt="\` + escapeHtml(product.title) + \`" class="card-img" loading="lazy" onerror="this.src='images/hero_bracelets.jpg'">
          <button class="quick-view-overlay-btn" onclick="openQuickView('\` + product.id + \`')">
            Quick Details & Gallery (\` + product.images.length + \`)
          </button>
        </div>
        <div class="card-info">
          <div class="card-top-row">
            <span class="card-category">\` + escapeHtml(product.categoryLabel) + \`</span>
            \` + (hasDiscount ? '<span class="card-discount-pill">' + escapeHtml(product.discount) + '</span>' : '') + \`
          </div>
          <h3 class="card-title" title="\` + escapeHtml(product.title) + \`">\` + escapeHtml(product.title) + \`</h3>
          \` + variantsPreview + \`
          <div class="card-pricing">
            <span class="card-price">\` + CONFIG.currency + product.price.toLocaleString() + \`</span>
            \` + (hasOriginalPrice ? '<span class="card-original-price">' + CONFIG.currency + product.originalPrice.toLocaleString() + '</span>' : '') + \`
          </div>
          <div class="card-actions">
            <button class="btn-card-wa" onclick="orderSingleViaWhatsApp('\` + product.id + \`')" title="Order this bracelet on WhatsApp">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.031 2C6.495 2 2 6.495 2 12.031c0 1.98.577 3.824 1.572 5.378L2.094 22l4.774-1.442A9.97 9.97 0 0 0 12.031 22C17.568 22 22 17.505 22 12.031 22 6.495 17.568 2 12.031 2zm5.727 14.168c-.24.674-1.188 1.289-1.928 1.448-.507.108-1.171.196-3.398-.727-2.846-1.18-4.685-4.067-4.827-4.256-.139-.188-1.15-1.533-1.15-2.923 0-1.39.73-2.073.99-2.358.26-.285.57-.356.76-.356.19 0 .38.002.546.01.174.009.407-.066.637.485.24.575.819 2.002.89 2.148.072.146.12.316.024.505-.095.19-.143.308-.285.474-.143.167-.3.372-.429.5-.143.143-.292.3-.125.586.166.286.74 1.22 1.587 1.974 1.09.972 2.008 1.272 2.294 1.415.286.143.453.12.62-.072.167-.19.714-.833.905-1.12.19-.286.38-.238.643-.143.262.095 1.666.786 1.952.929.286.143.476.214.547.333.072.119.072.69-.168 1.364z"/></svg>
              <span>Order on WhatsApp</span>
            </button>
            <div class="card-secondary-row">
              <button class="btn-card-bag" onclick="addToCart('\` + product.id + \`')" title="Add to Bag">
                <span>+ Add to Bag</span>
              </button>
              <a href="\` + product.darazUrl + \`" target="_blank" rel="noopener" class="btn-card-daraz" title="View on Daraz with COD">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
                <span>Daraz</span>
              </a>
            </div>
          </div>
        </div>
      </article>
    \`;
  }).join("");
}

// Setup Event Listeners
function setupEventListeners() {
  // Category tabs
  if (categoryTabs) {
    categoryTabs.addEventListener("click", (e) => {
      const btn = e.target.closest(".tab-btn");
      if (!btn) return;
      categoryTabs.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.activeCategory = btn.dataset.category;
      renderProducts();
    });
  }

  // Search input
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value.trim();
      renderProducts();
    });
  }

  // Cart Drawer open/close
  if (openCartBtn) openCartBtn.addEventListener("click", openCart);
  if (closeCartBtn) closeCartBtn.addEventListener("click", closeCart);
  if (drawerOverlay) drawerOverlay.addEventListener("click", closeCart);

  // Quick View close
  if (closeQuickViewBtn) closeQuickViewBtn.addEventListener("click", closeQuickView);
  if (quickViewOverlay) {
    quickViewOverlay.addEventListener("click", (e) => {
      if (e.target === quickViewOverlay) closeQuickView();
    });
  }

  // Send WhatsApp Order from Bag
  if (sendWhatsAppOrderBtn) {
    sendWhatsAppOrderBtn.addEventListener("click", sendWhatsAppOrder);
  }

  // Keyboard accessibility
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeCart();
      closeQuickView();
    }
  });
}

// Filter and scroll helper (used from footer links)
function filterAndScroll(category) {
  state.activeCategory = category;
  if (categoryTabs) {
    categoryTabs.querySelectorAll(".tab-btn").forEach(b => {
      if (b.dataset.category === category) b.classList.add("active");
      else b.classList.remove("active");
    });
  }
  renderProducts();
  const catalogEl = document.getElementById("catalog");
  if (catalogEl) {
    catalogEl.scrollIntoView({ behavior: "smooth" });
  }
}

// Add Product to Cart
function addToCart(productId, selectedVariant = null) {
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return;

  const variantToUse = selectedVariant || (product.variants && product.variants[0]) || "Standard";
  const cartKey = product.id + "_" + variantToUse;

  const existing = state.cart.find(item => item.cartKey === cartKey);
  if (existing) {
    existing.quantity += 1;
  } else {
    state.cart.push({
      cartKey: cartKey,
      id: product.id,
      title: product.title,
      price: product.price,
      image: product.mainImage,
      variant: variantToUse,
      darazUrl: product.darazUrl,
      quantity: 1
    });
  }

  saveCartToStorage();
  updateCartUI();
  showToast('Added "' + product.title + '" to your bag!');
  openCart();
}

// Update Cart Quantity
function updateQuantity(cartKey, delta) {
  const item = state.cart.find(i => i.cartKey === cartKey);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) {
    removeFromCart(cartKey);
    return;
  }

  saveCartToStorage();
  updateCartUI();
}

// Remove from Cart
function removeFromCart(cartKey) {
  state.cart = state.cart.filter(item => item.cartKey !== cartKey);
  saveCartToStorage();
  updateCartUI();
}

// Update Cart UI (Badges, Summary, Progress bar)
function updateCartUI() {
  const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  const isFreeDelivery = subtotal >= CONFIG.freeDeliveryThreshold || subtotal === 0;
  const shippingFee = isFreeDelivery ? 0 : CONFIG.standardDeliveryFee;
  const total = subtotal + shippingFee;

  // Header & Drawer Badges
  if (cartCountBadge) cartCountBadge.textContent = totalItems;
  if (drawerCount) drawerCount.textContent = totalItems + (totalItems === 1 ? ' item' : ' items');

  // Summary figures
  if (drawerSubtotal) drawerSubtotal.textContent = CONFIG.currency + subtotal.toLocaleString();
  if (drawerShipping) {
    drawerShipping.textContent = isFreeDelivery ? (subtotal === 0 ? "Rs. 0" : "FREE") : (CONFIG.currency + shippingFee);
    if (isFreeDelivery && subtotal > 0) {
      drawerShipping.style.color = "var(--badge-green)";
      drawerShipping.style.fontWeight = "700";
    } else {
      drawerShipping.style.color = "inherit";
      drawerShipping.style.fontWeight = "normal";
    }
  }
  if (drawerTotal) drawerTotal.textContent = CONFIG.currency + total.toLocaleString();

  // Free delivery progress bar
  if (shippingProgress && shippingText && progressPercent) {
    if (subtotal >= CONFIG.freeDeliveryThreshold) {
      shippingProgress.style.width = "100%";
      progressPercent.textContent = "100%";
      shippingText.textContent = "🎉 You unlocked FREE Delivery across Pakistan!";
    } else {
      const remaining = CONFIG.freeDeliveryThreshold - subtotal;
      const percent = Math.min(100, Math.round((subtotal / CONFIG.freeDeliveryThreshold) * 100));
      shippingProgress.style.width = percent + "%";
      progressPercent.textContent = percent + "%";
      shippingText.textContent = "Add Rs. " + remaining.toLocaleString() + " more for FREE Delivery!";
    }
  }

  // Render Drawer Items or Empty State
  if (!drawerBody) return;

  if (state.cart.length === 0) {
    drawerBody.innerHTML = \`
      <div class="empty-cart-state">
        <div class="empty-icon">🛍️</div>
        <h4>Your Bag is Empty</h4>
        <p>Explore our genuine handcrafted Daraz bracelets and pick your favorite pieces.</p>
        <button class="btn btn-primary" onclick="closeCart()">Start Browsing</button>
      </div>
    \`;
    if (sendWhatsAppOrderBtn) {
      sendWhatsAppOrderBtn.disabled = true;
      sendWhatsAppOrderBtn.style.opacity = "0.5";
      sendWhatsAppOrderBtn.style.cursor = "not-allowed";
    }
  } else {
    if (sendWhatsAppOrderBtn) {
      sendWhatsAppOrderBtn.disabled = false;
      sendWhatsAppOrderBtn.style.opacity = "1";
      sendWhatsAppOrderBtn.style.cursor = "pointer";
    }

    drawerBody.innerHTML = state.cart.map(item => \`
      <div class="drawer-item" data-key="\` + item.cartKey + \`">
        <img src="\` + item.image + \`" alt="\` + escapeHtml(item.title) + \`" class="drawer-item-img" onerror="this.src='images/hero_bracelets.jpg'">
        <div class="drawer-item-details">
          <h4 class="drawer-item-title">\` + escapeHtml(item.title) + \`</h4>
          <div class="drawer-item-meta">
            <span class="drawer-item-sku">ID: #\` + item.id + \`</span>
            \` + (item.variant && item.variant !== 'Standard' ? '<span class="drawer-item-variant">• ' + escapeHtml(item.variant) + '</span>' : '') + \`
          </div>
          <span class="drawer-item-price">\` + CONFIG.currency + (item.price * item.quantity).toLocaleString() + \`</span>
          <div class="drawer-item-controls">
            <div class="qty-control">
              <button class="qty-btn" onclick="updateQuantity('\` + item.cartKey + \`', -1)" aria-label="Decrease quantity">−</button>
              <span class="qty-num">\` + item.quantity + \`</span>
              <button class="qty-btn" onclick="updateQuantity('\` + item.cartKey + \`', 1)" aria-label="Increase quantity">+</button>
            </div>
            <button class="remove-item-btn" onclick="removeFromCart('\` + item.cartKey + \`')">Remove</button>
          </div>
        </div>
      </div>
    \`).join("");
  }
}

// Drawer Visibility
function openCart() {
  if (cartDrawer) {
    cartDrawer.classList.add("active");
    cartDrawer.setAttribute("aria-hidden", "false");
  }
  if (drawerOverlay) drawerOverlay.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeCart() {
  if (cartDrawer) {
    cartDrawer.classList.remove("active");
    cartDrawer.setAttribute("aria-hidden", "true");
  }
  if (drawerOverlay) drawerOverlay.classList.remove("active");
  document.body.style.overflow = "";
}

// Quick View Modal with Multi-Angle Gallery
function openQuickView(productId) {
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product || !quickViewContent) return;

  state.selectedModalVariant = product.variants && product.variants.length > 0 ? product.variants[0] : null;

  const hasDiscount = product.discount && product.discount.trim() !== "";
  const hasOriginalPrice = product.originalPrice && product.originalPrice > product.price;

  // Build gallery thumbnails
  const images = product.images && product.images.length > 0 ? product.images : [product.mainImage];
  const galleryThumbsHtml = images.length > 1 ? \`
    <div class="modal-thumbnails-track">
      \` + images.map((img, idx) => \`
        <button class="modal-thumb-btn \` + (idx === 0 ? 'active' : '') + \`" onclick="switchModalImage(this, '\` + img + \`')" aria-label="View angle \` + (idx + 1) + \`">
          <img src="\` + img + \`" alt="Angle \` + (idx + 1) + \`" class="modal-thumb-img" onerror="this.src='images/hero_bracelets.jpg'">
        </button>
      \`).join("") + \`
    </div>
  \` : '';

  // Build variants chips
  const variantsHtml = product.variants && product.variants.length > 0 ? \`
    <div class="modal-variants-block">
      <label class="modal-section-label">Available Options / Sizes:</label>
      <div class="variants-chip-group">
        \` + product.variants.map((v, idx) => \`
          <button class="variant-chip \` + (idx === 0 ? 'selected' : '') + \`" onclick="selectModalVariant(this, '\` + escapeHtml(v) + \`')">
            \` + escapeHtml(v) + \`
          </button>
        \`).join("") + \`
      </div>
    </div>
  \` : '';

  // Build highlights
  const highlightsHtml = product.highlights && product.highlights.length > 0 ? \`
    <div class="modal-highlights-block">
      <label class="modal-section-label">Key Features & Highlights:</label>
      <ul class="modal-spec-list">
        \` + product.highlights.slice(0, 5).map(h => '<li>✦ ' + escapeHtml(h) + '</li>').join("") + \`
      </ul>
    </div>
  \` : '';

  // Build specs
  const specEntries = Object.entries(product.specifications || {});
  const specsHtml = specEntries.length > 0 ? \`
    <div class="modal-specs-table">
      \` + specEntries.map(([k, v]) => '<div class="spec-row"><span class="spec-key">' + escapeHtml(k) + ':</span> <span class="spec-val">' + escapeHtml(v) + '</span></div>').join("") + \`
    </div>
  \` : '';

  quickViewContent.innerHTML = \`
    <div class="modal-grid">
      <div class="modal-gallery">
        <div class="modal-main-image-wrap">
          <span class="modal-sku-tag">ID: #\` + product.id + \`</span>
          \` + (hasDiscount ? '<span class="modal-discount-tag">' + escapeHtml(product.discount) + ' OFF</span>' : '') + \`
          <img id="modalMainImg" src="\` + images[0] + \`" alt="\` + escapeHtml(product.title) + \`" class="modal-img" onerror="this.src='images/hero_bracelets.jpg'">
        </div>
        \` + galleryThumbsHtml + \`
      </div>

      <div class="modal-details">
        <div class="modal-header-meta">
          <span class="modal-tag">\` + escapeHtml(product.categoryLabel) + \`</span>
          <a href="\` + product.darazUrl + \`" target="_blank" rel="noopener" class="modal-daraz-badge" title="Verified Daraz Listing">
            Verified on Daraz ↗
          </a>
        </div>

        <h3 class="modal-title">\` + escapeHtml(product.title) + \`</h3>

        <div class="modal-price-box">
          <span class="modal-price">\` + CONFIG.currency + product.price.toLocaleString() + \`</span>
          \` + (hasOriginalPrice ? '<span class="modal-original-price">' + CONFIG.currency + product.originalPrice.toLocaleString() + '</span>' : '') + \`
          \` + (hasDiscount ? '<span class="modal-save-text">Save ' + escapeHtml(product.discount) + '</span>' : '') + \`
        </div>

        \` + variantsHtml + \`

        \` + highlightsHtml + \`

        \` + specsHtml + \`

        <div class="modal-actions">
          <button class="btn btn-secondary btn-modal-wa" onclick="orderCurrentModalViaWhatsApp('\` + product.id + \`')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12.031 2C6.495 2 2 6.495 2 12.031c0 1.98.577 3.824 1.572 5.378L2.094 22l4.774-1.442A9.97 9.97 0 0 0 12.031 22C17.568 22 22 17.505 22 12.031 22 6.495 17.568 2 12.031 2zm5.727 14.168c-.24.674-1.188 1.289-1.928 1.448-.507.108-1.171.196-3.398-.727-2.846-1.18-4.685-4.067-4.827-4.256-.139-.188-1.15-1.533-1.15-2.923 0-1.39.73-2.073.99-2.358.26-.285.57-.356.76-.356.19 0 .38.002.546.01.174.009.407-.066.637.485.24.575.819 2.002.89 2.148.072.146.12.316.024.505-.095.19-.143.308-.285.474-.143.167-.3.372-.429.5-.143.143-.292.3-.125.586.166.286.74 1.22 1.587 1.974 1.09.972 2.008 1.272 2.294 1.415.286.143.453.12.62-.072.167-.19.714-.833.905-1.12.19-.286.38-.238.643-.143.262.095 1.666.786 1.952.929.286.143.476.214.547.333.072.119.072.69-.168 1.364z"/></svg>
            <span>Order on WhatsApp (Instant)</span>
          </button>
          
          <div class="modal-secondary-buttons">
            <button class="btn btn-outline btn-modal-bag" onclick="addModalItemToCart('\` + product.id + \`')">
              <span>+ Add to Bag</span>
            </button>
            <a href="\` + product.darazUrl + \`" target="_blank" rel="noopener" class="btn btn-daraz btn-modal-daraz">
              <span>Buy on Daraz (COD) ↗</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  \`;

  if (quickViewOverlay) quickViewOverlay.classList.add("active");
  document.body.style.overflow = "hidden";
}

// Switch main preview image in modal
function switchModalImage(thumbBtn, imgSrc) {
  const mainImg = document.getElementById("modalMainImg");
  if (mainImg) {
    mainImg.style.opacity = "0.3";
    setTimeout(() => {
      mainImg.src = imgSrc;
      mainImg.style.opacity = "1";
    }, 120);
  }
  document.querySelectorAll(".modal-thumb-btn").forEach(b => b.classList.remove("active"));
  if (thumbBtn) thumbBtn.classList.add("active");
}

// Select variant chip in modal
function selectModalVariant(chipBtn, variant) {
  state.selectedModalVariant = variant;
  document.querySelectorAll(".variant-chip").forEach(c => c.classList.remove("selected"));
  if (chipBtn) chipBtn.classList.add("selected");
}

function addModalItemToCart(productId) {
  addToCart(productId, state.selectedModalVariant);
  closeQuickView();
}

function orderCurrentModalViaWhatsApp(productId) {
  orderSingleViaWhatsApp(productId, state.selectedModalVariant);
}

function closeQuickView() {
  if (quickViewOverlay) quickViewOverlay.classList.remove("active");
  if (!cartDrawer.classList.contains("active")) {
    document.body.style.overflow = "";
  }
}

// Single Product WhatsApp Instant Order
function orderSingleViaWhatsApp(productId, variant = null) {
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return;

  const chosenVariant = variant || (product.variants && product.variants[0]) || '';
  let text = "Assalam o Alaikum Hanim Accessories! 🌸\\n\\nI want to order this bracelet from your website:\\n\\n";
  text += "✨ *Item:* " + product.title + "\\n";
  text += "🆔 *Product ID / SKU:* #" + product.id + "\\n";
  text += "🏷️ *Price:* " + CONFIG.currency + product.price.toLocaleString() + "\\n";
  if (chosenVariant) {
    text += "🎨 *Option / Size:* " + chosenVariant + "\\n";
  }
  text += "🔗 *Daraz Ref:* " + product.darazUrl + "\\n\\n";
  text += "Please let me know availability and delivery steps. JazakAllah!";

  const url = "https://wa.me/" + CONFIG.whatsappNumber + "?text=" + encodeURIComponent(text);
  window.open(url, "_blank");
}

// Full Bag WhatsApp Order Generator
function sendWhatsAppOrder() {
  if (state.cart.length === 0) return;

  const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const isFreeDelivery = subtotal >= CONFIG.freeDeliveryThreshold;
  const shippingFee = isFreeDelivery ? 0 : CONFIG.standardDeliveryFee;
  const total = subtotal + shippingFee;
  const note = orderNoteInput ? orderNoteInput.value.trim() : "";

  let itemsListText = state.cart.map(item => {
    let line = "• " + item.quantity + "x *" + item.title + "* (ID: #" + item.id + ")";
    if (item.variant && item.variant !== 'Standard') {
      line += " [" + item.variant + "]";
    }
    line += " - " + CONFIG.currency + (item.price * item.quantity).toLocaleString();
    return line;
  }).join("\\n");

  let message = "Assalam o Alaikum Hanim Accessories! 🌸\\n\\nI would like to place an order from your website:\\n\\n📦 *Order Items:*\\n" + itemsListText + "\\n\\n";
  message += "💰 *Subtotal:* " + CONFIG.currency + subtotal.toLocaleString() + "\\n";
  message += "🚚 *Delivery:* " + (isFreeDelivery ? "FREE (Orders over Rs. 1,500)" : (CONFIG.currency + shippingFee)) + "\\n";
  message += "🏷️ *Estimated Total:* " + CONFIG.currency + total.toLocaleString() + "\\n";

  if (note) {
    message += "\\n📝 *Customer Note:* " + note + "\\n";
  }

  message += "\\nPlease confirm availability and share payment/delivery steps. JazakAllah!";

  const waUrl = "https://wa.me/" + CONFIG.whatsappNumber + "?text=" + encodeURIComponent(message);
  window.open(waUrl, "_blank");
}

// Toast notification
let toastTimer;
function showToast(msg) {
  if (!toast || !toastMessage) return;
  toastMessage.textContent = msg;
  toast.classList.add("active");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("active");
  }, 3200);
}

// Accordion for FAQ
function setupAccordion() {
  const accordionItems = document.querySelectorAll(".accordion-item");
  accordionItems.forEach(item => {
    const header = item.querySelector(".accordion-header");
    const content = item.querySelector(".accordion-content");
    if (!header || !content) return;

    header.addEventListener("click", () => {
      const isOpen = item.classList.contains("open");

      // Close all others
      accordionItems.forEach(other => {
        other.classList.remove("open");
        const otherContent = other.querySelector(".accordion-content");
        if (otherContent) otherContent.style.maxHeight = null;
      });

      // Toggle current
      if (!isOpen) {
        item.classList.add("open");
        content.style.maxHeight = content.scrollHeight + "px";
      }
    });
  });
}

// Helper: Escape HTML to avoid XSS
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
`;

fs.writeFileSync(path.join(__dirname, 'app.js'), appJsCode, 'utf8');
console.log('Successfully written app.js with genuine Daraz products and multi-angle gallery!');