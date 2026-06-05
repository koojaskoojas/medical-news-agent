export function cleanHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-zA-Z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncate(text: string, maxChars = 8000): string {
  if (!text) return '';
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

export function normalizeTitle(title: string): string {
  return title.replace(/\s+/g, ' ').trim();
}
