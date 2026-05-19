import { resolveThirdPartyComicImportImageTotal } from './third-party-comic-import-image-total'

describe('resolveThirdPartyComicImportImageTotal', () => {
  it('returns the expected image count when images will be imported', () => {
    expect(
      resolveThirdPartyComicImportImageTotal({
        imageCount: 53,
        importImages: true,
        providerChapterId: 'chapter-001',
      }),
    ).toBe(53)
  })

  it('keeps an explicit zero expected image count', () => {
    expect(
      resolveThirdPartyComicImportImageTotal({
        imageCount: 0,
        importImages: true,
        providerChapterId: 'chapter-001',
      }),
    ).toBe(0)
  })

  it('returns zero when chapter image import is disabled with a valid imageCount', () => {
    expect(
      resolveThirdPartyComicImportImageTotal({
        imageCount: 53,
        importImages: false,
        providerChapterId: 'chapter-001',
      }),
    ).toBe(0)
  })

  it.each([undefined, null, '53', Number.NaN, Infinity, -1, 1.5])(
    'rejects invalid expected image count %p',
    (imageCount) => {
      expect(() =>
        resolveThirdPartyComicImportImageTotal({
          imageCount,
          importImages: true,
          providerChapterId: 'chapter-001',
        } as never),
      ).toThrow('三方章节图片数必须是非负整数')
    },
  )

  it.each([undefined, null, '53', Number.NaN, Infinity, -1, 1.5])(
    'rejects invalid expected image count %p even when image import is disabled',
    (imageCount) => {
      expect(() =>
        resolveThirdPartyComicImportImageTotal({
          imageCount,
          importImages: false,
          providerChapterId: 'chapter-001',
        } as never),
      ).toThrow('三方章节图片数必须是非负整数')
    },
  )
})
