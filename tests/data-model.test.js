import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeRecord, encodeRecord, encodeUpdate } from '../public/assets/js/lib/data-model.js';

test('job type is stored in the column used by matching and exposed consistently', () => {
    const row = encodeRecord('jobs', { title: 'Developer', type: 'full-time', salary: 'Negotiable' });
    assert.equal(row.job_type, 'full-time');
    const job = decodeRecord('jobs', { id: 'job-1', ...row });
    assert.equal(job.type, 'full-time');
    assert.equal(job.jobType, 'full-time');
    assert.equal(job.salary, 'Negotiable');
});

test('skills from the posting form are available to both public job screens', () => {
    const job = decodeRecord('jobs', { id: 'job', details: { requiredSkills: 'JavaScript, SQL' } });
    assert.deepEqual(job.requiredSkills, ['JavaScript', 'SQL']);
    assert.deepEqual(job.skills, job.requiredSkills);
    const legacy = decodeRecord('jobs', { id: 'legacy', details: { skills: ['Accounting'] } });
    assert.deepEqual(legacy.requiredSkills, ['Accounting']);
});

test('database ownership wins over any ownership-like fields in form details', () => {
    const application = decodeRecord('applications', {
        id: 'application-1', seeker_id: 'real-owner', status: 'pending',
        details: { id: 'forged-id', seekerId: 'forged-owner', status: 'hired', coverLetter: 'Hello' }
    });
    assert.equal(application.id, 'application-1');
    assert.equal(application.seekerId, 'real-owner');
    assert.equal(application.status, 'pending');
    assert.equal(application.coverLetter, 'Hello');
});

test('signed resume links are excluded from persisted application details', () => {
    const row = encodeRecord('applications', {
        resumePath: 'owner/applications/resume.pdf', resumeUrl: 'https://example.test/expiring-token',
        coverLetter: 'Please consider my application.'
    });
    assert.equal(row.resume_path, 'owner/applications/resume.pdf');
    assert.equal(row.details.resumeUrl, undefined);
    assert.equal(row.details.coverLetter, 'Please consider my application.');
});

test('application review and withdrawal payloads contain only writable columns', () => {
    const row = encodeUpdate('applications', {
        id: 'application', jobId: 'job', seekerId: 'seeker', employerId: 'employer',
        resumePath: 'seeker/resume.pdf', resumeUrl: 'https://example.test/signed',
        appliedDate: '2026-10-16T12:00:00Z', status: 'withdrawn',
        coverLetter: 'Hello', withdrawalReason: 'Other offer'
    });
    assert.deepEqual(Object.keys(row).sort(), ['details', 'status']);
    assert.deepEqual(row.details, { coverLetter: 'Hello', withdrawalReason: 'Other offer' });
});

test('stored application details cannot supply a resume link', () => {
    const record = decodeRecord('applications', { id: 'app', details: { resumeUrl: 'javascript:alert(1)' }, resume_path: null });
    assert.equal(record.resumeUrl, undefined);
});
