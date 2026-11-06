import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve('next', { paths: ['./web'] }));
const sharp = nextRequire('sharp');
const source = await readFile('web/src/app/icon.svg');
const sizes = [16, 24, 32, 48, 64, 128, 256];
const images = await Promise.all(
  sizes.map((size) => sharp(source).resize(size, size).png().toBuffer()),
);
const directory = Buffer.alloc(6 + sizes.length * 16);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(sizes.length, 4);
let offset = directory.length;
sizes.forEach((size, i) => {
  const at = 6 + i * 16;
  directory[at] = directory[at + 1] = size === 256 ? 0 : size;
  directory.writeUInt16LE(1, at + 4);
  directory.writeUInt16LE(32, at + 6);
  directory.writeUInt32LE(images[i].length, at + 8);
  directory.writeUInt32LE(offset, at + 12);
  offset += images[i].length;
});
await writeFile('web/src/app/favicon.ico', Buffer.concat([directory, ...images]));
await sharp(source).resize(180, 180).png().toFile('web/src/app/apple-icon.png');
await writeFile('web/public/brand/icon.svg', source);
for (let i = 0; i < sizes.length; i++) {
  const { data, info } = await sharp(images[i])
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.width !== sizes[i] || info.height !== sizes[i]) throw new Error('Wrong icon size');
  let found = false;
  for (let p = 0; p < data.length; p += 4) {
    if (data[p + 3] === 255) {
      found = true;
      if (data[p] !== 181 || data[p + 1] !== 53 || data[p + 2] !== 39)
        throw new Error('Wrong cinnabar color');
    }
  }
  if (!found) throw new Error('Empty icon');
}
console.log('Verified seven cinnabar ICO sizes, SVG and Apple icon.');
