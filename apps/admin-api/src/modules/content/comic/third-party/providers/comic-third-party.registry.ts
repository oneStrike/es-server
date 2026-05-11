import type { ComicThirdPartyProvider } from './comic-third-party-provider.type'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Inject, Injectable } from '@nestjs/common'

export const COMIC_THIRD_PARTY_PROVIDERS = Symbol('COMIC_THIRD_PARTY_PROVIDERS')

@Injectable()
export class ComicThirdPartyRegistry {
  private readonly providersByCode: Map<string, ComicThirdPartyProvider>

  // 初始化 provider 映射，确保平台 code 是唯一解析入口。
  constructor(
    @Inject(COMIC_THIRD_PARTY_PROVIDERS)
    providers: ComicThirdPartyProvider[],
  ) {
    this.providersByCode = new Map(
      providers.map((provider) => [provider.platform.code, provider]),
    )
  }

  // 返回已注册的第三方漫画平台元信息。
  listPlatforms() {
    return Array.from(this.providersByCode.values()).map(
      (provider) => provider.platform,
    )
  }

  // 按显式平台 code 解析 provider，不支持动态属性兜底。
  resolve(platform: string) {
    const provider = this.providersByCode.get(platform)
    if (!provider) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '暂不支持该平台',
      )
    }
    return provider
  }
}
