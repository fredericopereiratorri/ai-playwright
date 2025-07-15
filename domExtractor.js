const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const urls = [
  { name: 'login', url: 'https://example.com/login' },
  { name: 'signup', url: 'https://example.com/signup' }
];

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
      const all = Array.from(document.querySelectorAll('*'));
      return all
        .filter(el =>
          ['INPUT', 'BUTTON', 'LABEL', 'H1', 'TEXTAREA', 'SELECT', 'A', 'DIV', 'SPAN'].includes(el.tagName)
        )
        .map(el => ({
          tag: el.tagName,
          text: el.innerText,
          placeholder: el.getAttribute('placeholder'),
          name: el.getAttribute('name'),
          id: el.id,
          type: el.getAttribute('type'),
          ariaLabel: el.getAttribute('aria-label'),
          class: el.className,
          attributes: Array.from(el.attributes).reduce((acc, attr) => {
            acc[attr.name] = attr.value;
            return acc;
          }, {})
        }));
    });

    const jsonPath = path.join(pagesDir, `${name}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(dom, null, 2));
    console.log(`✅ Saved DOM to ${jsonPath}`);
  }

  await browser.close();
})();
