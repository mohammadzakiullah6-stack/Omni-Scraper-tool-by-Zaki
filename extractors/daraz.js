/**
 * Daraz Extractor Module
 * Supports single product PDPs and storefronts
 */

function cleanDarazImageUrl(url) {
  if (!url) return null;
  let clean = url.startsWith('//') ? 'https:' + url : url;
  if (clean.includes('social-img') || clean.includes('badge') || clean.includes('icon') || clean.includes('logo')) {
    return null;
  }
  clean = clean.replace(/_\.webp$/i, '');
  clean = clean.replace(/_([0-9]+x[0-9]+|[0-9]+x[0-9]+q[0-9]+)[a-zA-Z0-9_\-\.]*$/i, '');
  clean = clean.replace(/(\.(jpg|jpeg|png))_.*$/i, '$1');
  return clean;
}

async function scrapeDaraz(page, url, log) {
  log(`Navigating to Daraz: ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

  // Scroll to load lazy sections
  log('Scrolling page to activate specifications and gallery...');
  await page.evaluate(() => window.scrollBy(0, 600));
  await page.waitForTimeout(800);
  await page.evaluate(() => window.scrollBy(0, 800));
  await page.waitForTimeout(1000);

  const raw = await page.evaluate(() => {
    // Title
    const titleEl = document.querySelector('.pdp-mod-product-badge-title') || document.querySelector('h1');
    const title = titleEl ? titleEl.textContent.trim() : null;

    // Price
    const priceNormalEl = document.querySelector('.pdp-price_type_normal') || document.querySelector('.pdp-product-price');
    const priceText = priceNormalEl ? priceNormalEl.textContent.trim() : null;
    const priceNum = priceText ? parseInt(priceText.replace(/[^0-9]/g, ''), 10) : null;

    // Original Price
    const priceDeletedEl = document.querySelector('.pdp-price_type_deleted');
    const origPriceText = priceDeletedEl ? priceDeletedEl.textContent.trim() : null;
    const origPriceNum = origPriceText ? parseInt(origPriceText.replace(/[^0-9]/g, ''), 10) : null;

    // Discount
    const discountEl = document.querySelector('.pdp-product-price__discount');
    const discount = discountEl ? discountEl.textContent.trim() : null;

    // Breadcrumbs & Category
    const breadcrumbs = Array.from(document.querySelectorAll('.breadcrumb_item, .pdp-breadcrumb-item'))
      .map(el => el.textContent.trim()).filter(Boolean);
    const category = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2] : null;

    // Description & Highlights
    const highlights = Array.from(document.querySelectorAll('.pdp-product-highlights li, .pdp-product-desc li'))
      .map(li => li.textContent.trim()).filter(Boolean);
    const descContainer = document.querySelector('.pdp-product-desc') || document.querySelector('.detail-content');
    const description = highlights.length > 0 ? highlights.join('\n') : (descContainer ? descContainer.textContent.trim() : null);

    // Specs
    const specs = {};
    document.querySelectorAll('.pdp-mod-specification .key-li, .specification-keys .key-li, .pdp-mod-specification li').forEach(li => {
      const kSpan = li.querySelector('.key-title');
      const vSpan = li.querySelector('.key-value');
      if (kSpan && vSpan) {
        const k = kSpan.textContent.trim();
        const v = vSpan.textContent.trim();
        if (k && v) specs[k] = v;
      } else {
        const text = li.textContent.trim();
        const parts = text.split(/\s{2,}/);
        if (parts.length >= 2) specs[parts[0].trim()] = parts.slice(1).join(' ').trim();
      }
    });

    // Brand / Seller
    const sellerEl = document.querySelector('.seller-name__detail-name') || document.querySelector('.seller-name');
    const seller = sellerEl ? sellerEl.textContent.trim() : specs['Brand'] || 'Daraz Seller';

    // Variants
    const variants = [];
    document.querySelectorAll('.sku-prop-selection .sku-name, .sku-variable-size, .sku-prop-content').forEach(el => {
      const text = el.getAttribute('title') || el.textContent.trim();
      if (text && !variants.includes(text)) variants.push(text);
    });

    // Gallery images
    const rawImages = [];
    const mainImg = document.querySelector('.gallery-preview-panel__image') || document.querySelector('.pdp-mod-common-image');
    if (mainImg) rawImages.push(mainImg.src || mainImg.getAttribute('data-src'));

    document.querySelectorAll('.item-gallery__thumbnail-image, .next-slick-track img').forEach(img => {
      const src = img.src || img.getAttribute('data-src');
      if (src) rawImages.push(src);
    });

    return {
      title,
      priceNum,
      priceText,
      origPriceNum,
      origPriceText,
      discount,
      category,
      breadcrumbs,
      description,
      specs,
      seller,
      variants,
      rawImages: rawImages.filter(Boolean)
    };
  });

  // Clean images
  const cleanImages = [];
  const seen = new Set();
  for (const img of raw.rawImages) {
    const cleaned = cleanDarazImageUrl(img);
    if (cleaned && !seen.has(cleaned)) {
      seen.add(cleaned);
      cleanImages.push(cleaned);
    }
  }

  log(`Extracted: "${raw.title || 'Product'}" - ${cleanImages.length} images found.`);

  return {
    sourceType: 'Daraz',
    url,
    title: raw.title,
    productName: raw.title,
    company: raw.seller,
    country: 'Pakistan (Daraz.pk)',
    price: raw.priceNum,
    priceFormatted: raw.priceText,
    originalPrice: raw.origPriceNum,
    originalPriceFormatted: raw.origPriceText,
    discount: raw.discount,
    category: raw.category,
    description: raw.description,
    specifications: Object.keys(raw.specs).length > 0 ? raw.specs : null,
    variants: raw.variants.length > 0 ? raw.variants : null,
    images: cleanImages,
    mainImage: cleanImages[0] || null,
    emails: [],
    phones: []
  };
}

module.exports = { scrapeDaraz };
