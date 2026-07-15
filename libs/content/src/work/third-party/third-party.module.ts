import type { ComicThirdPartyRuntimeModuleRegisterOptions } from './third-party.module.type'
import { DrizzleModule } from '@db/core'
import { SystemConfigModule } from '@libs/config/system-config/system-config.module'
import { DynamicModule, Module } from '@nestjs/common'
import {
  COMIC_THIRD_PARTY_PROVIDERS,
  ComicThirdPartyRegistry,
} from './providers/comic-third-party.registry'
import { CopyMangaHttpClient } from './providers/copy-manga-http.client'
import { CopyMangaProvider } from './providers/copy-manga.provider'
import { RemoteImageImportService } from './services/remote-image-import.service'
import { ThirdPartyComicBindingService } from './services/third-party-comic-binding.service'
import { ThirdPartyResourceThrottleService } from './services/third-party-resource-throttle.service'

/** 三方漫画运行时模块必须由应用组合根显式绑定上传和内容上传 runtime。 */
@Module({})
export class ComicThirdPartyRuntimeModule {
  static register(
    options: ComicThirdPartyRuntimeModuleRegisterOptions,
  ): DynamicModule {
    return {
      module: ComicThirdPartyRuntimeModule,
      imports: [
        DrizzleModule,
        SystemConfigModule,
        options.uploadRuntimeModule,
        options.workUploadRuntimeModule,
      ],
      providers: [
        ComicThirdPartyRegistry,
        CopyMangaHttpClient,
        CopyMangaProvider,
        RemoteImageImportService,
        ThirdPartyComicBindingService,
        ThirdPartyResourceThrottleService,
        {
          provide: COMIC_THIRD_PARTY_PROVIDERS,
          useFactory: (copyMangaProvider: CopyMangaProvider) => [
            copyMangaProvider,
          ],
          inject: [CopyMangaProvider],
        },
      ],
      exports: [
        ComicThirdPartyRegistry,
        RemoteImageImportService,
        ThirdPartyComicBindingService,
        ThirdPartyResourceThrottleService,
      ],
    }
  }
}
