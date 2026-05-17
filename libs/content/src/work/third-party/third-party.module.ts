import { UploadModule } from '@libs/platform/modules/upload/upload.module'
import { SystemConfigModule } from '@libs/system-config/system-config.module'
import { Module } from '@nestjs/common'
import {
  COMIC_THIRD_PARTY_PROVIDERS,
  ComicThirdPartyRegistry,
} from './providers/comic-third-party.registry'
import { CopyMangaHttpClient } from './providers/copy-manga-http.client'
import { CopyMangaProvider } from './providers/copy-manga.provider'
import { RemoteImageImportService } from './services/remote-image-import.service'
import { ThirdPartyComicBindingService } from './services/third-party-comic-binding.service'
import { ThirdPartyResourceThrottleService } from './services/third-party-resource-throttle.service'

@Module({
  imports: [
    SystemConfigModule,
    UploadModule.register({
      imports: [SystemConfigModule],
    }),
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
      useFactory: (copyMangaProvider: CopyMangaProvider) => [copyMangaProvider],
      inject: [CopyMangaProvider],
    },
  ],
  exports: [
    ComicThirdPartyRegistry,
    RemoteImageImportService,
    ThirdPartyComicBindingService,
    ThirdPartyResourceThrottleService,
  ],
})
export class ComicThirdPartyRuntimeModule {}
