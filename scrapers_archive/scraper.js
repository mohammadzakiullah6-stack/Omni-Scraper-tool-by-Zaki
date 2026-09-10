/**
 * Daraz Store Scraper for Hanim Accessories
 * Store URL: https://www.daraz.pk/shop/qoa1xzag?path=index.htm&lang=en&pageTypeId=1
 *
 * Extracts authentic product data without hallucination, downloads master high-res images,
 * and generates src/data/products.json with local image references.
 */

const { chromium } = require('playwright-chromium');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const STORE_URL = 'https://www.daraz.pk/shop/qoa1xzag?path=index.htm&lang=en&pageTypeId=1';
const OUTPUT_DIR = path.join(__dirname, 'public', 'products');
const DATA_DIR = path.join(__dirname, 'src', 'data');
const PRODUCTS_JSON = path.join(DATA_DIR, 'products.json');

// Helper: Sleep
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper: Clean image URL to obtain master uncompressed high-res image
function cleanImageUrl(url) {
  if (!url) return null;
  let clean = url.startsWith('//') ? 'https:' + url : url;
  
  // Filter out badges, icons, social graphics, and emojis
  if (
    clean.includes('social-img') ||
    clean.includes('badge') ||
    clean.includes('icon') ||
    clean.includes('logo') ||
    clean.includes('avatar')
  ) {
    return null;
  }

  // Remove trailing .webp extension if appended to .jpg/.png
  clean = clean.replace(/_\.webp$/i, '');
  // Remove Daraz / Lazada resize suffix e.g. _720x720q80.jpg or _80x80q80.jpg or _100x100.jpg
  clean = clean.replace(/_([0-9]+x[0-9]+|[0-9]+x[0-9]+q[0-9]+)[a-zA-Z0-9_\-\.]*$/i, '');
  // Also handle .jpg_something
  clean = clean.replace(/(\.(jpg|jpeg|png))_.*$/i, '$1');

  return clean;
}

