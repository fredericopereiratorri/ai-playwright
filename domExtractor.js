const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const urls = [
  { name: 'twitch', url: 'https://www.twitch.tv/k13tv' }
];

// const urls = [
//   { name: 'twitch', url: 'https://www.twitch.tv/k13tv' },
//   { name: 'r7', url: 'https://www.r7.com/' }
// ];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const pagesDir = path.join(__dirname, 'pages');
  if (!fs.existsSync(pagesDir)) {
    fs.mkdirSync(pagesDir);
  }

  for (const { name, url } of urls) {
    await page.goto(url);
    console.log(`📥 Extracting DOM from ${url}`);

    const dom = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('input, button, textarea, select, label, a, h1, h2, h3, span, div'));

      // Function to check visibility:
      function isVisible(el) {
        // Check if offsetParent is null (means display:none or not in document flow)
        if (!el.offsetParent) return false;
        // Check if element has bounding client rect size > 0 (not hidden via CSS)
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        // Optional: Check computed visibility style
        if (getComputedStyle(el).visibility === 'hidden' || getComputedStyle(el).display === 'none') return false;
        return true;
      }

      return elements.map(el => {
        // Skip invisible elements
        if (!isVisible(el)) return null;

        // Skip <div> with neither id nor class
        if (el.tagName === 'DIV' && !el.id && !el.className) {
          return null;
        }

        const trimmedText = el.innerText?.trim().slice(0, 80) || null;

        return {
          tag: el.tagName,
          text: trimmedText,
          id: el.id || null,
          name: el.getAttribute('name') || null,
          type: el.getAttribute('type') || null,
          placeholder: el.getAttribute('placeholder') || null,
          class: el.className || null,
        };
      }).filter(Boolean); // Remove nulls
    });

    const filepath = path.join(pagesDir, `${name}.json`);
    fs.writeFileSync(filepath, JSON.stringify(dom, null, 2));
    console.log(`✅ Saved slimmed DOM to ${filepath}`);
  }

  await browser.close();
})();
