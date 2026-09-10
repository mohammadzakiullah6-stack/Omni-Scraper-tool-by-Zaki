const { chromium } = require('playwright-chromium');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const url = 'https://www.google.com/maps/search/spa+in+islamabad/@33.6955701,72.9802812,13z/data=!4m2!2m1!6e1?entry=ttu&g_ep=EgoyMDI2MDkwNi4wASAFQAw%3D%3D';
  console.log('Navigating to Google Maps search...');
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(4000);

  const feedExists = await page.evaluate(() => !!document.querySelector('div[role="feed"]'));
  console.log('Feed exists:', feedExists);

  if (feedExists) {
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        const feed = document.querySelector('div[role="feed"]');
        if (feed) feed.scrollBy(0, 1000);
      });
      await page.waitForTimeout(1000);
    }

    const links = await page.evaluate(() => {
      const feed = document.querySelector('div[role="feed"]');
      if (!feed) return [];
      const anchors = feed.querySelectorAll('a[href*="/maps/place/"]');
      const res = [];
      anchors.forEach(a => {
        if (a.href && !res.includes(a.href)) res.push(a.href);
      });
      return res;
    });

    console.log('Found place links count:', links.length);
    if (links.length > 0) {
      console.log('First 3 place links:');
      links.slice(0, 3).forEach(l => console.log(' - ' + l));
    }
  }

  await browser.close();
})();
