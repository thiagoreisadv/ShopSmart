/** Identificador único (UUID v4 quando disponível). */
export function uid(prefix = ''): string {
  const c = globalThis.crypto
  const raw =
    c && 'randomUUID' in c
      ? c.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
          const r = (Math.random() * 16) | 0
          return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16)
        })
  return prefix + raw
}

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
