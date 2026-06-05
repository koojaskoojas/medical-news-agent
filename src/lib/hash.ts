import { createHash } from 'crypto';

export function computeHash(title: string, content = ''): string {
  const raw = `${title.toLowerCase().trim()}${content.slice(0, 200).toLowerCase().trim()}`;
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}
