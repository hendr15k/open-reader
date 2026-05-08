import { useState, useEffect } from 'react';

interface Chapter {
  id: number;
  title: string;
  offset: number; // character offset in content
  length: number;
}

interface ContentParser {
  chapters: Chapter[];
  fullContent: string;
}

/**
 * Parse content into chapters.
 * Strategy: Look for heading-like patterns in the text.
 * Falls back to single chapter if no headings found.
 */
export function parseChapters(content: string): ContentParser {
  const lines = content.split('\n');
  const chapters: Chapter[] = [];
  let currentChapter: Chapter | null = null;
  let charOffset = 0;
  let chapterStartOffset = 0;

  // Combined regex pattern for headings to optimize matching performance
  const headingPattern = /^(?:#{1,6}\s+.+|\s*(?:Chapter|Kapitel|Part)\s+(?:\d+|[IVXLCDM]+)[.\s]*.+)$/i;

  let isFirstChapter = true;
  let currentChapterContent = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const match = line.match(headingPattern);
    if (match) {
      if (!isFirstChapter && currentChapter) {
        currentChapter.length = charOffset - chapterStartOffset;
        chapters.push(currentChapter);
      }
      const title = match[0].replace(/^#+\s*/, '').trim();
      currentChapter = {
        id: chapters.length,
        title: title || `Kapitel ${chapters.length + 1}`,
        offset: charOffset,
        length: 0,
      };
      chapterStartOffset = charOffset;
      isFirstChapter = false;
    } else {
      currentChapterContent += line + '\n';
    }
    charOffset += line.length + 1; // +1 for newline
  }

  // Push last chapter
  if (currentChapter) {
    currentChapter.length = charOffset - chapterStartOffset;
    chapters.push(currentChapter);
  }

  // If no chapters detected, treat entire content as one chapter
  if (chapters.length === 0) {
    chapters.push({
      id: 0,
      title: 'Gesamtes Dokument',
      offset: 0,
      length: content.length,
    });
  }

  return { chapters, fullContent: content };
}

/** Get content for a specific chapter */
export function getChapterContent(content: string, chapter: Chapter): string {
  return content.substring(chapter.offset, chapter.offset + chapter.length);
}

/** Hook for chapter navigation */
export function useChapterNavigation(content: string) {
  const [parsed, setParsed] = useState<ContentParser>({ chapters: [], fullContent: '' });
  const [currentChapter, setCurrentChapter] = useState<number>(0);
  const [showSidebar, setShowSidebar] = useState(false);

  useEffect(() => {
    if (content) {
      setParsed(parseChapters(content));
    }
  }, [content]);

  const chapterContent = parsed.chapters.length > 0
    ? getChapterContent(parsed.fullContent, parsed.chapters[currentChapter])
    : '';

  const progress = parsed.chapters.length > 0
    ? ((currentChapter + 1) / parsed.chapters.length) * 100
    : 0;

  const goToChapter = (id: number) => {
    setCurrentChapter(id);
    setShowSidebar(false);
  };

  const nextChapter = () => {
    if (currentChapter < parsed.chapters.length - 1) {
      setCurrentChapter(prev => prev + 1);
    }
  };

  const prevChapter = () => {
    if (currentChapter > 0) {
      setCurrentChapter(prev => prev - 1);
    }
  };

  return {
    chapters: parsed.chapters,
    currentChapter,
    chapterContent,
    chapterTitle: parsed.chapters[currentChapter]?.title || '',
    progress,
    showSidebar,
    setShowSidebar,
    goToChapter,
    nextChapter,
    prevChapter,
    hasMultipleChapters: parsed.chapters.length > 1,
    totalChapters: parsed.chapters.length,
  };
}
