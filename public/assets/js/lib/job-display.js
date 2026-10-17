// Salary filters compare UGX amounts. Other currencies and undisclosed salaries
// stay visible without a salary filter and sort after comparable amounts.
export function parseSalary(value) {
    if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
    if (typeof value !== 'string') return null;
    const text = value.trim().replace(/^(?:UGX|USh|Shs)\s*/i, '');
    if (/[$€£]|\b(?:USD|EUR|GBP|KES|TZS|RWF)\b/i.test(text)) return null;
    const match = text.match(/^(\d+(?:,\d{3})*(?:\.\d+)?)\s*([km])?(?=$|[\s/\-–—])/i);
    if (!match) return null;
    const multiplier = { k: 1000, m: 1000000 }[match[2]?.toLowerCase()] || 1;
    const amount = Number(match[1].replaceAll(',', '')) * multiplier;
    return Number.isFinite(amount) ? amount : null;
}

export function formatSalary(value) {
    const text = String(value ?? '').trim();
    if (!text) return 'Salary not specified';
    if (parseSalary(text) === null || /\b(?:UGX|USh|Shs)\b/i.test(text)) return text;
    return `UGX ${text}`;
}

export function matchesSalaryRange(value, range) {
    if (!range || range === 'any') return true;
    const amount = parseSalary(value);
    if (amount === null) return false;
    switch (range) {
        case '0-500k': return amount <= 500000;
        case '500k-1M': return amount > 500000 && amount <= 1000000;
        case '1M-2M': return amount > 1000000 && amount <= 2000000;
        case '2M+': return amount > 2000000;
        default: return true;
    }
}

export function compareSalary(a, b, direction = 'asc') {
    const first = parseSalary(a);
    const second = parseSalary(b);
    if (first === null) return second === null ? 0 : 1;
    if (second === null) return -1;
    return (first - second) * (direction === 'desc' ? -1 : 1);
}

// Requirements are free text in the posting form; keep commas inside sentences.
export function requirementLines(value) {
    const lines = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/\r?\n/) : [];
    return lines.filter(line => typeof line === 'string').map(line => line.trim()).filter(Boolean);
}
