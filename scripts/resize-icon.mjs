import sharp from 'sharp';
import { renameSync } from 'fs';
import { resolve } from 'path';

const input = resolve('build/icon.png');
const tmp = resolve('build/icon_tmp.png');
const output = resolve('build/icon.png');

const img = sharp(input);
const meta = await img.metadata();
console.log('Original:', meta.width, 'x', meta.height);

await sharp(input)
  .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(tmp);

renameSync(tmp, output);
console.log('Done: 1024x1024 -> build/icon.png');
