require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { OpenAI } = require('openai');
const { expect } = require('@playwright/test');
const { generateReport } = require('./reportGenerator');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const scenarios = JSON.parse(fs.readFileSync(path.join(__dirname, 'scenarios.json'), 'utf8'));
const pagesDir = path.join(__dirname, 'pages');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    timeout: 20000,
  });

  const results = [];

  for (const scenario of scenarios) {
    const { name, page: url, description, validation, role, priority } = scenario;

    if (!url) {
      console.log(`❌ No URL provided for scenario "${name}"`);
      results.push({ name, url, status: 'FAIL', error: 'No URL provided', priority, role });
      continue;
    }

    const page = await context.newPage();
    await page.goto(url);
    await page.waitForLoadState('networkidle');

    const domFile = path.join(pagesDir, `${name}.json`);
    if (!fs.existsSync(domFile)) {
      const errorMsg = `DOM JSON not found for page "${name}" at ${domFile}`;
      console.log(`❌ ${errorMsg}`);
      results.push({ name, url, status: 'FAIL', error: errorMsg, priority, role });
      await page.close();
      continue;
    }

    const dom = fs.readFileSync(domFile, 'utf8');

    const prompt = `
You are a Playwright test/QA assistant.

Given this DOM for the page "${name}" (role: ${role}, priority: ${priority}):
${dom}

Given this test scenario (natural language):
${description}

Given this expected validation (natural language):
${validation}

Please generate a JSON array of steps, which can be actions or validations.

Use **semantic Playwright selectors** wherever possible:
- Prefer getByRole("button", { name: "Log In" }) for buttons
- Or getByLabel("Email") for input fields
- Avoid raw CSS selectors like .btn or .form unless absolutely necessary

Return selectors as **JavaScript strings** to be evaluated later.

---

Format for interaction actions:
{
  "type": "action",
  "action": "fill" | "click" | "focus",
  "selector": "Playwright selector string",  // e.g. "getByRole('button', { name: 'Log In' })"
  "value": "value to fill if action is fill, else null"
}

Format for validation steps:
{
  "type": "expect",
  "expectation": "isVisible" | "isEnabled" | "textEquals",
  "selector": "Playwright selector string",  // e.g. "getByRole('button', { name: 'Log In' })"
  "value": "value to match (only for textEquals)"
}

Respond ONLY with the raw JSON array. Do NOT include any explanation.
`;

    let instructionsJSON;
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      });
      instructionsJSON = completion.choices[0].message.content.trim();
    } catch (err) {
      const errorMsg = `OpenAI API error: ${err.message}`;
      console.error(`❌ ${errorMsg}`);
      results.push({ name, url, status: 'FAIL', error: errorMsg, priority, role });
      await page.close();
      continue;
    }

    let instructions;
    try {
      instructions = JSON.parse(instructionsJSON);
    } catch (e) {
      const errorMsg = `Failed to parse JSON from GPT:\n${instructionsJSON}`;
      console.error(`❌ ${errorMsg}`);
      results.push({ name, url, status: 'FAIL', error: errorMsg, priority, role });
      await page.close();
      continue;
    }

    console.log(`🚀 Executing scenario "${name}"`);

    try {
      for (const step of instructions) {
        if (step.type === 'action') {
          const { action, selector, value } = step;

          if (action === 'goto') {
            console.log(`⚠️ Skipping unsupported action "goto"`);
            continue;
          }

          let locator;
          if (/^getBy/.test(selector.trim())) {
            locator = eval(`page.${selector.trim()}`);
          } else {
            locator = page.locator(selector);
          }

          if (action === 'fill') {
            console.log(`✍️ Filling selector "${selector}" with "${value}"`);
            await locator.fill(value);
          } else if (action === 'click') {
            console.log(`🖱️ Clicking selector "${selector}"`);
            await locator.click();
          } else if (action === 'focus') {
            console.log(`🔍 Focusing selector "${selector}"`);
            await locator.focus();
          } else {
            console.warn(`⚠️ Unknown action "${action}"`);
          }
        } else if (step.type === 'expect') {
          const { expectation, selector, value } = step;
          console.log(`🔎 Expecting selector "${selector}" to meet condition "${expectation}"`);

          // Optional: screenshot for debug
          await page.screenshot({ path: `debug_${name}.png`, fullPage: true });

          let locator;
          if (/^getBy/.test(selector.trim())) {
            try {
              locator = eval(`page.${selector.trim()}`);
            } catch (err) {
              throw new Error(`❌ Invalid selector: ${selector}\n${err.message}`);
            }
          } else {
            locator = page.locator(selector);
          }

          // Find the first visible element
          const total = await locator.count();
          let locatorToUse = null;
          for (let i = 0; i < total; i++) {
            if (await locator.nth(i).isVisible()) {
              locatorToUse = locator.nth(i);
              break;
            }
          }

          if (!locatorToUse) {
            throw new Error(`❌ Selector "${selector}" has no visible elements.`);
          }

          if (expectation === 'isVisible') {
            await expect(locatorToUse).toBeVisible();
          } else if (expectation === 'isEnabled') {
            await expect(locatorToUse).toBeEnabled();
          } else if (expectation === 'textEquals') {
            await expect(locatorToUse).toHaveText(value);
          } else {
            console.warn(`⚠️ Unknown expectation "${expectation}"`);
          }
        } else {
          console.warn(`⚠️ Unknown step type "${step.type}"`);
        }
      }

      console.log(`✅ Scenario "${name}" completed successfully`);
      results.push({ name, url, status: 'PASS', error: '', priority, role });
    } catch (err) {
      console.error(`❌ Error executing scenario "${name}":`, err);
      results.push({ name, url, status: 'FAIL', error: err.message, priority, role });
    }

    await page.close();
  }

  await browser.close();

  generateReport(results);
})();
