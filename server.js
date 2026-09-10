const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { exec } = require('child_process');
const { ZipArchive } = require('archiver');
const { chromium } = require('playwright-chromium');

const { scrapeDaraz } = require('./extractors/daraz');
const { scrapeGoogleMaps } = require('./extractors/maps');
const { scrapeGenericWeb } = require('./extractors/generic');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/downloads', express.static(path.join(__dirname, 'downloads')));

const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

function detectSource(url) {
  if (!url) return 'generic';
  const u = url.toLowerCase();
  if (u.includes('daraz.pk') || u.includes('daraz.com') || u.includes('daraz.com.bd') || u.includes('daraz.com.np')) {
    return 'daraz';
  }
  if (u.includes('google.com/maps') || u.includes('maps.app.goo.gl') || u.includes('goo.gl/maps')) {
    return 'maps';
  }
  return 'generic';
}

app.post('/api/detect', (req, res) => {
  const { url } = req.body;
  const source = detectSource(url);
  res.json({ source });
});

function filterSelectedFields(data, selectedFields) {
  if (!data) return {};

  const filtered = {
    url: data.url || '',
    sourceType: data.sourceType || 'Web'
  };

  const fieldMap = {
    title: ['name', 'title', 'productName'],
    price: ['price', 'priceFormatted', 'originalPrice', 'originalPriceFormatted', 'discount'],
    emails: ['email', 'emails'],
    phones: ['phone', 'phones'],
    company: ['company', 'businessType'],
    country: ['country', 'address', 'city'],
    socials: ['website', 'socials'],
    description: ['description', 'specifications', 'variants', 'highlights', 'category', 'rating', 'reviews'],
    images: ['mainImage', 'images']
  };

  const defaultValues = {
    name: 'N/A',
    title: 'N/A',
    businessType: 'N/A',
    category: 'N/A',
    phone: 'N/A',
    email: 'N/A',
    website: 'N/A',
    company: 'N/A',
    address: 'N/A',
    city: 'N/A',
    country: 'Pakistan',
    rating: 'N/A',
    reviews: 'N/A'
  };

  Object.keys(data).forEach(k => {
    if (data[k] !== undefined && data[k] !== null) {
      filtered[k] = data[k];
    }
  });

  if (selectedFields && selectedFields.length > 0) {
    for (const sel of selectedFields) {
      const keys = fieldMap[sel] || [sel];
      for (const k of keys) {
        if (data[k] !== undefined && data[k] !== null && data[k] !== '') {
          filtered[k] = data[k];
        } else if (filtered[k] === undefined && defaultValues[k] !== undefined) {
          filtered[k] = defaultValues[k];
        }
      }
    }
  }

  ['name', 'title', 'businessType', 'phone', 'email', 'website', 'address', 'city', 'country'].forEach(k => {
    if (filtered[k] === undefined || filtered[k] === null || filtered[k] === '') {
      filtered[k] = defaultValues[k] || 'N/A';
    }
  });

  return filtered;
}

// Scrape with SSE Streaming
app.post('/api/scrape', async (req, res) => {
  const { urls, selectedFields } = req.body;

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'No URLs provided' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (type, data) => {
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent('log', { message: `🚀 Initializing scraper for ${urls.length} URL(s)...` });

  let browser = null;
  const results = [];

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      viewport: { width: 1440, height: 900 }
    });

    const page = await context.newPage();

    for (let i = 0; i < urls.length; i++) {
      const rawUrl = urls[i].trim();
      if (!rawUrl) continue;

      const currentIdx = i + 1;
      const detected = detectSource(rawUrl);

      sendEvent('log', { message: `[${currentIdx}/${urls.length}] Starting (${detected.toUpperCase()}): ${rawUrl}` });
      sendEvent('progress', { current: currentIdx, total: urls.length });

      try {
        let extractedRaw = null;
        const logFn = (msg) => sendEvent('log', { message: `  ↳ ${msg}` });

        if (detected === 'daraz') {
          extractedRaw = await scrapeDaraz(page, rawUrl, logFn);
        } else if (detected === 'maps') {
          extractedRaw = await scrapeGoogleMaps(page, rawUrl, logFn);
        } else {
          extractedRaw = await scrapeGenericWeb(page, rawUrl, logFn);
        }

        if (Array.isArray(extractedRaw)) {
          for (let j = 0; j < extractedRaw.length; j++) {
            const item = extractedRaw[j];
            const filtered = filterSelectedFields(item, selectedFields);
            results.push(filtered);
            sendEvent('item', { item: filtered, index: results.length });
          }
          sendEvent('log', { message: `✅ Finished scraping ${extractedRaw.length} profile(s) from ${rawUrl}` });
        } else if (extractedRaw) {
          const filtered = filterSelectedFields(extractedRaw, selectedFields);
          results.push(filtered);
          sendEvent('item', { item: filtered, index: results.length });
          sendEvent('log', { message: `✅ Finished: ${extractedRaw.title || extractedRaw.name || rawUrl}` });
        }
      } catch (err) {
        sendEvent('log', { message: `❌ [${currentIdx}/${urls.length}] Error on ${rawUrl}: ${err.message}` });
        results.push({ url: rawUrl, error: err.message });
      }

      await page.waitForTimeout(1000);
    }

    await page.close();
    await browser.close();

    sendEvent('log', { message: `🎉 Scraping completed! Total successfully processed: ${results.length}` });
    sendEvent('done', { results });
    res.end();
  } catch (fatalErr) {
    sendEvent('log', { message: `💥 Fatal error: ${fatalErr.message}` });
    if (browser) await browser.close().catch(() => {});
    res.end();
  }
});

