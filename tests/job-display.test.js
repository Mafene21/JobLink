import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSalary, formatSalary, matchesSalaryRange, compareSalary, requirementLines } from '../public/assets/js/lib/job-display.js';

test('UGX salary comparisons accept the amounts entered in the posting form', () => {
    for (const value of ['2,500,000 UGX/month', 'UGX 2,500,000 - 3,000,000', '2.5M', '2500000']) {
        assert.equal(parseSalary(value), 2500000, value);
        assert.equal(matchesSalaryRange(value, '2M+'), true, value);
    }
    assert.equal(parseSalary('500k - 750k'), 500000);
    assert.equal(matchesSalaryRange('500k', '0-500k'), true);
    assert.equal(matchesSalaryRange('500k', '500k-1M'), false);
    assert.equal(matchesSalaryRange('750,000', '500k-1M'), true);
    assert.equal(matchesSalaryRange('UGX 1,500,000', '1M-2M'), true);
});

test('undisclosed amounts and foreign currencies are not treated as UGX salaries', () => {
    for (const salary of ['Negotiable', '', null, 'USD 2,500', '$2,500', '2,500 USD', 'KES 50,000', 'EUR 3,000']) {
        assert.equal(parseSalary(salary), null, salary);
        assert.equal(matchesSalaryRange(salary, '0-500k'), false, salary);
        assert.equal(matchesSalaryRange(salary, 'any'), true, salary);
    }
    assert.equal(formatSalary('Negotiable'), 'Negotiable');
    assert.equal(formatSalary('USD 2,500'), 'USD 2,500');
    assert.equal(formatSalary('2.5M'), 'UGX 2.5M');
    assert.equal(formatSalary('2,500,000 UGX/month'), '2,500,000 UGX/month');
});

test('both salary sort directions keep undisclosed salaries at the end', () => {
    const salaries = ['Negotiable', '500k', '$3,000', 'UGX 2,500,000', '1M'];
    assert.deepEqual([...salaries].sort(compareSalary), ['500k', '1M', 'UGX 2,500,000', 'Negotiable', '$3,000']);
    assert.deepEqual([...salaries].sort((a, b) => compareSalary(a, b, 'desc')), ['UGX 2,500,000', '1M', '500k', 'Negotiable', '$3,000']);
});

test('requirements keep sentences intact and support existing array records', () => {
    assert.deepEqual(requirementLines('Python, JavaScript and SQL\n\nA relevant diploma\r\n'), ['Python, JavaScript and SQL', 'A relevant diploma']);
    assert.deepEqual(requirementLines([' A degree ', '', 'Experience']), ['A degree', 'Experience']);
    assert.deepEqual(requirementLines(null), []);
});
