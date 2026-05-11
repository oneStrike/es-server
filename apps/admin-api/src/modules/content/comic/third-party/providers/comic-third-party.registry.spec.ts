import { BusinessException } from '@libs/platform/exceptions'
import { ComicThirdPartyRegistry } from './comic-third-party.registry'

describe('ComicThirdPartyRegistry', () => {
  const copyProvider = {
    platform: {
      code: 'copy',
      name: '拷贝',
    },
  }

  it('returns provider metadata from registered providers', () => {
    const registry = new ComicThirdPartyRegistry([copyProvider] as never)

    expect(registry.listPlatforms()).toEqual([{ code: 'copy', name: '拷贝' }])
  })

  it('resolves providers by explicit platform code', () => {
    const registry = new ComicThirdPartyRegistry([copyProvider] as never)

    expect(registry.resolve('copy')).toBe(copyProvider)
  })

  it('rejects unknown providers without dynamic property fallback', () => {
    const registry = new ComicThirdPartyRegistry([copyProvider] as never)

    expect(() => registry.resolve('copy2000')).toThrow(BusinessException)
  })
})
