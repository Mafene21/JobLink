import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';

const root = fileURLToPath(new URL('../public/', import.meta.url));
async function files(folder) {
    const entries = await readdir(folder, { withFileTypes: true });
    const nested = await Promise.all(entries.map(entry => entry.isDirectory() ? files(path.join(folder, entry.name)) : path.join(folder, entry.name)));
    return nested.flat();
}

test('all public HTML links and assets resolve, including help article anchors', async () => {
    for (const file of (await files(root)).filter(file => file.endsWith('.html'))) {
        const html = await readFile(file, 'utf8');
        const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
        assert.equal(new Set(ids).size, ids.length, `${file} has duplicate IDs`);
        assert.doesNotMatch(html, /\son[a-z]+\s*=/i, `${file} contains inline event handlers`);
        for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
            const value = match[1];
            if (/^(?:[a-z]+:|\/\/)/i.test(value) || value === '#') continue;
            const url = new URL(value, `https://joblink.test/${path.relative(root, file)}`);
            const target = path.resolve(root, '.' + url.pathname);
            assert.ok((await stat(target)).isFile(), `${file} has missing target ${value}`);
            if (url.hash && target.endsWith('.html')) {
                assert.ok((await readFile(target, 'utf8')).includes(`id="${url.hash.slice(1)}"`), `${file} has missing anchor ${value}`);
            }
        }
    }
});

test('browser modules parse and their local imports resolve', async () => {
    const scripts = (await files(root)).filter(file => file.endsWith('.js'));
    for (const file of scripts) {
        const source = await readFile(file, 'utf8');
        const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
        for (const node of ast.body.filter(node => node.type === 'ImportDeclaration')) {
            if (!node.source.value.startsWith('.')) continue;
            assert.ok((await stat(path.resolve(path.dirname(file), node.source.value))).isFile(), `${file} has missing module ${node.source.value}`);
        }
        if (!file.includes('/vendor/') && !file.endsWith('/ui.js')) {
            assert.doesNotMatch(source, /\.innerHTML\s*=/, `${file} bypasses shared HTML sanitization`);
        }
        assert.doesNotMatch(source, /www\.gstatic\.com\/firebasejs|firebaseConfig|emailjs\.send/);
    }
});
