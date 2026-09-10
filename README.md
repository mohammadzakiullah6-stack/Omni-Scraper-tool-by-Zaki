# OmniScrape PRO • by Zaki 🚀
> **Universal Multi-Source Web, E-Commerce & Lead Extractor**  
> Supports General Websites (Shopify, WordPress, etc.), Daraz.pk, and Google Maps with selective data extraction.

![OmniScrape Banner](public/style.css)

---

## 🌟 Key Features

- **Multi-Source Support:**
  - 🌐 **Any Website (Shopify, WooCommerce, Custom):** Deep lazy-load scrolling, `srcset` high-resolution master image discovery, price, specs, description extraction.
  - 🛍️ **Daraz Store & Product Pages:** Genuine titles, prices, discounts, variants, specifications, and full HD image galleries.
  - 📍 **Google Maps Places & Businesses:** Business name, rating, phone numbers, full address, website, and photos.
- **Selective Field Scraping:** Choose only what you need (Title, Price, Emails, Phone Numbers, Company, Country/Address, Social Links, Description, High-Res Images).
- **Direct PC Folder Saving:** Choose any folder on your computer (e.g. `D:\Scraped_Images`, `Downloads`, `Desktop`) to save all images in bulk, automatically popping open Windows File Explorer when complete.
- **Single Image Instant Download:** Click `Save ⬇` on any image card to download directly without annoying new tabs.
- **1-Click Bulk Exports:** Instant ZIP archive creation, plus UTF-8 formatted CSV and clean JSON exports directly in browser.
- **Live Playwright Terminal:** Real-time Server-Sent Events (SSE) streaming progress bar and live execution logs.
- **1-Click Launcher:** Includes `start.bat` for instant startup on Windows.

---

## 🛠️ Tech Stack

- **Backend:** Node.js, Express, Playwright Chromium, Archiver
- **Frontend:** Vanilla JavaScript, Modern CSS Glassmorphism, Responsive Dark UI
- **Real-time Protocol:** Server-Sent Events (SSE)

---

## 🚀 Quick Start

### 1. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/mohammadzakiullah6-stack/Omni-Scraper-tool-by-Zaki.git
cd Omni-Scraper-tool-by-Zaki
npm install
```

Install Playwright Chromium browser binaries (if running for the first time):
```bash
npx playwright install chromium
```

### 2. Run the Server
```bash
node server.js
```
*Or on Windows, simply double-click `start.bat`.*

### 3. Open in Browser
Visit:
```
http://localhost:4000
```

---

## 💻 Usage

1. **Enter URL:** Paste any target webpage, Daraz store, or Google Maps URL.
2. **Select Fields:** Check or uncheck fields you need (Phone, Email, Images, Price, etc.).
3. **Click Start Scraping:** Watch real-time extraction in the live console.
4. **Export Your Data:**
   - Click **Save to PC Folder** to write directly to your local drive.
   - Click **Download ZIP** for a zipped image bundle.
   - Click **Export CSV** or **Export JSON** for tabular data.

---

## 👤 Author
Developed with ❤️ by **Zaki**  
GitHub: [@mohammadzakiullah6-stack](https://github.com/mohammadzakiullah6-stack)
