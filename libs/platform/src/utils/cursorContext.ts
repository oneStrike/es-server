type CursorContextScalar = string | number | boolean | null

export type CursorContextValue = CursorContextScalar | CursorContextScalar[]

export type CursorContextFingerprint = Record<string, CursorContextValue>

export function normalizeCursorText(
  value: unknown,
  options: { lowerCase?: boolean, emptyValue?: string | null } = {},
): string | null {
  const emptyValue = options.emptyValue ?? null
  if (value === null || value === undefined) {
    return emptyValue
  }

  const text = String(value).trim()
  if (!text) {
    return emptyValue
  }

  return options.lowerCase === false ? text : text.toLowerCase()
}

export function normalizeCursorNumber(
  value: unknown,
  options: { allowZero?: boolean } = {},
): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const numeric = Number(value)
  const min = options.allowZero ? 0 : 1
  return Number.isInteger(numeric) && numeric >= min ? numeric : null
}

export function normalizeCursorBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined || value === '') {
    return null
  }
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') {
      return true
    }
    if (normalized === 'false') {
      return false
    }
  }

  return null
}

export function normalizeCursorNumberArray(value: unknown): number[] {
  const rawValues = Array.isArray(value)
    ? value
    : value === null || value === undefined || value === ''
      ? []
      : [value]
  const numbers = rawValues
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0)
    .sort((left, right) => left - right)

  return Array.from(new Set(numbers))
}

export function normalizeCursorEnum<T extends string | number>(
  value: T | null | undefined,
  fallback: T,
): T {
  return value ?? fallback
}

export function normalizeCursorViewerScope(userId?: number | null): string {
  const normalized = normalizeCursorNumber(userId)
  return normalized === null ? 'guest' : `user:${normalized}`
}

export function parseCursorContextFingerprint(
  input: unknown,
): CursorContextFingerprint {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('invalid cursor context fingerprint')
  }

  const fingerprint: CursorContextFingerprint = {}
  for (const [key, value] of Object.entries(input)) {
    if (!isCursorContextValue(value)) {
      throw new TypeError('invalid cursor context value')
    }
    fingerprint[key] = value
  }

  return fingerprint
}

export function isSameCursorContextFingerprint(
  left: CursorContextFingerprint,
  right: CursorContextFingerprint,
): boolean {
  return stableStringifyCursorContext(left) === stableStringifyCursorContext(right)
}

export function assertSameCursorContextFingerprint(
  left: CursorContextFingerprint,
  right: CursorContextFingerprint,
  createError: () => Error,
): void {
  if (!isSameCursorContextFingerprint(left, right)) {
    throw createError()
  }
}

function isCursorContextValue(value: unknown): value is CursorContextValue {
  if (Array.isArray(value)) {
    return value.every(isCursorContextScalar)
  }

  return isCursorContextScalar(value)
}

function isCursorContextScalar(value: unknown): value is CursorContextScalar {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  )
}

function stableStringifyCursorContext(input: CursorContextFingerprint): string {
  const ordered: CursorContextFingerprint = {}
  for (const key of Object.keys(input).sort()) {
    ordered[key] = input[key]
  }

  return JSON.stringify(ordered)
}
