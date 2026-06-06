import type { Page } from "@playwright/test";
import type { FieldDescriptor } from "./types.js";

export async function extractFields(page: Page, systemName: string): Promise<FieldDescriptor[]> {
  return page.locator("input, select, textarea").evaluateAll((nodes, system) => {
    return nodes.map((node, index) => {
      const element = node as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      const label = element.closest("label")?.textContent?.replace(/\s+/g, " ").trim();
      const ariaLabel = element.getAttribute("aria-label");
      const fieldKey = element.getAttribute("data-field-key") || undefined;
      const name = element.getAttribute("name") || undefined;
      const type = element.getAttribute("type") || element.tagName.toLowerCase();

      return {
        id: `${system}-${name || fieldKey || index}`,
        label: label || ariaLabel || name || fieldKey || `Campo ${index + 1}`,
        name,
        fieldKey,
        type,
        required: element.hasAttribute("required"),
        sampleValue: "value" in element ? element.value : undefined,
      };
    });
  }, systemName);
}
