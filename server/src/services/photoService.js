const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const AppError = require('../utils/AppError');
const auditService = require('./auditService');

/** Folder where dish photos are stored; served at /uploads/dishes/<file>. */
const DIR = path.resolve(__dirname, '../../uploads/dishes');
const MAX_BYTES = 2 * 1024 * 1024;

// The first bytes of the file must match the type the browser claimed
const SIGNATURES = {
  jpeg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  png: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  webp: (b) => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
};

/**
 * Save a dish photo sent as a data URL (data:image/jpeg;base64,...).
 * Input: dataUrl string. Output: { url: "/uploads/dishes/<random>.<ext>" }.
 * Errors: 400 PHOTO_INVALID (not a JPEG/PNG/WebP image), 413 PHOTO_TOO_BIG (over 2 MB).
 */
exports.saveDishPhoto = async (dataUrl, user, ip) => {
  const match = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!match) throw new AppError(400, 'Choose a JPEG, PNG or WebP image', 'PHOTO_INVALID');

  const type = match[1] === 'jpg' ? 'jpeg' : match[1];
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > MAX_BYTES) throw new AppError(413, 'The photo is too big (max 2 MB)', 'PHOTO_TOO_BIG');
  if (bytes.length < 12 || !SIGNATURES[type](bytes)) {
    throw new AppError(400, 'This file is not a valid image', 'PHOTO_INVALID');
  }

  const name = `${crypto.randomBytes(12).toString('hex')}.${type === 'jpeg' ? 'jpg' : type}`;
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(path.join(DIR, name), bytes);

  await auditService.log({ userId: user.id, action: 'PHOTO_UPLOADED', entity: 'photo', details: { name, bytes: bytes.length }, ip });
  return { url: `/uploads/dishes/${name}` };
};

exports.UPLOAD_ROOT = path.resolve(__dirname, '../../uploads');
