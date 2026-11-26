/**
 * Pré-processamento de imagens de etiquetas para melhorar o OCR:
 * orientação, redimensionamento, escala de cinza, contraste, redução de ruído e recorte.
 */

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Escala cinza + alongamento de contraste por percentis (2%–98%). Opera in place em ImageData. */
export function enhanceImageData(img: ImageData, opts: { contrast?: boolean } = {}): ImageData {
  const d = img.data
  const n = img.width * img.height
  const hist = new Uint32Array(256)
  for (let i = 0, j = 0; j < n; i += 4, j++) {
    const g = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000
    d[i] = d[i + 1] = d[i + 2] = g
    hist[g | 0]++
  }
  if (opts.contrast !== false) {
    const lowCut = n * 0.02
    const highCut = n * 0.98
    let acc = 0
    let lo = 0
    let hi = 255
    for (let v = 0; v < 256; v++) {
      acc += hist[v]
      if (acc >= lowCut) {
        lo = v
        break
      }
    }
    acc = 0
    for (let v = 0; v < 256; v++) {
      acc += hist[v]
      if (acc >= highCut) {
        hi = v
        break
      }
    }
    if (hi - lo >= 8) {
      const scale = 255 / (hi - lo)
      for (let i = 0; i < d.length; i += 4) {
        const v = Math.max(0, Math.min(255, (d[i] - lo) * scale))
        d[i] = d[i + 1] = d[i + 2] = v
      }
    }
  }
  return img
}

/** Média 3×3 simples nos canais (já em cinza) para reduzir ruído de sensor. */
export function denoise(img: ImageData): ImageData {
  const { width: w, height: h, data } = img
  const src = new Uint8ClampedArray(data)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let s = 0
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += src[((y + dy) * w + (x + dx)) * 4]
      const v = s / 9
      const i = (y * w + x) * 4
      // mistura 50/50 para não borrar demais os caracteres finos
      const m = (src[i] + v) / 2
      data[i] = data[i + 1] = data[i + 2] = m
    }
  }
  return img
}

/** Escala para caber em maxSide e garante um mínimo de altura útil para texto pequeno. */
export function targetSize(w: number, h: number, maxSide = 1800, minSide = 900): { w: number; h: number } {
  const longSide = Math.max(w, h)
  let s = 1
  if (longSide > maxSide) s = maxSide / longSide
  else if (longSide < minSide) s = Math.min(2, minSide / longSide)
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) }
}

export function cropRectClamp(r: Rect, w: number, h: number): Rect {
  const x = Math.max(0, Math.min(w - 1, Math.round(r.x)))
  const y = Math.max(0, Math.min(h - 1, Math.round(r.y)))
  return { x, y, w: Math.max(1, Math.min(w - x, Math.round(r.w))), h: Math.max(1, Math.min(h - y, Math.round(r.h))) }
}

/** Carrega um arquivo de imagem respeitando a orientação EXIF (fotos de iPhone vêm "deitadas"). */
export async function fileToCanvas(file: Blob, maxSide = 2400): Promise<HTMLCanvasElement> {
  let bitmap: ImageBitmap | HTMLImageElement
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    bitmap = await new Promise<HTMLImageElement>((res, rej) => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        URL.revokeObjectURL(url)
        res(img)
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        rej(new Error('Imagem inválida'))
      }
      img.src = url
    })
  }
  const w = 'naturalWidth' in bitmap ? bitmap.naturalWidth : bitmap.width
  const h = 'naturalHeight' in bitmap ? bitmap.naturalHeight : bitmap.height
  const s = Math.min(1, maxSide / Math.max(w, h))
  const c = document.createElement('canvas')
  c.width = Math.round(w * s)
  c.height = Math.round(h * s)
  c.getContext('2d')!.drawImage(bitmap, 0, 0, c.width, c.height)
  if ('close' in bitmap) bitmap.close()
  return c
}

/** Recorta e prepara o canvas para o OCR. */
export function prepareForOcr(src: HTMLCanvasElement, crop?: Rect, opts: { denoise?: boolean } = {}): HTMLCanvasElement {
  const r = crop ? cropRectClamp(crop, src.width, src.height) : { x: 0, y: 0, w: src.width, h: src.height }
  const t = targetSize(r.w, r.h)
  const out = document.createElement('canvas')
  out.width = t.w
  out.height = t.h
  const ctx = out.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, r.x, r.y, r.w, r.h, 0, 0, t.w, t.h)
  let img = ctx.getImageData(0, 0, t.w, t.h)
  img = enhanceImageData(img)
  if (opts.denoise !== false && t.w * t.h <= 2_500_000) img = denoise(img)
  ctx.putImageData(img, 0, 0)
  return out
}

/** Libera a memória de um canvas (importante no iOS) — as imagens do OCR não são guardadas. */
export function disposeCanvas(c: HTMLCanvasElement | null | undefined): void {
  if (!c) return
  c.width = 0
  c.height = 0
}
