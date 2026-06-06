import { test } from 'node:test';
import * as assert from 'node:assert';
import { parseChapters } from '../useChapters';

test('parseChapters', async (t) => {
  await t.test('returns a single chapter when no headings are present', () => {
    const chapters = parseChapters('Just some plain text\nwith two lines.');
    assert.strictEqual(chapters.length, 1);
    assert.strictEqual(chapters[0].title, 'Gesamter Text');
    assert.strictEqual(chapters[0].startLine, 0);
    assert.strictEqual(chapters[0].endLine, 2);
  });

  await t.test('splits on ATX-style headings (##, ###)', () => {
    const content = [
      'Intro paragraph',          // 0
      '## Chapter 1',             // 1
      'Body of chapter 1',        // 2
      'Body line 2',              // 3
      '## Chapter 2',             // 4
      'Body of chapter 2',        // 5
    ].join('\n');
    const chapters = parseChapters(content);
    // Intro paragraph has no heading so it becomes "Abschnitt 1".
    // Then "## Chapter 1" and "## Chapter 2" become their own chapters.
    assert.strictEqual(chapters.length, 3);
    assert.strictEqual(chapters[0].title, 'Abschnitt 1');
    assert.strictEqual(chapters[0].startLine, 0);
    assert.strictEqual(chapters[0].endLine, 1);
    assert.strictEqual(chapters[1].title, 'Chapter 1');
    assert.strictEqual(chapters[1].startLine, 1);
    assert.strictEqual(chapters[1].endLine, 4);
    assert.strictEqual(chapters[2].title, 'Chapter 2');
    assert.strictEqual(chapters[2].startLine, 4);
    assert.strictEqual(chapters[2].endLine, 6);
  });

  await t.test('honours heading boundaries exactly', () => {
    const content = [
      'preamble',                // 0
      '## Heading A',            // 1
      'A line',                  // 2
      'A line 2',                // 3
      '## Heading B',            // 4
      'B line',                  // 5
    ].join('\n');
    const chapters = parseChapters(content);
    const lines = content.split('\n');
    for (const ch of chapters) {
      const slice = lines.slice(ch.startLine, ch.endLine);
      assert.ok(slice.length > 0, `chapter "${ch.title}" should not be empty`);
    }
    // Chapters must cover the whole document without gaps or overlap.
    assert.strictEqual(chapters[0].startLine, 0);
    assert.strictEqual(chapters[chapters.length - 1].endLine, lines.length);
    for (let i = 1; i < chapters.length; i++) {
      assert.strictEqual(
        chapters[i - 1].endLine,
        chapters[i].startLine,
        `chapter ${i - 1} should end where chapter ${i} starts`,
      );
    }
  });

  await t.test('"Chapter N" / "Kapitel N" lines are recognised after line 0', () => {
    // The parser only treats a line as a chapter break if it's not the first
    // line. So a leading "Chapter 1 …" is part of section 0 ("Abschnitt 1")
    // and the actual break is the *second* "Kapitel 2" line. This documents
    // the current behaviour so any future change is intentional.
    const content = [
      'Chapter 1 The Beginning',  // 0 — leading, treated as preamble
      'First body line',          // 1
      'Kapitel 2 Aufbruch',       // 2 — break here
      'Second body line',         // 3
    ].join('\n');
    const chapters = parseChapters(content);
    assert.strictEqual(chapters.length, 2);
    assert.strictEqual(chapters[0].startLine, 0);
    assert.strictEqual(chapters[0].endLine, 2);
    assert.strictEqual(chapters[1].startLine, 2);
    assert.strictEqual(chapters[1].endLine, 4);
  });

  await t.test('handles a heading at the very first line', () => {
    // The "i > 0" guard means the first line is never used as a break, but
    // when it IS a heading it still serves as the title of chapter 0 because
    // it lives inside the first chapter slice.
    const content = ['# Title', 'body'].join('\n');
    const chapters = parseChapters(content);
    assert.strictEqual(chapters.length, 1);
    assert.strictEqual(chapters[0].title, 'Title');
  });
});
