/// <reference types="jest" />

import {
  assertSameCursorContextFingerprint,
  isSameCursorContextFingerprint,
  normalizeCursorBoolean,
  normalizeCursorNumber,
  normalizeCursorNumberArray,
  normalizeCursorText,
  normalizeCursorViewerScope,
  parseCursorContextFingerprint,
} from './cursorContext'

describe('cursor context fingerprint utils', () => {
  it('normalizes common cursor context values', () => {
    expect(normalizeCursorText('  TeSt  ')).toBe('test')
    expect(normalizeCursorText('  TeSt  ', { lowerCase: false })).toBe('TeSt')
    expect(normalizeCursorText('   ', { emptyValue: '' })).toBe('')
    expect(normalizeCursorNumber('42')).toBe(42)
    expect(normalizeCursorNumber(0)).toBeNull()
    expect(normalizeCursorNumber(0, { allowZero: true })).toBe(0)
    expect(normalizeCursorBoolean('TRUE')).toBe(true)
    expect(normalizeCursorBoolean('false')).toBe(false)
    expect(normalizeCursorNumberArray([3, '1', 3, 0, '2'])).toEqual([1, 2, 3])
    expect(normalizeCursorViewerScope()).toBe('guest')
    expect(normalizeCursorViewerScope(9)).toBe('user:9')
  })

  it('compares fingerprints by stable keys and array content', () => {
    expect(
      isSameCursorContextFingerprint(
        { b: true, a: [1, 2], c: null },
        { c: null, a: [1, 2], b: true },
      ),
    ).toBe(true)
    expect(
      isSameCursorContextFingerprint(
        { a: [1, 2] },
        { a: [2, 1] },
      ),
    ).toBe(false)
  })

  it('parses only flat primitive fingerprint payloads', () => {
    expect(parseCursorContextFingerprint({ a: 'x', b: [1, null] })).toEqual({
      a: 'x',
      b: [1, null],
    })
    expect(() => parseCursorContextFingerprint(null)).toThrow(TypeError)
    expect(() => parseCursorContextFingerprint({ nested: { a: 1 } })).toThrow(
      TypeError,
    )
  })

  it('throws domain errors through the assertion hook', () => {
    expect(() =>
      assertSameCursorContextFingerprint(
        { a: 1 },
        { a: 2 },
        () => new Error('context mismatch'),
      ),
    ).toThrow('context mismatch')
  })
})
