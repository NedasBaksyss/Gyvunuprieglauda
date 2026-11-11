import multer from 'multer';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { HttpError } from './http-error.js';

export const photoPathPattern = /^\/uploads\/[a-f0-9-]{36}\.webp$/;
export function createPhotos(directory) {
  const parser = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0, parts: 2 } }).single('photo');
  function receive(request, response, next) {
    parser(request, response, (error) => {
      if (error) return next(new HttpError(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400, error.code === 'LIMIT_FILE_SIZE' ? 'Nuotrauka negali viršyti 5 MB.' : 'Įkelkite vieną nuotrauką lauke „photo“.'));
      next();
    });
  }
  async function save(file) {
    if (!file) throw new HttpError(400, 'Pasirinkite nuotrauką.');
    let buffer;
    try {
      const image = sharp(file.buffer, { limitInputPixels: 24000000, failOn: 'warning' });
      const metadata = await image.metadata();
      if (!['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages || 1) !== 1) throw new Error('Unsupported image');
      buffer = await image.rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    } catch { throw new HttpError(400, 'Netinkama nuotrauka. Leidžiami JPG, PNG ir WebP iki 24 megapikselių.'); }
    await mkdir(directory, { recursive: true });
    const filename = `${randomUUID()}.webp`;
    await writeFile(path.join(directory, filename), buffer, { flag: 'wx' });
    return `/uploads/${filename}`;
  }
  async function remove(url) {
    if (!photoPathPattern.test(url || '')) return;
    try { await unlink(path.join(directory, path.basename(url))); }
    catch (error) { if (error.code !== 'ENOENT') console.error('Nepavyko pašalinti senos nuotraukos:', error.code); }
  }
  return { receive, save, remove };
}
