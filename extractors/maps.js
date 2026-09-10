/**
 * Google Maps Extractor Module (Enhanced for Multi-Listing Search & Individual Business Profiles)
 * Extracts Name, Business Type / Category, Phone, Email, Address, City, Country, Website, Rating, Reviews, and Images
 */

async function extractEmailFromWebsite(websiteUrl) {
  if (!websiteUrl || typeof websiteUrl !== 'string' || !websiteUrl.startsWith('http')) return 'N/A';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(websiteUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
      }
    });
    clearTimeout(timer);
    if (!res.ok) return 'N/A';
    const html = await res.text();

    // Look for mailto: links first
    const mailtoMatches = html.match(/href=["']mailto:([^"'?]+)["']/gi);
    if (mailtoMatches && mailtoMatches.length > 0) {
      const email = mailtoMatches[0].replace(/href=["']mailto:/i, '').replace(/["'].*$/, '').trim();
      if (email && email.includes('@') && !email.endsWith('.png') && !email.endsWith('.jpg') && !email.endsWith('.webp')) {
        return email;
      }
    }

    // Fallback regex match for emails
    const emails = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
    if (emails && emails.length > 0) {
      const valid = emails.find(e => 
        !e.endsWith('.png') && !e.endsWith('.jpg') && !e.endsWith('.webp') && !e.endsWith('.svg') &&
        !e.includes('sentry') && !e.includes('example.com') && !e.includes('domain.com') &&
        !e.includes('schema.org') && !e.includes('wixpress.com') && !e.includes('git@')
      );
      if (valid) return valid;
    }
  } catch (e) {}
  return 'N/A';
}

function extractCityAndCountry(address, queryUrl) {
  let city = 'N/A';
  let country = 'Pakistan';

  if (address && address !== 'N/A') {
    const parts = address.split(',').map(s => s.trim());
    if (parts.length >= 2) {
      city = parts[parts.length - 2].replace(/[0-9\-]/g, '').trim() || parts[0];
      country = parts[parts.length - 1].replace(/[0-9\-]/g, '').trim() || 'Pakistan';
    } else if (parts.length === 1) {
      city = parts[0];
    }
  }

  if ((city === 'N/A' || city.length < 2) && queryUrl) {
    const match = queryUrl.match(/search\/([^\/]+)/i);
    if (match) {
      const q = decodeURIComponent(match[1]).replace(/\+/g, ' ');
      if (q.toLowerCase().includes('islamabad')) city = 'Islamabad';
      else if (q.toLowerCase().includes('karachi')) city = 'Karachi';
      else if (q.toLowerCase().includes('lahore')) city = 'Lahore';
      else if (q.toLowerCase().includes('rawalpindi')) city = 'Rawalpindi';
      else if (q.toLowerCase().includes('peshawar')) city = 'Peshawar';
      else if (q.toLowerCase().includes('multan')) city = 'Multan';
      else if (q.toLowerCase().includes('faisalabad')) city = 'Faisalabad';
      else if (q.toLowerCase().includes('quetta')) city = 'Quetta';
    }
  }

  return { city: city || 'N/A', country: country || 'Pakistan' };
}

