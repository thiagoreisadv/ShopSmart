import { useCallback, useEffect, useRef, useState } from 'react'

export type CameraStatus = 'idle' | 'starting' | 'ready' | 'error'
export interface CameraError {
  kind: 'denied' | 'notfound' | 'busy' | 'insecure' | 'unsupported' | 'unknown'
  message: string
}

export function describeCameraError(e: unknown): CameraError {
  const name = (e as { name?: string })?.name
  if (typeof window !== 'undefined' && !window.isSecureContext) return { kind: 'insecure', message: 'A câmera só funciona em conexão segura (https).' }
  if (!navigator.mediaDevices?.getUserMedia) return { kind: 'unsupported', message: 'Este navegador não permite usar a câmera.' }
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    return {
      kind: 'denied',
      message: ios
        ? 'Permissão da câmera negada. No iPhone: Ajustes › Safari › Câmera › Permitir (ou toque em "aA" na barra do Safari › Ajustes do site).'
        : 'Permissão da câmera negada. Habilite a câmera nas configurações do navegador para este site.',
    }
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return { kind: 'notfound', message: 'Nenhuma câmera foi encontrada neste aparelho.' }
  if (name === 'NotReadableError' || name === 'AbortError') return { kind: 'busy', message: 'A câmera está em uso por outro aplicativo. Feche-o e tente novamente.' }
  return { kind: 'unknown', message: 'Não foi possível acessar a câmera.' }
}

/**
 * Abre a câmera traseira e GARANTE a liberação do hardware ao desmontar, ao esconder a aba
 * e ao chamar stop() (evita a câmera "presa" no iPhone/Android).
 */
export function useCamera(enabled: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [error, setError] = useState<CameraError | null>(null)
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchOn, setTorchOn] = useState(false)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.srcObject = null
    }
    setTorchOn(false)
  }, [])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setStatus('starting')
    setError(null)
    ;(async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('unsupported'), { name: 'Unsupported' })
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const v = videoRef.current
        if (v) {
          v.srcObject = stream
          v.setAttribute('playsinline', 'true')
          v.muted = true
          await v.play().catch(() => {})
        }
        const track = stream.getVideoTracks()[0]
        const caps = (track?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean }
        setTorchSupported(!!caps.torch)
        setStatus('ready')
      } catch (e) {
        if (cancelled) return
        setError(describeCameraError(e))
        setStatus('error')
      }
    })()
    const onHide = () => document.visibilityState === 'hidden' && stop()
    document.addEventListener('visibilitychange', onHide)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onHide)
      stop()
    }
  }, [enabled, stop])

  const setTorch = useCallback(async (on: boolean) => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    try {
      await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] })
      setTorchOn(on)
    } catch {
      setTorchSupported(false)
    }
  }, [])

  /** Captura um quadro do vídeo em um canvas. */
  const grabFrame = useCallback((maxSide = 2000): HTMLCanvasElement | null => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return null
    const scale = Math.min(1, maxSide / Math.max(v.videoWidth, v.videoHeight))
    const c = document.createElement('canvas')
    c.width = Math.round(v.videoWidth * scale)
    c.height = Math.round(v.videoHeight * scale)
    c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height)
    return c
  }, [])

  return { videoRef, status, error, torchSupported, torchOn, setTorch, grabFrame, stop }
}
