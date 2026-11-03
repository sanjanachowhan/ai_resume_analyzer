import test from 'node:test';
import assert from 'node:assert/strict';
import { pageText } from '../src/parsers/pdfText.js';

// A text piece as PDF.js reports it: text, position (transform[4] = x, transform[5] = y) and size.
const piece = (str, x, y, width = str.length * 5, extra = {}) => ({ str, transform: [1, 0, 0, 1, x, y], width, height: 10, ...extra });

test('a change of vertical position starts a new line', () => {
  assert.equal(pageText([piece('Jane Doe', 60, 740), piece('jane@example.com', 60, 720)]), 'Jane Doe\njane@example.com');
});

test('words that sit apart on one line get a space between them', () => {
  assert.equal(pageText([piece('Software Engineer,', 60, 700, 90), piece('Jan 2021', 200, 700, 40)]), 'Software Engineer, Jan 2021');
});

test('pieces that touch are joined without a space, so "Node.js" stays whole', () => {
  assert.equal(pageText([piece('Node', 60, 700, 20), piece('.js', 80, 700, 15)]), 'Node.js');
});

test('a space is not doubled when the text already has one', () => {
  assert.equal(pageText([piece('React ', 60, 700, 30), piece('Node', 100, 700, 20)]), 'React Node');
  assert.equal(pageText([piece('React', 60, 700, 25), piece(' Node', 100, 700, 25)]), 'React Node');
});

test('a small baseline wobble stays on the same line', () => {
  assert.equal(pageText([piece('x', 0, 700, 5), piece('y', 5, 702, 5)]), 'xy');
});

test('the PDF\'s own end-of-line marks are respected, without creating blank lines', () => {
  assert.equal(pageText([piece('a', 0, 700, 5, { hasEOL: true }), piece('b', 10, 700)]), 'a\nb');
  assert.equal(pageText([piece('a', 0, 700), piece('', 0, 700, 0, { hasEOL: true }), piece('b', 0, 680)]), 'a\nb');
});

test('marker items without text are ignored', () => {
  assert.equal(pageText([{ type: 'beginMarkedContent' }, piece('hi', 0, 0), { type: 'endMarkedContent' }]), 'hi');
  assert.equal(pageText([]), '');
});

test('two columns keep their reading order instead of being mixed line by line', () => {
  const items = [piece('Left 1', 60, 700), piece('Left 2', 60, 680), piece('Right 1', 320, 700), piece('Right 2', 320, 680)];
  assert.equal(pageText(items), 'Left 1\nLeft 2\nRight 1\nRight 2');
});
