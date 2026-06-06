import { Article } from './types';

/**
 * Build the Jina Reader proxy URL for a given article URL.
 * Preserves the original protocol — sending `https://example.com` as
 * `https://r.jina.ai/http://example.com` (the old behaviour) would force
 * the site through a downgrade that some servers refuse.
 */
export function buildJinaUrl(url: string): string {
  const hasProtocol = /^https?:\/\//.test(url);
  return `https://r.jina.ai/${hasProtocol ? url : 'http://' + url}`;
}

export async function fetchArticle(url: string): Promise<Article & { content: string }> {
  try {
    const jinaUrl = buildJinaUrl(url);

    const response = await fetch(jinaUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch article: ${response.statusText}`);
    }

    const text = await response.text();
    const lines = text.split('\n').filter(line => line.trim());

    // Extract title (first non-empty line that looks like a title)
    let title = 'Untitled Article';
    if (lines.length > 0) {
      title = lines[0].replace(/^#+\s*/, '').trim();
    }

    // Estimate reading time (200 words per minute)
    const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
    const readingTime = Math.ceil(wordCount / 200);

    return {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      url,
      title,
      content: text,
      readingTime,
      savedAt: Date.now(),
    };
  } catch (error) {
    console.error('Error fetching article:', error);
    throw error;
  }
}