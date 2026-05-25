// Generates a 256x256 PNG icon for electron-builder
// Run: node scripts/generate-icon.js
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const SIZE = 256;
const CX = SIZE / 2, CY = SIZE / 2, R = SIZE / 2 - 2;

// Create raw RGBA pixel data (top-to-bottom for PNG)
const rawData = Buffer.alloc(SIZE * SIZE * 4);
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const i = (y * SIZE + x) * 4;
    const dx = x - CX + 0.5, dy = y - CY + 0.5;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // T bar: roughly row 30%, 40% width
    const tBarTop = Math.round(SIZE * 0.28);
    const tBarBottom = Math.round(SIZE * 0.42);
    const tBarLeft = Math.round(SIZE * 0.22);
    const tBarRight = Math.round(SIZE * 0.78);
    // T stem
    const stemLeft = Math.round(SIZE * 0.38);
    const stemRight = Math.round(SIZE * 0.62);
    const stemBottom = Math.round(SIZE * 0.72);

    const inT = y >= tBarTop && y <= tBarBottom && x >= tBarLeft && x <= tBarRight;
    const inStem = y >= tBarTop && y <= stemBottom && x >= stemLeft && x <= stemRight;
    const isForeground = (inT || inStem) && dist < R;

    if (dist < R && !isForeground) {
      rawData[i] = 0xcc;     // R
      rawData[i + 1] = 0x78; // G
      rawData[i + 2] = 0x5c; // B
      rawData[i + 3] = 0xff; // A
    } else if (dist < R) {
      rawData[i] = 0xff; rawData[i + 1] = 0xff; rawData[i + 2] = 0xff; rawData[i + 3] = 0xff;
    } else {
      rawData[i + 3] = 0; // transparent
    }
  }
}

// Convert raw RGBA to PNG
function createPNG(width, height, rgba) {
  // Build raw scanlines with filter byte 0 (None) at start of each row
  const rawScanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawScanlines[y * (1 + width * 4)] = 0; // filter none
    rgba.copy(rawScanlines, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }

  // Compress
  const compressed = zlib.deflateSync(rawScanlines);

  // PNG chunks
  function crc32(buf) {
    let c = 0xffffffff;
    const table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let v = n;
      for (let k = 0; k < 8; k++) v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1;
      table[n] = v;
    }
    for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeB = Buffer.from(type, 'ascii');
    const crcData = Buffer.concat([typeB, data]);
    const crcV = Buffer.alloc(4);
    crcV.writeUInt32BE(crc32(crcData));
    return Buffer.concat([len, typeB, data, crcV]);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const idat = chunk('IDAT', compressed);
  return Buffer.concat([signature, chunk('IHDR', ihdr), idat, chunk('IEND', Buffer.alloc(0))]);
}

const png = createPNG(SIZE, SIZE, rawData);
const outPath = path.join(__dirname, '..', 'assets', 'icon.png');
fs.writeFileSync(outPath, png);
console.log('Icon generated:', outPath);
