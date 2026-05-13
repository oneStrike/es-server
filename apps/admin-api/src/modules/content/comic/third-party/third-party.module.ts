import { WorkModule } from '@libs/content/work/work.module'
import { BackgroundTaskModule } from '@libs/platform/modules/background-task/background-task.module'
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
import { ThirdPartyComicImportBackgroundHandler } from './services/third-party-comic-import-background.handler'
import { ThirdPartyComicImportService } from './services/third-party-comic-import.service'
import { ComicThirdPartyService } from './third-party-service'
import { ComicThirdPartyController } from './third-party.controller'

@Module({
  imports: [
    BackgroundTaskModule,
    WorkModule,
    SystemConfigModule,
    UploadModule.register({
      imports: [SystemConfigModule],
    }),
  ],
  controllers: [ComicThirdPartyController],
  providers: [
    ComicThirdPartyService,
    ComicThirdPartyRegistry,
    CopyMangaHttpClient,
    CopyMangaProvider,
    RemoteImageImportService,
    ThirdPartyComicImportService,
    ThirdPartyComicImportBackgroundHandler,
    {
      provide: COMIC_THIRD_PARTY_PROVIDERS,
      useFactory: (copyMangaProvider: CopyMangaProvider) => [copyMangaProvider],
      inject: [CopyMangaProvider],
    },
  ],
  exports: [ComicThirdPartyService],
})
export class ComicThirdPartyModule {}
