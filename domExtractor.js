async function extractDOM(page) {
  return await page.evaluate(() => {
    function isVisible(el) {
      const style = window.getComputedStyle(el);
      return (
        style &&
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        el.offsetWidth > 0 &&
        el.offsetHeight > 0
      );
    }

    const elements = Array.from(document.querySelectorAll('input, button, textarea, select, label, a, h1, h2, h3, span, div'));

    const minimalDOM = elements
      .filter(el => {
        if (!isVisible(el)) return false;
        if (el.tagName === 'DIV' && !el.id && !el.className) return false;
        return true;
      })
      .map(el => {
        // Trim text further to 40 chars max
        const trimmedText = el.innerText?.trim().slice(0, 40) || null;

        return {
          tag: el.tagName,
          text: trimmedText,
          id: el.id || null,
          name: el.getAttribute('name') || null,
          class: el.className || null,
        };
      })
      .filter(el => el.text || el.id || el.name || el.class); // keep only meaningful elements

    return minimalDOM;
  });
}

module.exports = { extractDOM };
