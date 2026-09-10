/**
 * Generic Website & Lead Extractor Module (Enhanced for E-Commerce & Deep Content)
 * Extracts Emails, Phones, Socials, Company, Country, HD Images, Prices, and Descriptions
 */

function cleanGenericImageUrl(url) {
  if (!url) return null;
  let clean = url.trim();
  if (clean.startsWith('//')) clean = 'https:' + clean;
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) return null;

  const lower = clean.toLowerCase();

  // Filter out tracking networks & analytics pixels
  if (
    lower.includes('adroll') ||
    lower.includes('doubleclick') ||
    lower.includes('google-analytics') ||
    lower.includes('facebook.com/tr') ||
    lower.includes('criteo') ||
    lower.includes('bing.com') ||
    lower.includes('clarity.ms') ||
    lower.includes('tiktok.com') ||
    lower.includes('pixel') ||
    lower.includes('spacer') ||
    lower.includes('tracking') ||
    lower.includes('analytics') ||
    lower.includes('favicon') ||
    lower.includes('.svg') ||
    lower.includes('loading') ||
    lower.includes('spinner') ||
    lower.includes('data:image')
  ) {
    return null;
  }

  // Ensure it is a valid image URL (has image extension OR is from known media CDN)
  const isImageFile = /\.(jpg|jpeg|png|webp|avif)($|\?)/i.test(clean);
  const isMediaCDN = lower.includes('cdn/shop') || lower.includes('shopify.com') || lower.includes('alicdn') || lower.includes('slatic');
  
  if (!isImageFile && !isMediaCDN) {
    return null;
  }

  // Shopify image optimization: upgrade low-width thumbnails to high resolution
  if (lower.includes('cdn/shop') || lower.includes('cdn.shopify.com')) {
    clean = clean.replace(/([?&])width=[0-9]+/i, '$1width=1200');
  }

  // Daraz / Lazada CDN
  if (lower.includes('alicdn.com') || lower.includes('slatic.net') || lower.includes('lazcdn.com')) {
    clean = clean.replace(/_\.webp$/i, '');
    clean = clean.replace(/_([0-9]+x[0-9]+|[0-9]+x[0-9]+q[0-9]+)[a-zA-Z0-9_\-\.]*$/i, '');
    clean = clean.replace(/(\.(jpg|jpeg|png))_.*$/i, '$1');
  }

  // WordPress / WooCommerce image resize suffix (e.g. -150x150.jpg, -300x300.jpg)
  clean = clean.replace(/-\d{2,4}x\d{2,4}\.(jpg|jpeg|png|webp)$/i, '.$1');

  return clean;
}

// Parse srcset strings to find the largest resolution image
function extractLargestFromSrcset(srcset) {
  if (!srcset) return null;
  const candidates = srcset.split(',').map(s => s.trim()).filter(Boolean);
  let bestUrl = null;
  let maxDim = -1;

  for (const c of candidates) {
    const parts = c.split(/\s+/);
    const url = parts[0];
    let dim = 1;
    if (parts[1]) {
      const match = parts[1].match(/(\d+)[wx]/i);
      if (match) dim = parseInt(match[1], 10);
    }
    if (dim > maxDim) {
      maxDim = dim;
      bestUrl = url;
    }
  }
  return bestUrl;
}