async function extractSinglePlaceDetails(page, placeUrl, log) {
  if (placeUrl && placeUrl !== page.url()) {
    await page.goto(placeUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(2000);
  }

  await page.waitForSelector('h1', { timeout: 10000 }).catch(() => {});

  const rawData = await page.evaluate(() => {
    const nameEl = document.querySelector('h1.DUwDvf') || document.querySelector('h1');
    const name = nameEl ? nameEl.textContent.trim() : null;

    if (!name || name === 'Results' || name === 'Search') return null;

    const ratingEl = document.querySelector('span.ceNzKf') || document.querySelector('div.F7nice span[aria-hidden="true"]');
    const rating = ratingEl ? ratingEl.textContent.trim() : 'N/A';

    const reviewsEl = document.querySelector('div.F7nice span span span') || document.querySelector('span[aria-label*="reviews"]');
    const reviews = reviewsEl ? reviewsEl.textContent.replace(/[^0-9,]/g, '').trim() : 'N/A';

    const categoryEl = document.querySelector('button.DkEaL') || document.querySelector('span.DkEaL') || document.querySelector('button[jsaction*="category"]');
    const category = categoryEl ? categoryEl.textContent.trim() : 'N/A';

    let phone = 'N/A';
    let website = 'N/A';
    let address = 'N/A';
    let hours = 'N/A';

    const infoItems = document.querySelectorAll('button[data-item-id], a[data-item-id]');
    infoItems.forEach(item => {
      const itemId = item.getAttribute('data-item-id') || '';
      const text = item.textContent.trim();
      const aria = item.getAttribute('aria-label') || '';

      if (itemId.includes('phone') || aria.includes('Phone:') || /[\+\(]?[0-9\s\-\(\)]{8,}/.test(text)) {
        if (phone === 'N/A' && text) phone = text.replace(/^Phone:\s*/i, '').trim();
      } else if (itemId.includes('authority') || (item.href && item.href.includes('http') && !item.href.includes('google.com'))) {
        if (website === 'N/A') website = item.href || text;
      } else if (itemId.includes('address') || aria.includes('Address:')) {
        if (address === 'N/A') address = text.replace(/^Address:\s*/i, '').trim();
      } else if (itemId.includes('oh') || aria.includes('Hours:')) {
        if (hours === 'N/A') hours = text;
      }
    });

    if (address === 'N/A') {
      const addrEl = document.querySelector('button[data-tooltip*="address"], button[aria-label*="Address"]');
      if (addrEl) address = addrEl.textContent.replace(/^Address:\s*/i, '').trim();
    }

    if (phone === 'N/A') {
      const phoneEl = document.querySelector('button[data-tooltip*="phone"], button[aria-label*="Phone"]');
      if (phoneEl) phone = phoneEl.textContent.replace(/^Phone:\s*/i, '').trim();
    }

    const images = [];
    document.querySelectorAll('button[aria-label*="Photo"] img, div[role="region"] img, img.m6QErb').forEach(img => {
      const src = img.src || img.getAttribute('data-src');
      if (src && src.startsWith('http') && !src.includes('streetviewpixels') && !src.includes('maps/vt')) {
        images.push(src);
      }
    });

    return {
      name,
      rating,
      reviews,
      category,
      phone,
      website,
      address,
      hours,
      images: Array.from(new Set(images)).slice(0, 10)
    };
  });

  if (!rawData || !rawData.name) return null;

  let email = 'N/A';
  if (rawData.website && rawData.website !== 'N/A') {
    log(`  🔎 Inspecting website (${rawData.website}) for contact email...`);
    email = await extractEmailFromWebsite(rawData.website);
  }

  const { city, country } = extractCityAndCountry(rawData.address, placeUrl);

  return {
    sourceType: 'Google Maps',
    url: placeUrl || page.url(),
    name: rawData.name,
    title: rawData.name,
    productName: rawData.name,
    company: rawData.name,
    businessType: rawData.category,
    category: rawData.category,
    phone: rawData.phone,
    phones: rawData.phone !== 'N/A' ? [rawData.phone] : [],
    email: email,
    emails: email !== 'N/A' ? [email] : [],
    website: rawData.website,
    address: rawData.address,
    city: city,
    country: country,
    rating: rawData.rating,
    reviews: rawData.reviews,
    description: `Google Maps Business: ${rawData.name}. Category: ${rawData.category}. Rating: ${rawData.rating} (${rawData.reviews} reviews). Address: ${rawData.address}. Phone: ${rawData.phone}. Email: ${email}`,
    specifications: {
      "Business Name": rawData.name,
      "Category": rawData.category,
      "Phone": rawData.phone,
      "Email": email,
      "Address": rawData.address,
      "City": city,
      "Country": country,
      "Website": rawData.website,
      "Google Rating": rawData.rating,
      "Total Reviews": rawData.reviews
    },
    images: rawData.images,
    mainImage: rawData.images[0] || null
  };
}

async function scrapeGoogleMaps(page, url, log) {
  log(`Opening Google Maps: ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(3000);

  try {
    const consentBtn = await page.$('button[aria-label*="Accept"], form[action*="consent"] button, button:has-text("Accept all")');
    if (consentBtn) {
      await consentBtn.click();
      await page.waitForTimeout(1000);
    }
  } catch (e) {}

  const isSearchPage = await page.evaluate(() => {
    return !!document.querySelector('div[role="feed"]');
  });

  if (isSearchPage) {
    log('Detected Google Maps Search Results Feed. Scrolling to load listings...');
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => {
        const feed = document.querySelector('div[role="feed"]');
        if (feed) feed.scrollBy(0, 1200);
      });
      await page.waitForTimeout(1000);
    }

    const placeLinks = await page.evaluate(() => {
      const feed = document.querySelector('div[role="feed"]');
      if (!feed) return [];
      const anchors = feed.querySelectorAll('a[href*="/maps/place/"]');
      const links = [];
      anchors.forEach(a => {
        if (a.href && !links.includes(a.href)) links.push(a.href);
      });
      return links;
    });

    log(`Found ${placeLinks.length} business profile(s) in search results. Extracting 1-by-1...`);

    const placeResults = [];
    const maxPlaces = Math.min(placeLinks.length, 25);

    for (let k = 0; k < maxPlaces; k++) {
      const pUrl = placeLinks[k];
      const placeNameGuess = pUrl.split('/maps/place/')[1]?.split('/')[0]?.replace(/\+/g, ' ') || `Business ${k + 1}`;
      log(`[${k + 1}/${maxPlaces}] Extracting: ${decodeURIComponent(placeNameGuess)}`);
      try {
        const itemData = await extractSinglePlaceDetails(page, pUrl, log);
        if (itemData) {
          placeResults.push(itemData);
          log(`  ✓ Extracted: "${itemData.name}" | Phone: ${itemData.phone} | Email: ${itemData.email} | City: ${itemData.city}`);
        }
      } catch (err) {
        log(`  ❌ Error on ${pUrl}: ${err.message}`);
      }
      await page.waitForTimeout(800);
    }

    return placeResults;
  } else {
    log('Extracting single Google Maps place profile...');
    const singleData = await extractSinglePlaceDetails(page, url, log);
    return singleData ? [singleData] : [];
  }
}

module.exports = { scrapeGoogleMaps };
