// Turns the text pieces PDF.js finds on a page into readable lines. No dependencies, so it is easy to test.
//
// The pieces come in the order the PDF draws them, which usually matches reading order even for
// two-column layouts, so that order is kept. A new line starts when the vertical position changes or the
// PDF marks a line end; words that sit apart on the same line get a space.
export function pageText(items) {
  let text = '';
  let previous = null;
  let lineBreak = false;

  for (const item of items) {
    if (typeof item.str !== 'string') continue; // marked-content markers carry no text

    // Empty pieces only matter for their "end of line" flag.
    if (item.str === '') {
      if (item.hasEOL) lineBreak = true;
      continue;
    }

    if (previous) {
      const sameLine = Math.abs(item.transform[5] - previous.transform[5]) <= 3; // baseline wobble up to 3 points
      if (!sameLine || previous.hasEOL || lineBreak) {
        text += '\n';
      } else {
        const gap = item.transform[4] - (previous.transform[4] + previous.width);
        const apart = gap > (item.height || 10) * 0.15;
        if (apart && !/\s$/.test(text) && !/^\s/.test(item.str)) text += ' ';
      }
    }

    lineBreak = false;
    text += item.str;
    previous = item;
  }
  return text;
}
