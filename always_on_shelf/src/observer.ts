import type { Page } from "@playwright/test";

export async function attachObserver(page: Page): Promise<void> {
  await page.evaluate(`
    window.__observed = {};
    var track = function(e) {
      var el = e.target;
      var key = el.name || el.id;
      if (key && String(el.value).trim()) {
        window.__observed[key] = String(el.value).trim();
      }
    };
    document.addEventListener("input", track, true);
    document.addEventListener("change", track, true);
    document.addEventListener("blur", track, true);
  `);
}

export async function collectObserved(page: Page): Promise<Record<string, string>> {
  return page.evaluate(`
    (function() {
      var result = Object.assign({}, window.__observed || {});
      document.querySelectorAll("input, textarea, select").forEach(function(el) {
        var key = el.name || el.id;
        var val = String(el.value).trim();
        if (key && val) result[key] = val;
      });
      return Object.fromEntries(
        Object.entries(result).filter(function(entry) { return String(entry[1]).trim() !== ""; })
      );
    })()
  `) as Promise<Record<string, string>>;
}