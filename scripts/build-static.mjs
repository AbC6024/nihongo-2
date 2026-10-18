import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(projectRoot, 'dist');
const publicDirectories = ['css', 'js', 'listening', 'hiragana'];
const publicFiles = ['robots.txt', 'sitemap.xml'];

// Update entry pages too: Node and GitHub Pages serve these tracked files directly.
// Content versions prevent an older cached catalog from hiding newly added games.
function versionLocalAssets(html, directory = projectRoot) {
  return html.replace(/\b(src|href)=(['"])((?:\.\/)?(?:js|css)\/[^'"?#]+)([^'"]*)\2/g,
    (match, attribute, quote, relativePath, suffix) => {
      if (!/\.(?:js|css)$/.test(relativePath)) return match;
      const content = fs.readFileSync(path.join(directory, relativePath), 'utf8').replace(/\r\n/g, '\n');
      const version = createHash('sha256').update(content).digest('hex').slice(0, 12);
      const url = new URL(relativePath + suffix, 'https://assets.invalid/');
      url.searchParams.set('v', version);
      return `${attribute}=${quote}${relativePath}${url.search}${url.hash}${quote}`;
    });
}

function versionEntry(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const versioned = versionLocalAssets(source, path.dirname(filePath));
  if (versioned !== source) fs.writeFileSync(filePath, versioned);
}

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

for (const file of fs.readdirSync(projectRoot)) {
  if (file.endsWith('.html')) publicFiles.push(file);
}

for (const file of publicFiles) {
  if (file.endsWith('.html')) {
    versionEntry(path.join(projectRoot, file));
  }
  fs.copyFileSync(path.join(projectRoot, file), path.join(outputDir, file));
}

for (const directory of publicDirectories) {
  if (directory === 'hiragana') versionEntry(path.join(projectRoot, directory, 'index.html'));
  fs.cpSync(path.join(projectRoot, directory), path.join(outputDir, directory), { recursive: true });
}

console.log(`Static site prepared in ${outputDir}`);
