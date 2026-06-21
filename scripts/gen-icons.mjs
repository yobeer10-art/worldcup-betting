/**
 * Generates PWA icons: 192x192, 512x512, 512x512-maskable, 180x180 apple-touch.
 * Design: classic soccer ball (white + black pentagons) on deep-green background.
 * Uses only Node built-ins — no extra deps.
 */
import { deflateSync } from 'zlib'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')
mkdirSync(publicDir, { recursive: true })

/* ── CRC32 (needed for PNG chunks) ───────────────────────────── */
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
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function pngChunk(type, data) {
  const tb = Buffer.from(type)
  const lb = Buffer.alloc(4); lb.writeUInt32BE(data.length)
  const cb = Buffer.alloc(4); cb.writeUInt32BE(crc32(Buffer.concat([tb, data])))
  return Buffer.concat([lb, tb, data, cb])
}

/* ── PNG encoder ──────────────────────────────────────────────── */
function encodePNG(size, pixelFn) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 2   // 8-bit RGB

  const stride = 1 + size * 3
  const raw = Buffer.alloc(size * stride)
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0        // filter: None
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixelFn(x, y, size)
      raw[y * stride + 1 + x * 3]     = r
      raw[y * stride + 1 + x * 3 + 1] = g
      raw[y * stride + 1 + x * 3 + 2] = b
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),   // PNG signature
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 6 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

/* ── Soccer ball geometry ─────────────────────────────────────── */
/**
 * Classic Telstar-style soccer ball viewed from above a pentagonal face:
 *   - 1 black pentagon at the centre (vertex pointing up)
 *   - 5 black pentagons arranged around it at angular offsets of 72°
 *     (offset phase: each sits between two centre-pentagon vertices)
 *
 * All other visible surface area is white (hexagon faces).
 */

function pentagonVerts(cx, cy, cr, rot) {
  return Array.from({ length: 5 }, (_, i) => {
    const a = rot + (2 * Math.PI * i) / 5
    return [cx + cr * Math.cos(a), cy + cr * Math.sin(a)]
  })
}

function insideConvex(px, py, verts) {
  for (let i = 0; i < verts.length; i++) {
    const [x1, y1] = verts[i]
    const [x2, y2] = verts[(i + 1) % verts.length]
    if ((x2 - x1) * (py - y1) - (y2 - y1) * (px - x1) < 0) return false
  }
  return true
}

// Distance from point to line segment (for stitching lines)
function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - x1, py - y1)
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

/**
 * Build pixel color for the soccer ball icon.
 * @param ballR  radius of the ball circle in pixels
 * @param ballPad  extra padding outside the ball before background
 */
