import test from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, createCSV } from '../public/assets/js/lib/csv.js';

test('CSV exports quote separators, preserve line breaks, and neutralize spreadsheet formulas', () => {
    assert.equal(csvCell('A, "B"'), '"A, ""B"""');
    assert.equal(csvCell('=HYPERLINK("https://example.test")'), '"\'=HYPERLINK(""https://example.test"")"');
    assert.equal(csvCell(' \t+SUM(1,2)'), '"\' \t+SUM(1,2)"');
    assert.equal(csvCell(-3), '"-3"');
    assert.equal(createCSV(['Name'], [['Test\nPerson']]), '\uFEFF"Name"\r\n"Test\nPerson"');
});
