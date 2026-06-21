/**
 * Generates 192x192 and 512x512 PNG icons for the PWA.
 * Uses only Node built-ins (zlib, fs, crypto) — no extra deps.
 * Design: green gradient background + gold trophy + white soccer ball.
 */
import { deflateSync } from 'zlib'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')
mkdirSync(publicDir, { recursive: true })

/* ── CRC32 ────────────────────────────────────────────────────── */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const typeBytes = Buffer.from(type)
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0)
  const crcBuf = crc32(Buffer.concat([typeBytes, data]))
  const crcBytes = Buffer.alloc(4); crcBytes.writeUInt32BE(crcBuf, 0)
  return Buffer.concat([len, typeBytes, data, crcBytes])
}

/* ── PNG builder ──────────────────────────────────────────────── */
function makePNG(size, pixelFn) {
  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 2   // RGB colour type
  // bytes 10-12 already 0 (compression/filter/interlace)

  // Raw image rows: filter byte (0) + RGB per pixel
  const stride = 1 + size * 3
  const raw = Buffer.alloc(size * stride)
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0  // filter None
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixelFn(x, y, size)
      raw[y * stride + 1 + x * 3]     = r
      raw[y * stride + 1 + x * 3 + 1] = g
      raw[y * stride + 1 + x * 3 + 2] = b
    }
  }

  const sig  = Buffer.from([137,80,78,71,13,10,26,10])
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/* ── Pixel painter ────────────────────────────────────────────── */
function pixel(x, y, size) {
  const cx = size / 2, cy = size / 2
  const r  = size / 2
  const dx = x - cx, dy = y - cy
  const dist = Math.sqrt(dx * dx + dy * dy)

  // Outside circle → transparent-ish white (we'll keep white for square icons)
  // Actually PNG is square — make it a rounded square background
  const pad    = size * 0.1
  const radius = size * 0.18
  const inRRect = (
    x >= pad && x < size - pad &&
    y >= pad && y < size - pad &&
    !(x < pad + radius && y < pad + radius && Math.hypot(x - pad - radius, y - pad - radius) > radius) &&
    !(x > size - pad - radius && y < pad + radius && Math.hypot(x - (size - pad - radius), y - pad - radius) > radius) &&
    !(x < pad + radius && y > size - pad - radius && Math.hypot(x - pad - radius, y - (size - pad - radius)) > radius) &&
    !(x > size - pad - radius && y > size - pad - radius && Math.hypot(x - (size - pad - radius), y - (size - pad - radius)) > radius)
  )

  if (!inRRect) return [248, 250, 252]  // near-white outside

  // Green gradient background
  const t = (x + y) / (2 * size)
  const bgR = Math.round(6  + t * (4  - 6))
  const bgG = Math.round(78 + t * (120 - 78))
  const bgB = Math.round(59 + t * (87 - 59))

  // Trophy body (gold) — centered upper portion
  const trophyLeft  = cx - size * 0.18
  const trophyRight = cx + size * 0.18
  const trophyTop   = cy - size * 0.30
  const trophyBot   = cy + size * 0.05
  const inTrophy = x > trophyLeft && x < trophyRight && y > trophyTop && y < trophyBot

  // Trophy handles
  const handleW = size * 0.08
  const inHandleL = x > trophyLeft - handleW && x < trophyLeft &&
                    y > trophyTop + size * 0.04 && y < trophyTop + size * 0.20
  const inHandleR = x > trophyRight && x < trophyRight + handleW &&
                    y > trophyTop + size * 0.04 && y < trophyTop + size * 0.20

  if (inTrophy || inHandleL || inHandleR) return [251, 191, 36]  // gold

  // Trophy stem
  const stemW = size * 0.05
  const inStem = Math.abs(x - cx) < stemW && y > trophyBot && y < trophyBot + size * 0.12
  if (inStem) return [251, 191, 36]

  // Trophy base
  const baseH = size * 0.04
  const baseW = size * 0.22
  const inBase = Math.abs(x - cx) < baseW && y > trophyBot + size * 0.12 && y < trophyBot + size * 0.12 + baseH
  if (inBase) return [251, 191, 36]

  // Soccer ball — lower center
  const ballCY = cy + size * 0.25
  const ballR  = size * 0.13
  const ballDist = Math.hypot(x - cx, y - ballCY)
  if (ballDist < ballR) {
    // Simple pentagon pattern
    const angle = Math.atan2(y - ballCY, x - cx)
    const seg = Math.round(angle / (Math.PI / 3)) % 2
    return seg === 0 ? [255, 255, 255] : [30, 41, 59]
  }

  return [bgR, bgG, bgB]
}

/* ── Write icons ──────────────────────────────────────────────── */
for (const size of [192, 512]) {
  const png = makePNG(size, pixel)
  const path = join(publicDir, `icon-${size}.png`)
  writeFileSync(path, png)
  console.log(`✅ ${path} (${png.length} bytes)`)
}

// Apple touch icon (180x180 — same design)
writeFileSync(join(publicDir, 'apple-touch-icon.png'), makePNG(180, pixel))
console.log(`✅ apple-touch-icon.png`)
