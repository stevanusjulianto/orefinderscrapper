const express = require('express');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/finder', async (req, res) => {
  let browser;

  try {
    // 1. Base URL oreFinder
    //https://www.orefinder.gg/ores?filter=medium&form=false&ores[]=diamond&platform=bedrock_1_21&position[]=0&position[]=0&position[]=0&seed=57574574574457373737347
    const baseURL = 'https://www.orefinder.gg/ores';

    // 2. Ambil query dari permintaan dan bentuk ulang jadi URL lengkap
    const queryParams = new URLSearchParams();

    for (const key in req.query) {
      const value = req.query[key];

      if (Array.isArray(value)) {
        value.forEach(v => queryParams.append(key, v));
      } else {
        queryParams.append(key, value);
      }
    }

    const targetURL = `${baseURL}?${queryParams.toString()}`;

    console.log('Mengakses halaman:', targetURL);

    // 3. Jalankan Puppeteer untuk scraping
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto(targetURL, { waitUntil: 'networkidle0', timeout: 30000 });

    const htmlContent = await page.content();
    if (!htmlContent || htmlContent.length < 1000) {
      throw new Error('Konten halaman tidak berhasil dimuat atau kosong.');
    }

    const $ = cheerio.load(htmlContent);
    const results = [];

    $('ul[class*="@container"][class*="divide-y"] > li').each((index, element) => {
      const listItem = $(element);

      const distanceText = listItem.find('div[class*="w-[6ch]"]').first().text().trim();
      const distance = parseInt(distanceText.replace('m', ''), 10);

      const oreImage = listItem.find('img[alt]');
      const oreType = oreImage.attr('alt') || null;

      const oreInfoContainer = listItem.find('div.col-1.row-2.flex.items-center');
      const countText = oreInfoContainer.find('span.font-semibold').text().trim();

      let count = NaN;
      if (countText && countText.startsWith('×')) {
        count = parseInt(countText.replace('×', ''), 10);
      } else if (countText) {
        count = parseInt(countText, 10);
      }

      const positionText = listItem.find('div[class*="text-center text-xl"] p').text().trim();
      const coordsArray = positionText.split('/').map(coord => parseInt(coord.trim(), 10));

      const position = {
        x: coordsArray[0],
        y: coordsArray[1],
        z: coordsArray[2]
      };

      results.push({
        distance_m: distance,
        ore_type: oreType,
        count: count,
        position: position
      });
    });

    if (results.length === 0) {
      console.error('Tidak ada data yang ditemukan.');
    }

    res.json(results);

  } catch (error) {
    console.error('Terjadi kesalahan saat scraping:', error.message);
    res.status(500).json({ error: error.message });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

// Jalankan server
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
