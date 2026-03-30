const JULES_API_KEY = import.meta.env.VITE_JULES_API_KEY || '';

export async function generateSummary(text: string, length: 'short' | 'medium' | 'long' = 'medium'): Promise<string> {
  try {
    // Truncate text if too long (limit to first 10000 chars for API)
    const truncatedText = text.length > 10000 ? text.substring(0, 10000) : text;

    const response = await fetch('https://api.jules.ai/v1/summarize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${JULES_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: truncatedText,
        format: 'bullet-points',
        length,
      }),
    });

    if (!response.ok) {
      throw new Error(`Jules API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.summary || data.result || 'No summary generated';
  } catch (error) {
    console.error('Error generating summary:', error);
    // Fallback: generate simple summary locally
    return generateFallbackSummary(text);
  }
}

function generateFallbackSummary(text: string): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  const keyPoints = sentences.slice(0, 5);
  return keyPoints.map(s => `• ${s.trim()}`).join('\n');
}