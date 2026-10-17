import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateMatchScore, calculateLocationMatch, matchReasons } from '../public/assets/js/lib/matching.js';

test('matching accepts comma-separated preferences and normalizes case and category aliases', () => {
    const profile = { jobTypes: ['Full-Time'], categories: ['IT'], industries: 'Software, Healthcare', location: 'Kampala', skills: 'JavaScript; SQL' };
    const job = { jobType: 'full-time', category: 'Technology', industry: 'software', location: 'Kampala', requiredSkills: ['javascript', 'sql'] };
    assert.equal(calculateMatchScore(profile, job), 100);
});

test('matching handles empty profiles and always produces bounded scores', () => {
    assert.equal(calculateMatchScore(null, {}), 0);
    assert.equal(calculateMatchScore({}, null), 0);
    assert.equal(calculateMatchScore({}, {}), 0);
    const score = calculateMatchScore({ skills: ['SQL'], jobTypes: ['part-time'], location: 'Kampala' },
        { requiredSkills: ['SQL', 'JavaScript'], jobType: 'full-time', location: 'Remote' });
    assert.ok(Number.isInteger(score) && score >= 0 && score <= 100);
    assert.equal(calculateLocationMatch('Kampala, Uganda', 'Kampala'), 90);
});

test('engineering and newline-separated preferences remain whole words', () => {
    assert.equal(calculateMatchScore({ categories: 'Engineering\nFinance' }, { category: 'engineering' }), 100);
});

test('matching explanations name actual shared preferences without claiming a hiring probability', () => {
    assert.deepEqual(matchReasons({ skills: ['SQL'], location: 'Kampala', jobTypes: ['full-time'], categories: ['IT'] },
        { requiredSkills: ['SQL', 'JavaScript'], location: 'Kampala', jobType: 'full-time', category: 'technology' }),
        ['Skills: sql', 'Preferred location', 'Preferred job type', 'Preferred field']);
    assert.deepEqual(matchReasons({ skills: ['Accounting'] }, { requiredSkills: ['JavaScript'] }), []);
});