// Helper: Download buffer with fallback
function fetchImageBuffer(url) {
  return new Promise((resolve, reject) => {
    const fullUrl = url.startsWith('//') ? 'https:' + url : url;
    const client = fullUrl.startsWith('https') ? https : http;

    const req = client.get(
      fullUrl,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
          Referer: fullUrl
        },
        timeout: 18000
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchImageBuffer(res.headers.location).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Failed with status ${res.statusCode}`));
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Download timeout'));
    });
  });
}

// API: Single Image Direct Download Proxy (Forces browser save without new tab)
app.get('/api/download-single', async (req, res) => {
  const { url, name } = req.query;
  if (!url) return res.status(400).send('Missing url');

  try {
    const buffer = await fetchImageBuffer(url);
    const filename = name || 'image.jpg';
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(buffer);
  } catch (err) {
    res.redirect(url);
  }
});

// API: Save Images Directly to Custom Folder on PC and Open in Explorer
app.post('/api/save-local', async (req, res) => {
  const { images, customPath, folderName } = req.body;
  if (!images || !Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: 'No images provided' });
  }

  const safeName = (folderName || 'scraped_images').replace(/[^a-z0-9_-]+/gi, '_').slice(0, 40);
  let targetFolder = customPath ? customPath.trim() : null;

  if (!targetFolder) {
    const userProfile = process.env.USERPROFILE || 'C:\\Users\\Darulsolutions';
    targetFolder = path.join(userProfile, 'Downloads', safeName);
  }

  try {
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }

    let savedCount = 0;
    const chunkSize = 8;
    for (let i = 0; i < images.length; i += chunkSize) {
      const chunk = images.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(async (imgUrl, cIdx) => {
          const idx = i + cIdx + 1;
          const ext = (imgUrl.split('?')[0].match(/\.(jpg|jpeg|png|webp)/i) || ['', 'jpg'])[1];
          const filePath = path.join(targetFolder, `image_${String(idx).padStart(3, '0')}.${ext}`);
          try {
            const buf = await fetchImageBuffer(imgUrl);
            fs.writeFileSync(filePath, buf);
            savedCount++;
          } catch (e) {}
        })
      );
    }

    // Automatically open the folder in Windows File Explorer
    exec(`explorer.exe "${targetFolder}"`, () => {});

    res.json({ success: true, folderPath: targetFolder, totalSaved: savedCount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Export All Images as ZIP
app.post('/api/export/zip', async (req, res) => {
  const { images, prefix = 'image' } = req.body;

  if (!images || !Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: 'No images provided for download' });
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename=scraped_images_${Date.now()}.zip`);

  const archive = new ZipArchive({ zlib: { level: 4 } });

  archive.on('error', (err) => {
    console.error('Archive error:', err);
    if (!res.headersSent) res.status(500).send({ error: err.message });
  });

  archive.pipe(res);

  // Parallel download in chunks of 8
  const chunkSize = 8;
  for (let i = 0; i < images.length; i += chunkSize) {
    const chunk = images.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (imgUrl, cIdx) => {
        const globalIdx = i + cIdx + 1;
        const ext = (imgUrl.split('?')[0].match(/\.(jpg|jpeg|png|webp)/i) || ['', 'jpg'])[1];
        const filename = `${prefix}_${String(globalIdx).padStart(3, '0')}.${ext}`;

        try {
          const buffer = await fetchImageBuffer(imgUrl);
          archive.append(buffer, { name: filename });
        } catch (err) {}
      })
    );
  }

  await archive.finalize();
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🌐 Universal Scraper Tool (OmniScrape) Running!`);
  console.log(`👉 Open in your browser: http://localhost:${PORT}`);
  console.log(`====================================================`);
});
