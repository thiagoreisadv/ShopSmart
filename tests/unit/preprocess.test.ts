import { describe, it, expect } from 'vitest'
import { enhanceImageData, targetSize, cropRectClamp, denoise } from '@/services/ocr/preprocess'

function img(w: number, h: number, fn: (x: number, y: number) => [number, number, number]) {
  const d = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b] = fn(x, y)
      const i = (y * w + x) * 4
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255
    }
  return { width: w, height: h, data: d, colorSpace: 'srgb' } as ImageData
}

describe('pré-processamento de imagem', () => {
  it('converte para escala de cinza', () => {
    const r = enhanceImageData(img(4, 4, () => [255, 0, 0]), { contrast: false })
    expect(r.data[0]).toBe(r.data[1])
    expect(r.data[1]).toBe(r.data[2])
    expect(r.data[0]).toBeGreaterThan(70)
  })
  it('aumenta o contraste de uma imagem cinza-claro/cinza-escuro', () => {
    const r = enhanceImageData(img(20, 20, (x) => (x < 10 ? [100, 100, 100] : [150, 150, 150])))
    const vals = new Set([r.data[0], r.data[(15) * 4]])
    expect([...vals].sort((a, b) => a - b)).toEqual([0, 255])
  })
  it('imagem uniforme não vira ruído', () => {
    const r = enhanceImageData(img(8, 8, () => [128, 128, 128]))
    expect(r.data[0]).toBe(128)
  })
  it('redução de ruído atenua pixel isolado', () => {
    const r = denoise(enhanceImageData(img(5, 5, (x, y) => (x === 2 && y === 2 ? [255, 255, 255] : [0, 0, 0])), { contrast: false }))
    expect(r.data[(2 * 5 + 2) * 4]).toBeLessThan(255)
    expect(r.data[(2 * 5 + 2) * 4]).toBeGreaterThan(100)
  })
  it('redimensiona respeitando limites', () => {
    expect(targetSize(4000, 3000)).toEqual({ w: 1800, h: 1350 })
    expect(targetSize(400, 200)).toEqual({ w: 800, h: 400 })
    expect(targetSize(1200, 800)).toEqual({ w: 1200, h: 800 })
  })
  it('recorte nunca sai da imagem', () => {
    expect(cropRectClamp({ x: -10, y: 5, w: 5000, h: 5000 }, 100, 80)).toEqual({ x: 0, y: 5, w: 100, h: 75 })
    expect(cropRectClamp({ x: 200, y: 200, w: 10, h: 10 }, 100, 80)).toEqual({ x: 99, y: 79, w: 1, h: 1 })
  })
})
