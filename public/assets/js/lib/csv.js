export function csvCell(value) {
    let text = String(value ?? '');
    // Prevent spreadsheet formula execution when exported user text is opened.
    if (typeof value !== 'number' && /^[\s]*[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
}

export function createCSV(headers, rows) {
    return '\uFEFF' + [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
}

export function downloadCSV(filename, headers, rows) {
    const url = URL.createObjectURL(new Blob([createCSV(headers, rows)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