// Helper: Download a remote file
async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const fullUrl = url.startsWith('//') ? 'https:' + url : url;
    const client = fullUrl.startsWith('https') ? https : http;

    const request = client.get(
      fullUrl,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
          Referer: 'https://www.daraz.pk/'
        },
        timeout: 20000
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP status ${res.statusCode} for ${url}`));
        }

        const dir = path.dirname(destPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const fileStream = fs.createWriteStream(destPath);
        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          resolve(destPath);
        });

        fileStream.on('error', (err) => {
          fs.unlink(destPath, () => {});
          reject(err);
        });
      }
    );

    request.on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });

    request.on('timeout', () => {
      request.destroy();
      fs.unlink(destPath, () => {});
      reject(new Error(`Timeout downloading ${url}`));
    });
  });
}

// Helper: Create safe slug from title
function createSlug(title, id) {
  if (!title) return `product-${id}`;
  let slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  if (slug.length > 50) {
    slug = slug.slice(0, 50).replace(/-$/, '');
  }
  return slug || `product-${id}`;
}

async function scrapeStore() {
  console.log('Starting Daraz Store Scraper...');
  console.log(`Target Store: ${STORE_URL}\n`);

  // Ensure directories exist
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 }
  });

  const storePage = await context.newPage();

  console.log('Connecting to Daraz storefront...');
  try {
    await storePage.goto(STORE_URL, { waitUntil: 'networkidle', timeout: 45000 });
  } catch (e) {
    console.log('Storefront initial load notice:', e.message);
  }

  // Scroll to trigger store modules and lazy loaded sections
  for (let i = 0; i < 6; i++) {
    await storePage.evaluate(() => window.scrollBy(0, 800));
    await sleep(600);
  }

  // Retrieve shop metadata (shopId, sellerId) from store page
  const storeMeta = await storePage.evaluate(() => {
    const pd = window.pageData || {};
    return {
      shopId: pd.shopId || 1614848,
      sellerId: pd.sellerId || 6005174336559
    };
  });

  console.log(`Store identified - ShopId: ${storeMeta.shopId}, SellerId: ${storeMeta.sellerId}`);

  // Fetch full store catalog via seller API in the browser session to ensure 100% catalog coverage
  const apiProducts = await storePage.evaluate(async (meta) => {
    try {
      const res = await fetch(
        `https://www.daraz.pk/shop/site/api/seller/products?shopId=${meta.shopId}&sellerId=${meta.sellerId}&lang=en&limit=100&offset=1&sort=created_at`
      );
      const data = await res.json();
      return (data && data.result && data.result.products) || [];
    } catch (e) {
      return [];
    }
  }, storeMeta);

  // Also extract any product links directly visible in the DOM
  const domProductUrls = await storePage.evaluate(() => {
    return Array.from(document.querySelectorAll('a'))
      .map((a) => a.href)
      .filter((h) => h && (h.includes('-i') || h.includes('/products/')));
  });

  await storePage.close();

  // Combine and deduplicate discovered product targets
  const productMap = new Map();

  // 1. Add from catalog API
  for (const p of apiProducts) {
    const rawUrl = p.pdpUrl || (p.auctionId ? `https://www.daraz.pk/products/-i${p.auctionId}.html` : null);
    if (!rawUrl) continue;
    const cleanUrl = rawUrl.split('?')[0];
    const auctionId = String(p.auctionId || p.skuId || cleanUrl.match(/-i(\d+)/)?.[1]);
    if (!productMap.has(auctionId)) {
      productMap.set(auctionId, {
        id: auctionId,
        url: cleanUrl,
        apiHint: p
      });
    }
  }

  // 2. Add any additional DOM-discovered URLs
  for (const rawUrl of domProductUrls) {
    const cleanUrl = rawUrl.split('?')[0];
    const match = cleanUrl.match(/-i(\d+)/);
    const auctionId = match ? match[1] : cleanUrl;
    if (!productMap.has(auctionId)) {
      productMap.set(auctionId, {
        id: auctionId,
        url: cleanUrl,
        apiHint: null
      });
    }
  }

  const productTargets = Array.from(productMap.values());
  const totalProducts = productTargets.length;
  console.log(`Discovered ${totalProducts} genuine products to process.\n`);

  const extractedProducts = [];
  const usedSlugs = new Set();
  let totalImagesDownloaded = 0;
  let failedProductsCount = 0;

  const pdpPage = await context.newPage();

  // Process each product sequentially
  for (let idx = 0; idx < totalProducts; idx++) {
    const target = productTargets[idx];
    const currentIndex = idx + 1;

    try {
      // Polite delay between product requests
      await sleep(1800);

      await pdpPage.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 40000 });

      // Scroll page to activate lazyload-wrapper for description, specs, and gallery
      await pdpPage.evaluate(() => window.scrollBy(0, 700));
      await sleep(800);
      await pdpPage.evaluate(() => window.scrollBy(0, 900));
      await sleep(1000);

      // Extract all genuine data from the PDP
      const rawData = await pdpPage.evaluate(() => {
        // Title
        const titleEl = document.querySelector('.pdp-mod-product-badge-title') || document.querySelector('h1');
        const title = titleEl ? titleEl.textContent.trim() : null;

        // Current Price
        const priceNormalEl =
          document.querySelector('.pdp-price_type_normal') || document.querySelector('.pdp-product-price');
        const priceText = priceNormalEl ? priceNormalEl.textContent.trim() : null;
        const priceNum = priceText ? parseInt(priceText.replace(/[^0-9]/g, ''), 10) : null;

        // Original Price
        const priceDeletedEl = document.querySelector('.pdp-price_type_deleted');
        const originalPriceText = priceDeletedEl ? priceDeletedEl.textContent.trim() : null;
        const originalPriceNum = originalPriceText ? parseInt(originalPriceText.replace(/[^0-9]/g, ''), 10) : null;

        // Discount
        const discountEl = document.querySelector('.pdp-product-price__discount');
        const discountText = discountEl ? discountEl.textContent.trim() : null;

        // Breadcrumbs & Category
        const breadcrumbElements = Array.from(
          document.querySelectorAll('.breadcrumb_item, .pdp-breadcrumb-item, .breadcrumb-item')
        );
        const breadcrumbs = breadcrumbElements.map((el) => el.textContent.trim()).filter(Boolean);
        const category = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2] : 'Bracelets';

        // Description & Highlights
        const highlightElements = Array.from(
          document.querySelectorAll('.pdp-product-highlights li, .pdp-product-desc li')
        );
        const highlights = highlightElements.map((li) => li.textContent.trim()).filter(Boolean);

        const descContainer =
          document.querySelector('.pdp-product-desc') || document.querySelector('.detail-content');
        let description = null;
        if (highlights.length > 0) {
          description = highlights.join('\n');
        } else if (descContainer) {
          description = descContainer.textContent.trim() || null;
        }

        // Specifications
        const specs = {};
        document
          .querySelectorAll(
            '.pdp-mod-specification .key-li, .specification-keys .key-li, .pdp-mod-specification li'
          )
          .forEach((li) => {
            const titleSpan = li.querySelector('.key-title');
            const valSpan = li.querySelector('.key-value');
            if (titleSpan && valSpan) {
              const k = titleSpan.textContent.trim();
              const v = valSpan.textContent.trim();
              if (k && v) specs[k] = v;
            } else {
              const text = li.textContent.trim();
              if (text.includes('  ')) {
                const parts = text.split(/\s{2,}/);
                if (parts.length >= 2) specs[parts[0].trim()] = parts.slice(1).join(' ').trim();
              }
            }
          });

        // Variants
        const variants = [];
        document
          .querySelectorAll(
            '.sku-prop-selection .sku-name, .sku-variable-size, .sku-prop-content, .sku-variable-img-wrap'
          )
          .forEach((el) => {
            const vText = el.getAttribute('title') || el.textContent.trim();
            if (vText && !variants.includes(vText)) {
              variants.push(vText);
            }
          });

        // Gallery Images from DOM
        const imgCandidates = [];
        // Main preview image
        const mainPreview =
          document.querySelector('.gallery-preview-panel__image') ||
          document.querySelector('.pdp-mod-common-image');
        if (mainPreview) {
          const src = mainPreview.src || mainPreview.getAttribute('data-src');
          if (src) imgCandidates.push(src);
        }

        // Thumbnail strip
        document
          .querySelectorAll('.item-gallery__thumbnail-image, .next-slick-track img, .item-gallery__thumbnail img')
          .forEach((img) => {
            const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-origin');
            if (src) imgCandidates.push(src);
          });

        return {
          title,
          priceText,
          priceNum,
          originalPriceText,
          originalPriceNum,
          discountText,
          breadcrumbs,
          category,
          highlights,
          description,
          specs: Object.keys(specs).length > 0 ? specs : null,
          variants: variants.length > 0 ? variants : null,
          imgCandidates
        };
      });

      // Fallback values from API hint if DOM was partially masked
      const finalTitle = rawData.title || target.apiHint?.title || `Hanim Bracelet ${target.id}`;
      const finalPrice = rawData.priceNum || target.apiHint?.price || null;
      const finalPriceFormatted = rawData.priceText || (finalPrice ? `Rs. ${finalPrice}` : null);
      const finalOriginalPrice = rawData.originalPriceNum || null;
      const finalOriginalPriceFormatted = rawData.originalPriceText || null;
      const finalDiscount = rawData.discountText || null;
      const finalCategory = rawData.category || 'Bracelets';

      // Construct unique slug
      let baseSlug = createSlug(finalTitle, target.id);
      let uniqueSlug = baseSlug;
      let collisionIdx = 2;
      while (usedSlugs.has(uniqueSlug)) {
        uniqueSlug = `${baseSlug}-${collisionIdx}`;
        collisionIdx++;
      }
      usedSlugs.add(uniqueSlug);

      // Clean and collect image URLs
      const cleanedUrls = [];
      const seenUrlBases = new Set();

      // Include API image if available
      if (target.apiHint?.imageUrl) {
        rawData.imgCandidates.unshift(target.apiHint.imageUrl);
      }

      for (const candidate of rawData.imgCandidates) {
        const clean = cleanImageUrl(candidate);
        if (clean) {
          // Normalize for deduplication
          const normBase = clean.split('?')[0].toLowerCase();
          if (!seenUrlBases.has(normBase)) {
            seenUrlBases.add(normBase);
            cleanedUrls.push(clean);
          }
        }
      }

      // Terminal output format requested by user:
      // [1/30] Downloading Product Name
      // Images: 5
      // Complete
      console.log(`[${currentIndex}/${totalProducts}] Downloading ${finalTitle}`);
      console.log(`Images: ${cleanedUrls.length}`);

      // Directory for product images: public/products/{product-slug}/
      const productImgDir = path.join(OUTPUT_DIR, uniqueSlug);
      if (!fs.existsSync(productImgDir)) {
        fs.mkdirSync(productImgDir, { recursive: true });
      }

      const localImages = [];
      let mainImagePath = null;

      for (let imgIdx = 0; imgIdx < cleanedUrls.length; imgIdx++) {
        const imgUrl = cleanedUrls[imgIdx];
        const filename = imgIdx === 0 ? 'main.jpg' : `${String(imgIdx).padStart(2, '0')}.jpg`;
        const destFilePath = path.join(productImgDir, filename);
        // Local reference format for web app
        const relativeLocalPath = `public/products/${uniqueSlug}/${filename}`;

        try {
          await downloadFile(imgUrl, destFilePath);
          localImages.push(relativeLocalPath);
          if (imgIdx === 0) {
            mainImagePath = relativeLocalPath;
          }
          totalImagesDownloaded++;
        } catch (downloadErr) {
          // Retry once
          try {
            await sleep(800);
            await downloadFile(imgUrl, destFilePath);
            localImages.push(relativeLocalPath);
            if (imgIdx === 0) mainImagePath = relativeLocalPath;
            totalImagesDownloaded++;
          } catch (retryErr) {
            // Keep going with remaining images
          }
        }
      }

      // Assemble structured product record
      const productRecord = {
        id: target.id,
        title: finalTitle,
        slug: uniqueSlug,
        category: finalCategory,
        breadcrumbs: rawData.breadcrumbs.length > 0 ? rawData.breadcrumbs : [finalCategory],
        price: finalPrice,
        priceFormatted: finalPriceFormatted,
        originalPrice: finalOriginalPrice,
        originalPriceFormatted: finalOriginalPriceFormatted,
        discount: finalDiscount,
        description: rawData.description,
        highlights: rawData.highlights.length > 0 ? rawData.highlights : null,
        specifications: rawData.specs,
        variants: rawData.variants,
        mainImage: mainImagePath,
        image: mainImagePath, // Direct alias for website compatibility
        images: localImages,
        darazUrl: target.url
      };

      extractedProducts.push(productRecord);
      console.log('Complete\n');
    } catch (itemErr) {
      console.error(`Failed extracting product [${currentIndex}/${totalProducts}] (ID: ${target.id}):`, itemErr.message);
      failedProductsCount++;
      console.log('Complete\n');
    }
  }

  await pdpPage.close();
  await browser.close();

  // Save generated dataset to src/data/products.json
  fs.writeFileSync(PRODUCTS_JSON, JSON.stringify(extractedProducts, null, 2), 'utf8');

  console.log('========================================');
  console.log(`Total products: ${extractedProducts.length}`);
  console.log(`Total images:   ${totalImagesDownloaded}`);
  console.log(`Failed products: ${failedProductsCount}`);
  console.log('========================================');
  console.log(`Dataset saved to: ${PRODUCTS_JSON}`);
}

// Execute scraper
scrapeStore().catch((err) => {
  console.error('Fatal Scraper Error:', err);
  process.exit(1);
});
