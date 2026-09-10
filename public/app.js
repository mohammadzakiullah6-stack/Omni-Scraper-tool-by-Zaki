// OmniScrape Client-Side Application Logic (Fast Client Exports & Direct Downloads)

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const urlInput = document.getElementById('urlInput');
  const batchUrlInput = document.getElementById('batchUrlInput');
  const detectedBadge = document.getElementById('detectedBadge');
  const detectedText = document.getElementById('detectedText');
  const singleModeBtn = document.getElementById('singleModeBtn');
  const batchModeBtn = document.getElementById('batchModeBtn');
  const singleUrlContainer = document.getElementById('singleUrlContainer');
  const batchUrlContainer = document.getElementById('batchUrlContainer');

  const selectAllBtn = document.getElementById('selectAllBtn');
  const unselectAllBtn = document.getElementById('unselectAllBtn');
  const fieldCards = document.querySelectorAll('.field-card');
  const startScrapeBtn = document.getElementById('startScrapeBtn');
  const clearBtn = document.getElementById('clearBtn');

  const consoleSection = document.getElementById('consoleSection');
  const consoleLog = document.getElementById('consoleLog');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');

  const resultsSection = document.getElementById('resultsSection');
  const resultsCount = document.getElementById('resultsCount');
  const tableHead = document.getElementById('tableHead');
  const tableBody = document.getElementById('tableBody');
  const galleryGrid = document.getElementById('galleryGrid');
  const jsonCode = document.getElementById('jsonCode');
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const exportJsonBtn = document.getElementById('exportJsonBtn');
  const exportZipBtn = document.getElementById('exportZipBtn');
  const saveLocalBtn = document.getElementById('saveLocalBtn');

  let currentMode = 'single'; // 'single' or 'batch'
  let scrapedResults = [];

  // Auto-Detect Source
  function updateDetectedSource(url) {
    if (!url) {
      detectedBadge.className = 'detected-badge';
      detectedText.textContent = 'Auto-Detect';
      return;
    }
    const u = url.toLowerCase();
    if (u.includes('daraz.pk') || u.includes('daraz.com')) {
      detectedBadge.className = 'detected-badge daraz';
      detectedText.textContent = 'Daraz';
    } else if (u.includes('google.com/maps') || u.includes('maps.app.goo.gl')) {
      detectedBadge.className = 'detected-badge maps';
      detectedText.textContent = 'Google Maps';
    } else if (u.startsWith('http://') || u.startsWith('https://')) {
      detectedBadge.className = 'detected-badge generic';
      detectedText.textContent = 'Website';
    } else {
      detectedBadge.className = 'detected-badge';
      detectedText.textContent = 'Auto-Detect';
    }
  }

  urlInput.addEventListener('input', (e) => {
    updateDetectedSource(e.target.value.trim());
  });

  // Mode Toggle
  singleModeBtn.addEventListener('click', () => {
    currentMode = 'single';
    singleModeBtn.classList.add('active');
    batchModeBtn.classList.remove('active');
    singleUrlContainer.style.display = 'block';
    batchUrlContainer.style.display = 'none';
  });

  batchModeBtn.addEventListener('click', () => {
    currentMode = 'batch';
    batchModeBtn.classList.add('active');
    singleModeBtn.classList.remove('active');
    singleUrlContainer.style.display = 'none';
    batchUrlContainer.style.display = 'block';
  });

  // Field Selection
  fieldCards.forEach((card) => {
    card.addEventListener('click', (e) => {
      const checkbox = card.querySelector('input[type="checkbox"]');
      if (e.target !== checkbox) {
        checkbox.checked = !checkbox.checked;
      }
      if (checkbox.checked) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });
  });

  selectAllBtn.addEventListener('click', () => {
    fieldCards.forEach((card) => {
      const checkbox = card.querySelector('input[type="checkbox"]');
      checkbox.checked = true;
      card.classList.add('active');
    });
  });

  unselectAllBtn.addEventListener('click', () => {
    fieldCards.forEach((card) => {
      const checkbox = card.querySelector('input[type="checkbox"]');
      checkbox.checked = false;
      card.classList.remove('active');
    });
  });

  function getSelectedFields() {
    const selected = [];
    document.querySelectorAll('.field-card input[type="checkbox"]:checked').forEach((cb) => {
      selected.push(cb.value);
    });
    return selected;
  }

  function addLog(msg) {
    const line = document.createElement('div');
    line.className = 'log-line';
    line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    consoleLog.appendChild(line);
    consoleLog.scrollTop = consoleLog.scrollHeight;
  }

  clearBtn.addEventListener('click', () => {
    urlInput.value = '';
    batchUrlInput.value = '';
    updateDetectedSource('');
    consoleLog.innerHTML = '';
    consoleSection.style.display = 'none';
    resultsSection.style.display = 'none';
    scrapedResults = [];
  });

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabBtns.forEach((b) => b.classList.remove('active'));
      tabContents.forEach((c) => c.classList.remove('active'));

      btn.classList.add('active');
      const targetTab = btn.getAttribute('data-tab');
      document.getElementById(`${targetTab}Tab`).classList.add('active');
    });
  });

  function renderTable(results) {
    if (!results || results.length === 0) {
      tableHead.innerHTML = '';
      tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No data extracted.</td></tr>';
      return;
    }

    const preferredOrder = [
      { key: 'name', alt: ['title', 'productName'], label: 'Name / Business' },
      { key: 'businessType', alt: ['category'], label: 'Business Type / Category' },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email' },
      { key: 'address', label: 'Address' },
      { key: 'city', label: 'City' },
      { key: 'country', label: 'Country' },
      { key: 'website', label: 'Website' },
      { key: 'rating', label: 'Rating' },
      { key: 'reviews', label: 'Reviews' }
    ];

    const keysInUse = new Set();
    results.forEach((r) => Object.keys(r).forEach((k) => keysInUse.add(k)));

    const activeCols = [];
    preferredOrder.forEach((col) => {
      if (keysInUse.has(col.key) || (col.alt && col.alt.some((a) => keysInUse.has(a)))) {
        activeCols.push(col);
      }
    });

    keysInUse.forEach((k) => {
      if (!['sourceType', 'url', 'images', 'rawImages', 'mainImage'].includes(k) && !activeCols.some((c) => c.key === k || (c.alt && c.alt.includes(k)))) {
        activeCols.push({ key: k, label: k.charAt(0).toUpperCase() + k.slice(1) });
      }
    });

    const headers = ['Source', ...activeCols.map((c) => c.label), 'Images', 'Action'];
    tableHead.innerHTML = `<tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr>`;

    tableBody.innerHTML = results
      .map((item) => {
        const sourceName = item.sourceType || 'Web';
        const sourceClass = sourceName === 'Daraz' ? 'daraz' : sourceName === 'Google Maps' ? 'maps' : 'web';

        const colsHtml = activeCols
          .map((col) => {
            let val = item[col.key];
            if ((val === undefined || val === null || val === '') && col.alt) {
              for (const a of col.alt) {
                if (item[a]) { val = item[a]; break; }
              }
            }
            if (val === undefined || val === null || val === '' || val === 'null') {
              return '<td><span style="color:#6B7280;font-style:italic;">N/A</span></td>';
            }
            if (Array.isArray(val)) {
              return `<td>${val.slice(0, 3).join('<br>')}${val.length > 3 ? `<br><small style="color:#6366F1;">+${val.length - 3} more</small>` : ''}</td>`;
            }
            if (typeof val === 'object') {
              return `<td><pre style="font-size:11px;max-height:80px;overflow:hidden;">${JSON.stringify(val, null, 1)}</pre></td>`;
            }
            if (col.key === 'website' && String(val).startsWith('http')) {
              return `<td><a href="${val}" target="_blank" style="color:#3897f0;text-decoration:underline;">${val.replace(/^https?:\/\//, '').slice(0, 25)}...</a></td>`;
            }
            if (col.key === 'email' && val !== 'N/A') {
              return `<td><span style="color:#10B981;font-weight:600;">${val}</span></td>`;
            }
            if (col.key === 'phone' && val !== 'N/A') {
              return `<td><span style="color:#F59E0B;font-weight:600;">${val}</span></td>`;
            }
            return `<td>${val}</td>`;
          })
          .join('');

        return `
        <tr>
          <td><span class="badge badge-${sourceClass}">${sourceName}</span></td>
          ${colsHtml}
          <td>${(item.images && item.images.length) || 0} imgs</td>
          <td><a href="${item.url}" target="_blank" style="color:#6366F1;text-decoration:none;font-weight:600;">Visit ↗</a></td>
        </tr>
      `;
      })
      .join('');
  }

  // Render Image Gallery with Direct Download Action
  function renderGallery(results) {
    galleryGrid.innerHTML = '';
    const allImgs = [];
    results.forEach((item) => {
      const imgs = item.images || [];
      imgs.forEach((imgUrl) => {
        if (!allImgs.some((i) => i.url === imgUrl)) {
          allImgs.push({ url: imgUrl, title: item.title || item.productName || item.name || 'Image' });
        }
      });
    });

    if (allImgs.length === 0) {
      galleryGrid.innerHTML = '<p style="color:#9CA3AF;grid-column:1/-1;text-align:center;padding:40px;">No images extracted.</p>';
      return;
    }

    const bar = document.createElement('div');
    bar.style.cssText = 'grid-column: 1 / -1; display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;';
    bar.innerHTML = `
      <span style="font-size:13px;color:#9CA3AF;">Found <strong>${allImgs.length}</strong> HD product & content images</span>
    `;
    galleryGrid.appendChild(bar);

    allImgs.forEach((imgItem, idx) => {
      const card = document.createElement('div');
      card.className = 'gallery-card';
      const downloadProxyUrl = `/api/download-single?url=${encodeURIComponent(imgItem.url)}&name=image_${idx + 1}.jpg`;

      card.innerHTML = `
        <img src="${imgItem.url}" alt="Scraped Image" loading="lazy" onerror="this.src='https://via.placeholder.com/200x200?text=Image+Load+Error'">
        <div class="gallery-info">
          <span style="max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${imgItem.title}">${imgItem.title}</span>
          <a href="${downloadProxyUrl}" style="background:rgba(255,255,255,0.08);padding:3px 8px;border-radius:4px;color:#34D399;text-decoration:none;font-weight:600;">Save ⬇</a>
        </div>
      `;
      galleryGrid.appendChild(card);
    });
  }

  function renderJSON(results) {
    jsonCode.textContent = JSON.stringify(results, null, 2);
  }

  // Start Scraper
  startScrapeBtn.addEventListener('click', async () => {
    let urls = [];
    if (currentMode === 'single') {
      const u = urlInput.value.trim();
      if (!u) {
        alert('Please enter a target URL to scrape.');
        return;
      }
      urls.push(u);
    } else {
      urls = batchUrlInput.value
        .split('\n')
        .map((u) => u.trim())
        .filter((u) => u.length > 0);
      if (urls.length === 0) {
        alert('Please enter at least one URL in the batch area.');
        return;
      }
    }

    const selectedFields = getSelectedFields();
    if (selectedFields.length === 0) {
      alert('Please select at least one field to extract.');
      return;
    }

    startScrapeBtn.disabled = true;
    startScrapeBtn.innerHTML = `Scraping in progress...`;

    consoleSection.style.display = 'block';
    consoleLog.innerHTML = '';
    progressBar.style.width = '0%';
    progressText.textContent = `0 / ${urls.length}`;

    scrapedResults = [];
    resultsSection.style.display = 'none';

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls, selectedFields })
      });

      if (!response.ok) throw new Error(`Server error HTTP ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const block of lines) {
          if (!block.trim()) continue;
          const eventMatch = block.match(/event:\s*([^\n]+)/);
          const dataMatch = block.match(/data:\s*([\s\S]+)/);

          if (eventMatch && dataMatch) {
            const eventType = eventMatch[1].trim();
            const payload = JSON.parse(dataMatch[1].trim());

            if (eventType === 'log') {
              addLog(payload.message);
            } else if (eventType === 'progress') {
              const pct = Math.round((payload.current / payload.total) * 100);
              progressBar.style.width = `${pct}%`;
              progressText.textContent = `${payload.current} / ${payload.total}`;
            } else if (eventType === 'item') {
              scrapedResults.push(payload.item);
              resultsCount.textContent = scrapedResults.length;
              renderTable(scrapedResults);
              renderGallery(scrapedResults);
              renderJSON(scrapedResults);
              resultsSection.style.display = 'block';
            } else if (eventType === 'done') {
              addLog('Extraction stream completed successfully!');
            }
          }
        }
      }
    } catch (err) {
      addLog(`Error during scrape: ${err.message}`);
    } finally {
      startScrapeBtn.disabled = false;
      startScrapeBtn.innerHTML = `Start Scraping`;
      progressBar.style.width = '100%';
    }
  });

  // 1. Instant Client-Side CSV Export (100% Reliable & Properly Formatted Leads)
  exportCsvBtn.addEventListener('click', () => {
    if (!scrapedResults || scrapedResults.length === 0) {
      alert('No data available to export.');
      return;
    }

    const preferredOrder = [
      { key: 'sourceType', label: 'Source' },
      { key: 'name', alt: ['title', 'productName'], label: 'Name / Business' },
      { key: 'businessType', alt: ['category'], label: 'Business Type / Category' },
      { key: 'phone', label: 'Phone Number' },
      { key: 'email', label: 'Email Address' },
      { key: 'address', label: 'Address' },
      { key: 'city', label: 'City' },
      { key: 'country', label: 'Country' },
      { key: 'website', label: 'Website URL' },
      { key: 'rating', label: 'Google Rating' },
      { key: 'reviews', label: 'Total Reviews' },
      { key: 'price', label: 'Price' },
      { key: 'discount', label: 'Discount' },
      { key: 'url', label: 'Target URL' }
    ];

    const keysInUse = new Set();
    scrapedResults.forEach((r) => Object.keys(r).forEach((k) => keysInUse.add(k)));

    const activeCols = [];
    preferredOrder.forEach((col) => {
      if (keysInUse.has(col.key) || (col.alt && col.alt.some((a) => keysInUse.has(a)))) {
        activeCols.push(col);
      }
    });

    keysInUse.forEach((k) => {
      if (!['sourceType', 'images', 'rawImages', 'mainImage'].includes(k) && !activeCols.some((c) => c.key === k || (c.alt && c.alt.includes(k)))) {
        activeCols.push({ key: k, label: k.charAt(0).toUpperCase() + k.slice(1) });
      }
    });

    const exportHeaders = activeCols.map((c) => c.label);
    exportHeaders.push('Images Count');
    exportHeaders.push('Image URLs');

    const rows = [exportHeaders.map((h) => `"${h}"`).join(',')];

    scrapedResults.forEach((item) => {
      const rowVals = activeCols.map((col) => {
        let val = item[col.key];
        if ((val === undefined || val === null || val === '') && col.alt) {
          for (const a of col.alt) {
            if (item[a]) { val = item[a]; break; }
          }
        }
        if (val === undefined || val === null || val === '' || val === 'null') {
          val = 'N/A';
        } else if (Array.isArray(val)) {
          val = val.join('; ');
        } else if (typeof val === 'object') {
          val = JSON.stringify(val);
        }
        val = String(val).replace(/"/g, '""');
        return `"${val}"`;
      });

      const imgs = item.images || [];
      rowVals.push(`"${imgs.length}"`);
      rowVals.push(`"${imgs.join(' ; ')}"`);

      rows.push(rowVals.join(','));
    });

    const csvContent = '\uFEFF' + rows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `scraped_leads_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  });

  // 2. Instant Client-Side JSON Export
  exportJsonBtn.addEventListener('click', () => {
    if (!scrapedResults || scrapedResults.length === 0) {
      alert('No data available to export.');
      return;
    }
    const blob = new Blob([JSON.stringify(scrapedResults, null, 2)], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `scraped_data_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  });

  // Destination Folder Modal Elements
  const folderModalOverlay = document.getElementById('folderModalOverlay');
  const customFolderInput = document.getElementById('customFolderInput');
  const folderChips = document.querySelectorAll('.folder-chip');
  const confirmSaveLocalBtn = document.getElementById('confirmSaveLocalBtn');
  const cancelFolderModalBtn = document.getElementById('cancelFolderModalBtn');
  const folderModalStatus = document.getElementById('folderModalStatus');

  // Quick Chips for folder paths
  folderChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      folderChips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      customFolderInput.value = chip.getAttribute('data-path');
    });
  });

  // 3. Open Modal to Ask Where to Save Images on PC
  saveLocalBtn.addEventListener('click', () => {
    const allImages = [];
    scrapedResults.forEach((r) => {
      if (r.images && Array.isArray(r.images)) {
        r.images.forEach((img) => {
          if (img && !allImages.includes(img)) allImages.push(img);
        });
      }
    });

    if (allImages.length === 0) {
      alert('No images available to save.');
      return;
    }

    folderModalStatus.style.display = 'none';
    confirmSaveLocalBtn.disabled = false;
    confirmSaveLocalBtn.textContent = 'Save All Images Here & Open in Explorer';
    folderModalOverlay.style.display = 'flex';
  });

  cancelFolderModalBtn.addEventListener('click', () => {
    folderModalOverlay.style.display = 'none';
  });

  confirmSaveLocalBtn.addEventListener('click', async () => {
    const allImages = [];
    scrapedResults.forEach((r) => {
      if (r.images && Array.isArray(r.images)) {
        r.images.forEach((img) => {
          if (img && !allImages.includes(img)) allImages.push(img);
        });
      }
    });

    const chosenPath = customFolderInput.value.trim() || 'D:\\Scraped_Images';
    confirmSaveLocalBtn.disabled = true;
    confirmSaveLocalBtn.textContent = `Saving ${allImages.length} images to ${chosenPath}...`;

    folderModalStatus.className = 'folder-modal-status saving';
    folderModalStatus.textContent = `Downloading & writing images to: ${chosenPath}...`;
    folderModalStatus.style.display = 'block';

    try {
      const res = await fetch('/api/save-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: allImages,
          customPath: chosenPath,
          folderName: scrapedResults[0]?.title || 'products'
        })
      });
      const data = await res.json();
      if (data.success) {
        folderModalStatus.className = 'folder-modal-status success';
        folderModalStatus.textContent = `✅ Successfully saved ${data.totalSaved} images! Windows Explorer folder opened at:\n${data.folderPath}`;
        confirmSaveLocalBtn.textContent = 'Done! Folder Opened';
        setTimeout(() => {
          folderModalOverlay.style.display = 'none';
        }, 3500);
      } else {
        alert('Save failed: ' + (data.error || 'Unknown error'));
        confirmSaveLocalBtn.disabled = false;
        confirmSaveLocalBtn.textContent = 'Retry Save';
      }
    } catch (e) {
      alert('Error saving images: ' + e.message);
      confirmSaveLocalBtn.disabled = false;
      confirmSaveLocalBtn.textContent = 'Retry Save';
    }
  });

  // 4. Download All Images as ZIP
  exportZipBtn.addEventListener('click', async () => {
    const allImages = [];
    scrapedResults.forEach((r) => {
      if (r.images && Array.isArray(r.images)) {
        r.images.forEach((img) => {
          if (img && !allImages.includes(img)) allImages.push(img);
        });
      }
    });

    if (allImages.length === 0) {
      alert('No images available to download.');
      return;
    }

    const origHtml = exportZipBtn.innerHTML;
    exportZipBtn.disabled = true;
    exportZipBtn.innerHTML = `Packaging ${allImages.length} images...`;

    try {
      const res = await fetch('/api/export/zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: allImages, prefix: 'product_image' })
      });

      if (!res.ok) throw new Error('ZIP archive generation failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scraped_images_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert('Failed to download ZIP: ' + e.message);
    } finally {
      exportZipBtn.disabled = false;
      exportZipBtn.innerHTML = origHtml;
    }
  });
});
