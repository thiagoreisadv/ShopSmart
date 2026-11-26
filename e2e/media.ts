import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011']
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111']
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100']
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL']

function ean13Bits(code: string): string {
  const p = PARITY[Number(code[0])]
  let bits = '101'
  for (let i = 0; i < 6; i++) bits += (p[i] === 'L' ? L : G)[Number(code[i + 1])]
  bits += '01010'
  for (let i = 0; i < 6; i++) bits += R[Number(code[i + 7])]
  return bits + '101'
}

/** Gera um vídeo Y4M (usado como "câmera falsa" do Chromium) mostrando um EAN-13 grande e centralizado. */
export function writeBarcodeY4m(code: string): string {
  const W = 640
  const H = 480
  const bits = ean13Bits(code)
  const scale = 5
  const quiet = 14
  const total = (bits.length + quiet * 2) * scale
  const y = new Uint8Array(W * H).fill(255)
  const x0 = Math.floor((W - total) / 2) + quiet * scale
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] !== '1') continue
    for (let dx = 0; dx < scale; dx++) for (let row = 110; row < 330; row++) y[row * W + x0 + i * scale + dx] = 0
  }
  const u = new Uint8Array((W / 2) * (H / 2)).fill(128)
  const header = Buffer.from(`YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\n`)
  const frame = Buffer.concat([Buffer.from('FRAME\n'), Buffer.from(y), Buffer.from(u), Buffer.from(u)])
  const file = path.join(os.tmpdir(), `shopsmart-barcode-${code}.y4m`)
  fs.writeFileSync(file, Buffer.concat([header, ...Array.from({ length: 10 }, () => frame)]))
  return file
}

/** Vídeo "câmera apontada para uma parede branca": sem código de barras. */
export function writeBlankY4m(): string {
  const W = 640
  const H = 480
  const y = Buffer.alloc(W * H, 235)
  const u = Buffer.alloc((W / 2) * (H / 2), 128)
  const header = Buffer.from(`YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\n`)
  const frame = Buffer.concat([Buffer.from('FRAME\n'), y, u, u])
  const file = path.join(os.tmpdir(), 'shopsmart-blank.y4m')
  fs.writeFileSync(file, Buffer.concat([header, ...Array.from({ length: 10 }, () => frame)]))
  return file
}