function soccerBallPixel(px, py, size, ballR) {
  const cx = size / 2, cy = size / 2
  const dist = Math.hypot(px - cx, py - cy)

  /* ── Background (deep green, slight radial vignette) ── */
  if (dist > ballR + 1.5) {
    const vt = Math.min(1, dist / (size * 0.6))   // vignette toward corners
    const gr = Math.round(4  - vt * 2)
    const gg = Math.round(78 - vt * 20)
    const gb = Math.round(59 - vt * 15)
    return [Math.max(0, gr), Math.max(0, gg), Math.max(0, gb)]
  }

  /* ── Ball edge anti-alias blend ── */
  const edgeAlpha = Math.min(1, Math.max(0, ballR + 1.5 - dist))

  // Background colour at this pixel (for blending edge pixels)
  const vt = Math.min(1, dist / (size * 0.6))
  const bgColor = [Math.max(0, 4 - vt*2), Math.max(0, 78 - vt*20), Math.max(0, 59 - vt*15)]

  /* ── Pentagon sizes & positions ── */
  const pr = ballR * 0.225          // pentagon circumradius

  // Centre pentagon: vertex pointing straight up
  const centVerts = pentagonVerts(cx, cy, pr, -Math.PI / 2)

  // 5 outer pentagons.
  // Their centres sit between centre-pentagon vertices at distance outerD,
  // and each is rotated so one vertex faces the ball centre.
  const outerD = ballR * 0.525
  const outerPents = Array.from({ length: 5 }, (_, i) => {
    // Phase offset of π/5 (36°) puts centres between centre pentagon vertices
    const θ = -Math.PI / 2 + Math.PI / 5 + i * (2 * Math.PI / 5)
    const ocx = cx + outerD * Math.cos(θ)
    const ocy = cy + outerD * Math.sin(θ)
    // Rotate pentagon so vertex points toward ball centre (back along θ)
    const rot = θ + Math.PI
    return { cx: ocx, cy: ocy, verts: pentagonVerts(ocx, ocy, pr, rot), θ }
  })

  /* ── Pentagon fill ── */
  const BLACK = [18, 18, 18]
  const WHITE = [250, 250, 250]

  let isBlack = false
  if (insideConvex(px, py, centVerts)) isBlack = true
  if (!isBlack) {
    for (const op of outerPents) {
      if (insideConvex(px, py, op.verts)) { isBlack = true; break }
    }
  }

  /* ── Stitching lines (thin dark seams between patches) ── */
  let stitchDark = false
  if (!isBlack && dist < ballR - 1) {
    const lineW = Math.max(0.6, ballR * 0.022)   // line half-width in pixels

    // Lines from each centre-pentagon vertex to matching outer pentagon vertex
    for (let i = 0; i < 5; i++) {
      const cv = centVerts[i]   // vertex of centre pentagon
      // Nearest outer pentagon centre is at index i, rotated the same way
      const op = outerPents[i]
      // The outer pentagon vertex closest to the centre (vertex 0, pointing inward)
      const ov = op.verts[0]    // vertex[0] is at rot = θ+π (toward centre)
      if (distToSegment(px, py, cv[0], cv[1], ov[0], ov[1]) < lineW) {
        stitchDark = true; break
      }
    }

    // Lines connecting adjacent outer pentagons (around the equator seam)
    if (!stitchDark) {
      for (let i = 0; i < 5; i++) {
        const op1 = outerPents[i]
        const op2 = outerPents[(i + 1) % 5]
        // Nearest vertices of adjacent outer pentagons
        let minD = Infinity
        for (const v1 of op1.verts) {
          for (const v2 of op2.verts) {
            const midX = (v1[0] + v2[0]) / 2, midY = (v1[1] + v2[1]) / 2
            // Only draw segment if midpoint is on the ball
            if (Math.hypot(midX - cx, midY - cy) < ballR * 0.98) {
              minD = Math.min(minD, distToSegment(px, py, v1[0], v1[1], v2[0], v2[1]))
            }
          }
        }
        if (minD < lineW) { stitchDark = true; break }
      }
    }
  }

  const baseColor = isBlack ? BLACK : stitchDark ? [80, 80, 80] : WHITE

  /* ── Apply edge anti-aliasing for pixels near ball circumference ── */
  if (edgeAlpha >= 1) return baseColor
  return [
    Math.round(baseColor[0] * edgeAlpha + bgColor[0] * (1 - edgeAlpha)),
    Math.round(baseColor[1] * edgeAlpha + bgColor[1] * (1 - edgeAlpha)),
    Math.round(baseColor[2] * edgeAlpha + bgColor[2] * (1 - edgeAlpha)),
  ]
}

/* ── Icon variants ────────────────────────────────────────────── */

// Standard icon: ball fills ~84% of square
function pixelStandard(x, y, size) {
  return soccerBallPixel(x, y, size, size * 0.42)
}

// Maskable icon: ball must fit inside the central 80% "safe area" circle.
// We use a ball radius of 32% (so the ball + 8% padding stays within 40% safe zone).
function pixelMaskable(x, y, size) {
  return soccerBallPixel(x, y, size, size * 0.32)
}

/* ── Write all icons ──────────────────────────────────────────── */
const icons = [
  { file: 'icon-192.png',          size: 192, fn: pixelStandard },
  { file: 'icon-512.png',          size: 512, fn: pixelStandard },
  { file: 'icon-512-maskable.png', size: 512, fn: pixelMaskable },
  { file: 'apple-touch-icon.png',  size: 180, fn: pixelStandard },
]

for (const { file, size, fn } of icons) {
  console.log(`Rendering ${file} (${size}×${size})…`)
  const png = encodePNG(size, fn)
  writeFileSync(join(publicDir, file), png)
  console.log(`  ✅ ${png.length} bytes`)
}
