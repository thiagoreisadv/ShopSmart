import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  NotFoundException,
  RGBLuminanceSource,
} from '@zxing/library'

export const SUPPORTED_FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.QR_CODE,
]

export interface DecodeResult {
  text: string
  format: string
}

let reader: MultiFormatReader | null = null
function getReader(): MultiFormatReader {
  if (!reader) {
    reader = new MultiFormatReader()
    const hints = new Map<DecodeHintType, unknown>()
    hints.set(DecodeHintType.POSSIBLE_FORMATS, SUPPORTED_FORMATS)
    hints.set(DecodeHintType.TRY_HARDER, true)
    reader.setHints(hints)
  }
  return reader
}

/** Decodifica um quadro em tons de cinza (1 byte por pixel). Retorna null quando não há código. */
export function decodeLuminance(width: number, height: number, luma: Uint8ClampedArray): DecodeResult | null {
  const source = new RGBLuminanceSource(luma, width, height)
  const bitmap = new BinaryBitmap(new HybridBinarizer(source))
  try {
    const r = getReader().decodeWithState(bitmap)
    return { text: r.getText(), format: BarcodeFormat[r.getBarcodeFormat()] }
  } catch (e) {
    if (e instanceof NotFoundException) return null
    return null
  }
}

/** Converte RGBA (ImageData) em luminância. */
export function rgbaToLuma(data: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height)
  for (let i = 0, j = 0; j < out.length; i += 4, j++) {
    out[j] = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000
  }
  return out
}
