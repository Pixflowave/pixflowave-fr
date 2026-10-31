import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const [, , xmlPath, outDir = 'export-wordpress/medias', filtre = ''] = process.argv;
if (!xmlPath) {
  console.error('Usage : node scripts/telecharger-medias.mjs fichier.xml [dossier] [filtre]');
  process.exit(1);
}

const xml = readFileSync(xmlPath, 'utf8');
const urls = [
  ...xml.matchAll(/<wp:attachment_url><!\[CDATA\[(.*?)\]\]><\/wp:attachment_url>/g),
].map((m) => m[1]);

const images = [...new Set(urls)]
  .filter((u) => /\.(jpe?g|png|webp|gif|avif)$/i.test(u))
  .filter((u) => u.includes(filtre));

mkdirSync(outDir, { recursive: true });
console.log(`${urls.length} fichiers dans l'export, ${images.length} images retenues`);

for (const url of images) {
  const rel = new URL(url).pathname.split('/uploads/')[1] ?? basename(url);
  const target = join(outDir, rel.replaceAll('/', '_'));
  if (existsSync(target)) continue;
  const res = await fetch(url);
  if (!res.ok) {
    console.warn('Échec', res.status, url);
    continue;
  }
  writeFileSync(target, Buffer.from(await res.arrayBuffer()));
  console.log('OK', target);
}