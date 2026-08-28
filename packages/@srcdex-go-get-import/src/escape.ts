/**
 * HTML escaping for interpolated, request-controlled values
 * such as hostnames and paths.
 */

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  '\'': '&#39;',
};

/** Escapes a value for safe use in HTML text and attributes. */
export function escapeHTML(value: string): string {
  // The character class matches exactly the keys of
  // HTML_ESCAPES, so the lookup can never miss.
  return value.replaceAll(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]!);
}
