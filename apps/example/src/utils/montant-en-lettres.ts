/** Conversion entière en toutes lettres (français) pour montants sur notes d’honoraires. */

const UNITS = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
  'dix-sept', 'dix-huit', 'dix-neuf',
]

const TENS = [
  '', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt',
]

function under100(n: number): string {
  if (n < 20) return UNITS[n]
  const ten = Math.floor(n / 10)
  const unit = n % 10
  if (ten === 7 || ten === 9) {
    return `${TENS[ten]}-${UNITS[10 + unit]}`
  }
  if (ten === 8 && unit === 0) return 'quatre-vingts'
  if (unit === 0) return TENS[ten]
  if (unit === 1 && ten !== 8) return `${TENS[ten]}-et-un`
  return `${TENS[ten]}-${UNITS[unit]}`
}

function under1000(n: number): string {
  if (n < 100) return under100(n)
  const hundred = Math.floor(n / 100)
  const rest = n % 100
  const head = hundred === 1 ? 'cent' : `${UNITS[hundred]} cent`
  if (rest === 0) return hundred > 1 ? `${head}s` : head
  return `${head} ${under100(rest)}`
}

export function entierEnLettres(n: number): string {
  if (!Number.isFinite(n) || n < 0) return ''
  n = Math.floor(n)
  if (n === 0) return 'zéro'
  if (n < 1000) return under1000(n)

  const millions = Math.floor(n / 1_000_000)
  const thousands = Math.floor((n % 1_000_000) / 1000)
  const rest = n % 1000
  const parts: string[] = []

  if (millions > 0) {
    parts.push(millions === 1 ? 'un million' : `${under1000(millions)} millions`)
  }
  if (thousands > 0) {
    parts.push(thousands === 1 ? 'mille' : `${under1000(thousands)} mille`)
  }
  if (rest > 0) parts.push(under1000(rest))

  return parts.join(' ')
}

export function montantUsdEnLettres(n: number): string {
  const words = entierEnLettres(n)
  if (!words) return '…'
  const cap = words.charAt(0).toUpperCase() + words.slice(1)
  const label = n > 1 ? 'Dollars Américains' : 'Dollar Américain'
  return `${cap} ${label}`
}
