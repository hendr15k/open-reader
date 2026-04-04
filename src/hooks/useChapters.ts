import { useMemo, useState } from 'react';

export interface Chapter {
  id: number;
  title: string;
  startLine: number;
  endLine: number;
}

// Split article content into chapters based on heading patterns
export function parseChapters(content: string): Chapter[] {
  const lines = content.split('\n');
  const chapters: Chapter[] = [];
  const headingRe = /^(#{1,3}\s+|Chapter\s|Kapitel\s)/i;
  let currentStart = 0;

  for (let i = 0; i < lines.length; i++) {
    if (i > 0 && headingRe.test(lines[i].trim())) {
      // Close previous chapter
      if (currentStart < i) {
        const chapterLines = lines.slice(currentStart, i);
        const firstHeading = chapterLines.find(l => l.trim().startsWith('#'));
        const title = firstHeading
          ? firstHeading.replace(/^#+\s*/, '').trim()
          : `Abschnitt ${chapters.length + 1}`;
        chapters.push({
          id: chapters.length,
          title,
          startLine: currentStart,
          endLine: i,
        });
      }
      currentStart = i;
    }
  }

  // Last chapter
  if (currentStart < lines.length) {
    const chapterLines = lines.slice(currentStart);
    const firstHeading = chapterLines.find(l => l.trim().startsWith('#'));
    const title = firstHeading
      ? firstHeading.replace(/^#+\s*/, '').trim()
      : chapters.length === 0
        ? 'Gesamter Text'
        : `Abschnitt ${chapters.length + 1}`;
    chapters.push({
      id: chapters.length,
      title,
      startLine: currentStart,
      endLine: lines.length,
    });
  }

  // If no headings found, return the whole content as one chapter
  if (chapters.length === 0) {
    chapters.push({
      id: 0,
      title: 'Gesamter Text',
      startLine: 0,
      endLine: lines.length,
    });
  }

  return chapters;
}

export function useChapters(content: string) {
  const chapters = useMemo(() => parseChapters(content), [content]);
  const [activeChapter, setActiveChapter] = useState(0);
  const [showSidebar, setShowSidebar] = useState(false);

  const hasChapters = chapters.length > 1;

  return {
    chapters,
    activeChapter,
    setActiveChapter,
    showSidebar,
    setShowSidebar,
    hasChapters,
  };
}
