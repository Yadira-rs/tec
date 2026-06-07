import type { Page } from "@playwright/test";

export async function attachObserver(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as any).__observed = {};
    const track = (e: Event) => {
      const el = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      const key = el.name || el.id;
      if (key && String(el.value).trim()) {
        (window as any).__observed[key] = String(el.value).trim();
      }
    };
    document.addEventListener("input", track, true);
    document.addEventListener("change", track, true);
    document.addEventListener("blur", track, true);
  });
}

// Collects observed values AND scans all current form fields at collection time.
// This is robust against paste, autofill, or any input method that might not fire events.
export async function collectObserved(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const result: Record<string, string> = { ...((window as any).__observed ?? {}) };

    // Also snapshot current values of all inputs/textareas at this moment
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      "input, textarea, select",
    ).forEach((el) => {
      const key = (el as HTMLInputElement).name || el.id;
      const val = String(el.value).trim();
      if (key && val) result[key] = val;
    });

    return Object.fromEntries(
      Object.entries(result).filter(([, v]) => String(v).trim() !== ""),
    ) as Record<string, string>;
  });
}