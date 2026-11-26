/**
 * Motor de OCR local (Tesseract.js), carregado SOB DEMANDA: o pacote só é baixado quando o usuário
 * abre a leitura de etiqueta. O worker, o núcleo WASM e o idioma português são hospedados no próprio site (/ocr/).
 */
import type { Worker as TessWorker } from 'tesseract.js'

export interface OcrResult {
  text: string
  /** confiança média 0–100 */
  confidence: number
}

let worker: Promise<TessWorker> | null = null
let idleTimer: number | undefined

export function ocrAssetsBase(): string {
  return `${import.meta.env.BASE_URL}ocr/`
}

async function getWorker(onStatus?: (s: string, p: number) => void): Promise<TessWorker> {
  if (!worker) {
    worker = (async () => {
      const { createWorker } = await import('tesseract.js')
      const base = new URL(ocrAssetsBase(), window.location.href).href
      return createWorker('por', 1, {
        workerPath: `${base}worker.min.js`,
        corePath: `${base}core`,
        langPath: `${base}lang`,
        gzip: true,
        logger: (m: { status: string; progress: number }) => onStatus?.(m.status, m.progress),
        errorHandler: () => {},
      })
    })()
    worker.catch(() => {
      worker = null
    })
  }
  return worker
}

export async function recognize(canvas: HTMLCanvasElement, onStatus?: (stage: string, progress: number) => void): Promise<OcrResult> {
  window.clearTimeout(idleTimer)
  const w = await getWorker(onStatus)
  await w.setParameters({
    tessedit_pageseg_mode: '6' as never, // bloco uniforme de texto: etiquetas costumam ter poucas linhas
    preserve_interword_spaces: '1',
  })
  const { data } = await w.recognize(canvas)
  // libera memória do worker após 45s sem uso (aparelhos com pouca RAM)
  idleTimer = window.setTimeout(disposeOcr, 45_000)
  return { text: data.text ?? '', confidence: data.confidence ?? 0 }
}

export async function disposeOcr(): Promise<void> {
  window.clearTimeout(idleTimer)
  const w = worker
  worker = null
  if (w) {
    try {
      await (await w).terminate()
    } catch {
      /* ignore */
    }
  }
}
