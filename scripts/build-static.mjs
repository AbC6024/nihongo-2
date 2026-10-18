import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(projectRoot, 'dist');
const publicDirectories = ['css', 'js', 'listening'];
const publicFiles = ['robots.txt', 'sitemap.xml'];

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

for (const file of fs.readdirSync(projectRoot)) {
  if (file.endsWith('.html')) publicFiles.push(file);
}

for (const file of publicFiles) {
  fs.copyFileSync(path.join(projectRoot, file), path.join(outputDir, file));
}

for (const directory of publicDirectories) {
  fs.cpSync(path.join(projectRoot, directory), path.join(outputDir, directory), { recursive: true });
}

console.log(`Static site prepared in ${outputDir}`);
