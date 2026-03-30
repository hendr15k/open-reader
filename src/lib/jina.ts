import { Article } from './types';

export async function fetchArticle(url: string): Promise<Article & { content: string }> {
  try {
    const jinaUrl = `https://r.jina.ai/http://${url.replace(/^https?:\/\//, '')}`;
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
    const wordCount = text.split(/\s+/).length;
    const readingTime = Math.ceil(wordCount / 200);

    return {
      id: Date.now().toString(),
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