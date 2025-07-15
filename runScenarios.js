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
  const context = await browser.newContext();

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
You are a Playwright test assistant.

Given this DOM for the page "${name}" (role: ${role}, priority: ${priority}):
${dom}

Given this test scenario (natural language):
${description}

Given this expected validation (natural language):
${validation}

Please generate a JSON array of steps, which can be actions or validations.

Format for interaction actions:
{
  "type": "action",
  "action": "fill" | "click" | "focus",
  "selector": "Playwright selector string",
  "value": "value to fill if action is fill, else null"
}

Format for validation steps:
{
  "type": "expect",
  "expectation": "isVisible" | "isEnabled" | "textEquals",
  "selector": "Playwright selector string",
  "value": "value to match (only for textEquals)"
}

Respond only with the JSON array.
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
          if (action === 'fill') {
            console.log(`✍️ Filling selector "${selector}" with "${value}"`);
            await page.fill(selector, value);
          } else if (action === 'click') {
            console.log(`🖱️ Clicking selector "${selector}"`);
            await page.click(selector);
          } else if (action === 'focus') {
            console.log(`🔍 Focusing selector "${selector}"`);
            await page.focus(selector);
          } else {
            console.warn(`⚠️ Unknown action "${action}"`);
          }
        } else if (step.type === 'expect') {
          const { expectation, selector, value } = step;
          if (expectation === 'isVisible') {
            console.log(`🔎 Expecting selector "${selector}" to be visible`);
            await expect(page.locator(selector)).toBeVisible();
          } else if (expectation === 'isEnabled') {
            console.log(`🔎 Expecting selector "${selector}" to be enabled`);
            await expect(page.locator(selector)).toBeEnabled();
          } else if (expectation === 'textEquals') {
            console.log(`🔎 Expecting selector "${selector}" to have text "${value}"`);
            await expect(page.locator(selector)).toHaveText(value);
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
