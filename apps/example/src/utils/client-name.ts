/** Normalisation pour comparaison de noms de clients (sans accents, casse). */
export function normalizeClientName(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function clientNamesMatch(a: string, b: string): boolean {
  const left = normalizeClientName(a)
  const right = normalizeClientName(b)
  return left.length > 0 && left === right
}
