const PLACEHOLDER_VALUES = new Set([
  '',
  'Non précisé',
  'Non précisée',
  '—',
])

/** Valeurs uniques triées, issues d’une liste de chaînes (données déjà enregistrées). */
export function collectUniqueStrings(
  values: Iterable<string>,
  options: { excludePlaceholders?: boolean } = {},
): string[] {
  const exclude = options.excludePlaceholders !== false
  const set = new Set<string>()
  for (const raw of values) {
    const value = raw.trim()
    if (!value) continue
    if (exclude && PLACEHOLDER_VALUES.has(value)) continue
    set.add(value)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }))
}

export function collectFromRecords(
  records: Record<string, unknown>[],
  keys: string[],
): string[] {
  const values: string[] = []
  for (const record of records) {
    for (const key of keys) {
      const v = record[key]
      if (v != null && String(v).trim()) values.push(String(v))
    }
  }
  return collectUniqueStrings(values)
}
