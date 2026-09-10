/**
 * Google Maps Extractor Module
 * Extracts business details, phones, websites, addresses, reviews, and ratings
 */

async function scrapeGoogleMaps(page, url, log) {
  log(`Opening Google Maps: ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

  // Handle Google consent / cookie dialog if present
  try {
    const consentBtn = await page.$('button[aria-label*="Accept"], form[action*="consent"] button, button:has-text("Accept all")');
    if (consentBtn) {
      await consentBtn.click();
      await page.waitForTimeout(1000);
    }
  } catch (e) {}

  log('Waiting for place details panel...');
  // Wait for the main heading or container
  await page.waitForSelector('h1, div[role="main"]', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);

  const data = await page.evaluate(() => {
    // Business Name
    const nameEl = document.querySelector('h1.DUwDvf') || document.querySelector('h1');
    const name = nameEl ? nameEl.textContent.trim() : null;

    // Rating & Review count
    const ratingEl = document.querySelector('span.ceNzKf') || document.querySelector('div.F7nice span[aria-hidden="true"]');
    const rating = ratingEl ? ratingEl.textContent.trim() : null;

    const reviewsEl = document.querySelector('div.F7nice span span span') || document.querySelector('span[aria-label*="reviews"]');
    const reviews = reviewsEl ? reviewsEl.textContent.replace(/[^0-9,]/g, '').trim() : null;

    // Category
    const categoryEl = document.querySelector('button.DkEaL') || document.querySelector('span.DkEaL');
    const category = categoryEl ? categoryEl.textContent.trim() : null;

    // Contact info buttons and rows
    let phone = null;
    let website = null;
    let address = null;
    let hours = null;

    // Loop all buttons/links in info panel
    const infoItems = document.querySelectorAll('button[data-item-id], a[data-item-id]');
    infoItems.forEach(item => {
      const itemId = item.getAttribute('data-item-id') || '';
      const text = item.textContent.trim();
      const aria = item.getAttribute('aria-label') || '';

      if (itemId.includes('phone') || aria.includes('Phone:') || /[\+\(]?[0-9\s\-\(\)]{8,}/.test(text)) {
        if (!phone && text) phone = text.replace(/^Phone:\s*/i, '');
      } else if (itemId.includes('authority') || item.href && item.href.includes('http') && !item.href.includes('google.com')) {
        if (!website) website = item.href || text;
      } else if (itemId.includes('address') || aria.includes('Address:')) {
        if (!address) address = text.replace(/^Address:\s*/i, '');
      } else if (itemId.includes('oh') || aria.includes('Hours:')) {
        if (!hours) hours = text;
      }
    });

    // Fallback search in document for address
    if (!address) {
      const addrEl = document.querySelector('button[data-tooltip*="address"], button[aria-label*="Address"]');
      if (addrEl) address = addrEl.textContent.trim();
    }

    // Photos
    const images = [];
    document.querySelectorAll('button[aria-label*="Photo"] img, div[role="region"] img, img.m6QErb').forEach(img => {
      const src = img.src || img.getAttribute('data-src');
      if (src && src.startsWith('http') && !src.includes('streetviewpixels') && !src.includes('maps/vt')) {
        images.push(src);
      }
    });

    // Extract country from address if possible
    let country = null;
    if (address) {
      const parts = address.split(',').map(s => s.trim());
      if (parts.length > 1) {
        country = parts[parts.length - 1].replace(/[0-9\-]/g, '').trim();
      }
    }

    return {
      name,
      rating,
      reviews,
      category,
      phone,
      website,
      address,
      country,
      hours,
      images: Array.from(new Set(images)).slice(0, 10)
    };
  });

  log(`Extracted Google Maps place: "${data.name || 'Business'}" - Phone: ${data.phone || 'N/A'}, Website: ${data.website || 'N/A'}`);

  return {
    sourceType: 'Google Maps',
    url,
    title: data.name,
    productName: data.name,
    company: data.name,
    phone: data.phone,
    phones: data.phone ? [data.phone] : [],
    email: null,
    emails: [],
    website: data.website,
    address: data.address,
    country: data.country || 'Detected from Maps',
    rating: data.rating,
    reviews: data.reviews,
    category: data.category,
    description: `Google Maps Place: ${data.name || ''}. Rating: ${data.rating || 'N/A'} (${data.reviews || 0} reviews). Category: ${data.category || 'Business'}. Address: ${data.address || 'N/A'}`,
    specifications: {
      "Google Rating": data.rating || 'N/A',
      "Total Reviews": data.reviews || 'N/A',
      "Category": data.category || 'N/A',
      "Address": data.address || 'N/A',
      "Website": data.website || 'N/A'
    },
    images: data.images,
    mainImage: data.images[0] || null
  };
}

module.exports = { scrapeGoogleMaps };
