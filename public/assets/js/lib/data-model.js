// Relational columns protect ownership and relations; details hold form fields.
export const tables = {
    users: { table: 'profiles', fields: {
        fullName: 'full_name', email: 'email', userType: 'user_type',
        profileCompleted: 'profile_completed', createdAt: 'created_at'
    } },
    seekers: { table: 'seeker_profiles', fields: { lastUpdated: 'updated_at' } },
    companies: { table: 'company_profiles', fields: { lastUpdated: 'updated_at' } },
    jobs: { table: 'jobs', fields: {
        employerId: 'employer_id', title: 'title', companyName: 'company_name',
        jobType: 'job_type', category: 'category', location: 'location', status: 'status',
        featured: 'featured', createdAt: 'created_at', updatedAt: 'updated_at'
    } },
    applications: { table: 'applications', fields: {
        jobId: 'job_id', seekerId: 'seeker_id', employerId: 'employer_id', status: 'status',
        appliedDate: 'applied_at', updatedAt: 'updated_at', resumePath: 'resume_path'
    } },
    savedJobs: { table: 'saved_jobs', fields: {
        jobId: 'job_id', seekerId: 'seeker_id', savedDate: 'saved_at'
    } }
};

export function tableConfig(name) {
    const config = tables[name];
    if (!config) throw new Error(`Unknown data table: ${name}`);
    return config;
}

export function decodeRecord(name, row) {
    if (!row) return null;
    const record = { ...row.details, id: row.id };
    for (const [field, column] of Object.entries(tableConfig(name).fields)) {
        if (row[column] !== undefined) record[field] = row[column];
    }
    if (name === 'jobs') {
        record.type = record.jobType;
        const requiredSkills = stringList(record.requiredSkills);
        record.requiredSkills = requiredSkills.length ? requiredSkills : stringList(record.skills);
        for (const field of ['responsibilities', 'benefits']) record[field] = stringList(record[field]);
        record.skills = record.requiredSkills;
    }
    if (name === 'applications') delete record.resumeUrl;
    if (name === 'seekers') {
        record.skills = stringList(record.skills);
        record.jobTypes = stringList(record.jobTypes);
        record.referees = Array.isArray(record.referees) ? record.referees : [];
    }
    if (name === 'companies') {
        if (!/^#[0-9a-f]{6}$/i.test(record.primaryColor || '')) record.primaryColor = '#2563eb';
        record.logoUrl ||= 'assets/images/company.svg';
        record.bannerUrl ||= 'assets/images/banner.svg';
        record.featuredImages = stringList(record.featuredImages);
    }
    if (name === 'seekers') record.userType = 'seeker';
    if (name === 'companies') record.userType = 'employer';
    return record;
}

export function stringList(value) {
    const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,;\n]+/) : [];
    return values.filter(item => typeof item === 'string').map(item => item.trim()).filter(Boolean);
}

export function encodeRecord(name, record) {
    const config = tableConfig(name);
    const row = {};
    const details = {};
    for (const [field, value] of Object.entries(record)) {
        if (value === undefined || field === 'id') continue;
        if (name === 'applications' && field === 'resumeUrl') continue;
        if (config.fields[field]) row[config.fields[field]] = value;
        else if (name !== 'users') details[field] = value;
    }
    if (name === 'jobs' && !row.job_type && record.type) row.job_type = record.type;
    if (name !== 'users') row.details = details;
    return row;
}

export function encodeUpdate(name, record) {
    const row = encodeRecord(name, record);
    for (const column of ['employer_id', 'seeker_id', 'job_id', 'resume_path', 'created_at', 'applied_at', 'saved_at']) delete row[column];
    return row;
}
