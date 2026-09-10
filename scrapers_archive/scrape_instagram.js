const { chromium } = require('playwright-chromium');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const IG_URL = 'https://www.instagram.com/haanim.accessories/';
const IG_DIR = path.join(__dirname, 'public', 'instagram');
const DATA_FILE = path.join(__dirname, 'src', 'data', 'instagram.json');

if (!fs.existsSync(IG_DIR)) {
  fs.mkdirSync(IG_DIR, { recursive: true });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed with status ${res.statusCode}`));
      }
      const fileStream = fs.createWriteStream(destPath);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        resolve(destPath);
      });
      fileStream.on('error', reject);
    }).on('error', reject);
  });
}

(async () => {
  console.log('Launching browser to inspect Instagram profile...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 }
  });
  const page = await context.newPage();

  try {
    console.log('Navigating to:', IG_URL);
    await page.goto(IG_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Grab profile info
    const profileData = await page.evaluate(() => {
      const title = document.title;
      const metaDesc = document.querySelector('meta[name="description"]')?.content || '';
      
      // Look for bio
      const header = document.querySelector('header');
      const bioText = header ? header.innerText : '';

      // Look for links to posts / reels
      const postElements = Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]'));
      const items = [];
      const seen = new Set();

      for (const a of postElements) {
        const href = a.href;
        if (seen.has(href)) continue;
        seen.add(href);

        const img = a.querySelector('img');
        if (img && img.src) {
          items.push({
            url: href,
            imageSrc: img.src,
            alt: img.alt || 'Hanim Accessories Bracelet Post'
          });
        }
      }

      return {
        title,
        metaDesc,
        bioText,
        items
      };
    });

    console.log('Found profile title:', profileData.title);
    console.log('Found posts count:', profileData.items.length);

    // If Instagram login wall blocked posts, check page content or screenshots
    if (profileData.items.length === 0) {
      console.log('Checking if login wall is present...');
      const html = await page.content();
      fs.writeFileSync(path.join(__dirname, 'ig_debug.html'), html.slice(0, 5000));
    } else {
      // Download post images locally
      const savedItems = [];
      for (let i = 0; i < Math.min(profileData.items.length, 8); i++) {
        const item = profileData.items[i];
        const ext = '.jpg';
        const filename = `post_${i + 1}${ext}`;
        const localPath = path.join(IG_DIR, filename);
        const relPath = `public/instagram/${filename}`;

        try {
          console.log(`Downloading post ${i + 1}:`, item.url);
          await downloadFile(item.imageSrc, localPath);
          savedItems.push({
            postUrl: item.url,
            localImage: relPath,
            alt: item.alt
          });
        } catch (err) {
          console.warn(`Could not download image ${i + 1}:`, err.message);
          savedItems.push({
            postUrl: item.url,
            localImage: item.imageSrc,
            alt: item.alt
          });
        }
      }

      const finalData = {
        username: 'haanim.accessories',
        url: IG_URL,
        title: profileData.title,
        bio: profileData.bioText,
        posts: savedItems
      };

      fs.writeFileSync(DATA_FILE, JSON.stringify(finalData, null, 2), 'utf8');
      console.log('Successfully saved Instagram data to:', DATA_FILE);
    }

  } catch (err) {
    console.error('Error during Instagram scrape:', err.message);
  } finally {
    await browser.close();
  }
})();
