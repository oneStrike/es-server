import { BusinessException } from '@libs/platform/exceptions'
import {
  normalizeEmojiKeywords,
  normalizeEmojiShortcode,
  normalizeEmojiUnicodeSequence,
} from './emoji-normalizer.helper'

describe('emoji normalizer helper', () => {
  describe('normalizeEmojiUnicodeSequence', () => {
    it('keeps rendered emoji glyphs', () => {
      expect(normalizeEmojiUnicodeSequence('😀')).toBe('😀')
    })

    it.each(['1F600', 'U+1F600', '0x1F600', ['1F600']])(
      'normalizes codepoint notation %p to glyph text',
      (input) => {
        expect(normalizeEmojiUnicodeSequence(input)).toBe('😀')
      },
    )

    it('normalizes multi-codepoint sequences', () => {
      expect(normalizeEmojiUnicodeSequence('1F468 200D 1F4BB')).toBe('👨‍💻')
    })

    it('rejects non-emoji text', () => {
      expect(() => normalizeEmojiUnicodeSequence('hello')).toThrow(
        BusinessException,
      )
    })
  })

  describe('normalizeEmojiKeywords', () => {
    it('trims and deduplicates keyword arrays by locale', () => {
      expect(
        normalizeEmojiKeywords({
          'zh-CN': [' 微笑 ', '微笑'],
          'en-US': ['smile'],
        }),
      ).toEqual({
        'zh-CN': ['微笑'],
        'en-US': ['smile'],
      })
    })

    it('rejects legacy string values on new writes', () => {
      expect(() => normalizeEmojiKeywords('smile')).toThrow(BusinessException)
    })

    it('rejects locale values that are not string arrays', () => {
      expect(() => normalizeEmojiKeywords({ 'zh-CN': '微笑' })).toThrow(
        BusinessException,
      )
    })
  })

  describe('normalizeEmojiShortcode', () => {
    it('normalizes shortcode to lowercase', () => {
      expect(normalizeEmojiShortcode(' Smile_1 ')).toBe('smile_1')
    })

    it('rejects invalid shortcode characters', () => {
      expect(() => normalizeEmojiShortcode('smile-1')).toThrow(
        BusinessException,
      )
    })
  })
})
