// Usage: node build.mjs <repo root> <out.html>
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [repo, out] = process.argv.slice(2);
const here = dirname(fileURLToPath(import.meta.url));

const dir = (d) => readdirSync(join(repo, d)).filter((f) => f.endsWith('.md')).sort().map((f) => `${d}/${f}`);
const readmeFirst = (list) => [...list.filter((p) => p.endsWith('README.md')), ...list.filter((p) => !p.endsWith('README.md'))];

const groups = [
  ['Status', ['docs/IMPLEMENTATION_ROADMAP.md', 'docs/request-features.md']],
  ['Foundation', [
    'docs/AKSI_PRODUCT_DECISIONS.md',
    'docs/AKSI_INFORMATION_ARCHITECTURE.md',
    'docs/AKSI_UX_PRINCIPLES.md',
    'docs/AKSI_PRODUCT_DECISIONS_CHANGELOG.md',
    'docs/AKSI_INFORMATION_ARCHITECTURE_CHANGELOG.md',
    'docs/AKSI_UX_PRINCIPLES_CHANGELOG.md',
  ]],
  ['Current implementation', readmeFirst(dir('docs/current'))],
  ['Product', readmeFirst(dir('docs/product'))],
  ['Engineering', readmeFirst(dir('docs/engineering'))],
  ['Decisions', dir('docs/decisions')],
  ['Design system', readmeFirst(dir('docs/architecture'))],
  ['Aksi Sport', readmeFirst(dir('docs/design-system'))],
];

const titleOverrides = {
  'docs/request-features.md': 'Feature Requests',
  'docs/design-system/components.md': 'Aksi Sport components',
};

const docs = [];
for (const [group, paths] of groups) {
  for (const path of paths) {
    const md = readFileSync(join(repo, path), 'utf8');
    const h1 = md.match(/^#\s+(.+)$/m);
    const file = path.split('/').pop().replace(/\.md$/, '');
    const pretty = file.replace(/_/g, ' ').replace(/\w\S*/g, (w) => (w === 'AKSI' || w === 'UI' || w === 'AI' || w === 'UX' ? w : w[0] + w.slice(1).toLowerCase()));
    let title = titleOverrides[path] || (h1 ? h1[1].replace(/[`*]/g, '').trim() : pretty);
    title = title.replace(/\s+[—–]\s+.*$/, '');
    if (/\.md$/.test(title)) title = pretty;
    if (file === 'README') title = `${group} README`;
    if (file.endsWith('_CHANGELOG')) title = pretty.replace(/ Changelog$/, '') + ' (changelog)';
    const id = path.replace(/^docs\//, '').replace(/\.md$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    docs.push({ id, group, path, title, md });
  }
}

const commit = execSync('git rev-parse --short HEAD', { cwd: repo }).toString().trim();
const synced = new Date().toISOString().slice(0, 10);
const json = JSON.stringify(docs).replace(/</g, '\\u003c');

const html = readFileSync(join(here, 'template.html'), 'utf8')
  .replaceAll('__SYNCED__', synced)
  .replaceAll('__COMMIT__', commit)
  .replaceAll('__COUNT__', String(docs.length))
  .replace('__DOCS_JSON__', () => json);

writeFileSync(out, html);
console.log(`${docs.length} docs, ${(html.length / 1024).toFixed(0)} KB`);
console.log(docs.map((d) => `${d.id}  |  ${d.title}`).join('\n'));