async function scrapeGenericWeb(page, url, log) {
  log(`Opening website: ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 50000 });

  log('Deep scrolling to trigger all lazy-loaded product modules & content...');
  // Progressive deep scroll
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => window.scrollBy(0, 900));
    await page.waitForTimeout(600);
  }
  // Scroll to bottom for footers
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(800);

  const data = await page.evaluate(() => {
    // 1. Page Title & Meta Info
    const title = document.title ? document.title.trim() : null;
    const metaDesc = document.querySelector('meta[name="description"], meta[property="og:description"]')?.content?.trim() || null;
    const ogSiteName = document.querySelector('meta[property="og:site_name"]')?.content?.trim() || null;

    // 2. Company / Brand detection
    let company = ogSiteName;
    if (!company) {
      const footer = document.querySelector('footer, .footer, #footer');
      if (footer) {
        const copyMatch = footer.textContent.match(/©\s*(?:20\d\d)?\s*([A-Za-z0-9\s\.\,\-]+?)(?:All\s*rights|Inc|LLC|Ltd|\.|$)/i);
        if (copyMatch && copyMatch[1].trim().length < 50) {
          company = copyMatch[1].trim();
        }
      }
    }
    if (!company && title) {
      const parts = title.split(/[|\-–•]/);
      company = parts.length > 1 ? parts[parts.length - 1].trim() : title;
    }

    // 3. Email Extraction
    const emails = new Set();
    document.querySelectorAll('a[href^="mailto:"]').forEach(a => {
      const email = a.href.replace(/^mailto:/i, '').split('?')[0].trim();
      if (email && email.includes('@')) emails.add(email.toLowerCase());
    });

    const bodyText = document.body ? document.body.innerText : '';
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/g;
    let match;
    while ((match = emailRegex.exec(bodyText)) !== null) {
      const e = match[0].toLowerCase();
      if (!e.endsWith('.png') && !e.endsWith('.jpg') && !e.endsWith('.svg') && !e.includes('example.com') && !e.includes('wixpress.com')) {
        emails.add(e);
      }
    }

    // 4. Phone Number Extraction
    const phones = new Set();
    document.querySelectorAll('a[href^="tel:"]').forEach(a => {
      const p = a.href.replace(/^tel:/i, '').trim();
      if (p.length >= 7) phones.add(p);
    });

    document.querySelectorAll('a[href*="wa.me"], a[href*="whatsapp.com/send"]').forEach(a => {
      const waMatch = a.href.match(/(?:wa\.me\/|phone=)([0-9+]+)/);
      if (waMatch && waMatch[1]) phones.add(waMatch[1]);
    });

    const contactSections = Array.from(document.querySelectorAll('header, footer, nav, [class*="contact"], [class*="header"], [class*="footer"], #contact'))
      .map(el => el.innerText).join('\n');
    const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g;
    let pMatch;
    while ((pMatch = phoneRegex.exec(contactSections)) !== null) {
      const p = pMatch[0].trim();
      if (p.length >= 8 && p.length <= 20 && !p.startsWith('202') && !p.startsWith('199')) {
        phones.add(p);
      }
    }

    // 5. Social Links
    const socials = {};
    document.querySelectorAll('a[href]').forEach(a => {
      const href = a.href.toLowerCase();
      if (href.includes('facebook.com') && !href.includes('sharer')) socials.facebook = a.href;
      if (href.includes('instagram.com')) socials.instagram = a.href;
      if (href.includes('linkedin.com/company') || href.includes('linkedin.com/in')) socials.linkedin = a.href;
      if (href.includes('twitter.com') || href.includes('x.com')) socials.twitter = a.href;
      if (href.includes('youtube.com')) socials.youtube = a.href;
      if (href.includes('wa.me')) socials.whatsapp = a.href;
    });

    // 6. Country & Address
    let address = null;
    let country = null;
    const addressEl = document.querySelector('[itemprop="address"], address, .address, [class*="address"]');
    if (addressEl) address = addressEl.textContent.trim().replace(/\s+/g, ' ');
    const countryEl = document.querySelector('[itemprop="addressCountry"]');
    if (countryEl) country = countryEl.textContent.trim();

    // 7. Pricing (if e-commerce)
    let price = null;
    let priceFormatted = null;
    const priceEl = document.querySelector('[itemprop="price"], .price, .product-price, .current-price');
    if (priceEl) {
      priceFormatted = priceEl.textContent.trim();
      const numMatch = priceFormatted.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
      if (numMatch) price = parseFloat(numMatch[0]);
    }

    // 8. Deep Image Collection (All raw image tags, srcset, and backgrounds)
    const rawImagesList = [];
    
    // OpenGraph Priority Image
    const ogImg = document.querySelector('meta[property="og:image"]')?.content;
    if (ogImg) rawImagesList.push({ src: ogImg, srcset: null });

    // All image elements
    document.querySelectorAll('img').forEach(img => {
      const src = img.src || img.getAttribute('src');
      const dataSrc = img.getAttribute('data-src') || img.getAttribute('data-original');
      const srcset = img.getAttribute('srcset') || img.getAttribute('data-srcset');
      rawImagesList.push({ src: dataSrc || src, srcset });
    });

    // Background images in hero/product banners
    document.querySelectorAll('[style*="background-image"]').forEach(el => {
      const bg = el.style.backgroundImage;
      const bgMatch = bg.match(/url\(['"]?([^'"]+)['"]?\)/);
      if (bgMatch) rawImagesList.push({ src: bgMatch[1], srcset: null });
    });

    return {
      title,
      metaDesc,
      company,
      emails: Array.from(emails),
      phones: Array.from(phones),
      socials,
      address,
      country,
      price,
      priceFormatted,
      rawImagesList
    };
  });

  // Process & Deduplicate all images outside browser context
  const finalImages = [];
  const seenImageBases = new Set();

  for (const item of data.rawImagesList) {
    let candidate = null;
    // Check srcset first for highest res
    if (item.srcset) {
      candidate = extractLargestFromSrcset(item.srcset);
    }
    if (!candidate && item.src) {
      candidate = item.src;
    }

    const cleaned = cleanGenericImageUrl(candidate);
    if (cleaned) {
      // Deduplicate by clean file base (strip dimensions / tokens)
      const baseKey = cleaned.split('?')[0].toLowerCase();
      if (!seenImageBases.has(baseKey)) {
        seenImageBases.add(baseKey);
        finalImages.push(cleaned);
      }
    }
  }

  log(`Extracted Site: "${data.title || 'Page'}" - Emails: ${data.emails.length}, Phones: ${data.phones.length}, HD Images Found: ${finalImages.length}`);

  return {
    sourceType: 'General Website',
    url,
    title: data.title,
    productName: data.title,
    company: data.company || 'Website Owner',
    email: data.emails[0] || null,
    emails: data.emails,
    phone: data.phones[0] || null,
    phones: data.phones,
    address: data.address,
    country: data.country || 'N/A',
    price: data.price,
    priceFormatted: data.priceFormatted,
    socials: data.socials,
    description: data.metaDesc,
    images: finalImages, // No artificial 15 limit!
    mainImage: finalImages[0] || null
  };
}

module.exports = { scrapeGenericWeb };
