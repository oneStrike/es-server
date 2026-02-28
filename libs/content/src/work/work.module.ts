import { UploadModule } from '@libs/base/modules'
import { InteractionModule } from '@libs/interaction'
import { UserBalanceModule } from '@libs/user/balance'
import { UserGrowthEventModule } from '@libs/user/growth-event'
import { UserPermissionModule } from '@libs/user/permission'
import { UserPointModule } from '@libs/user/point'
import { Module } from '@nestjs/common'
import { ContentPermissionModule } from '../permission'
import { WorkChapterService } from './chapter/work-chapter.service'
import { ComicContentService } from './content/comic-content.service'
import { NovelContentService } from './content/novel-content.service'
import { WorkService } from './core/work.service'

@Module({
  imports: [
    InteractionModule,
    UserGrowthEventModule,
    UserPermissionModule,
    ContentPermissionModule,
    InteractionModule,
    UserGrowthEventModule,
    UserPermissionModule,
    UserPointModule,
    UserBalanceModule,
    UploadModule,
  ],
  providers: [
    WorkService,
    WorkChapterService,
    NovelContentService,
    ComicContentService,
  ],
  exports: [
    WorkService,
    WorkChapterService,
    NovelContentService,
    ComicContentService,
  ],
})
export class WorkModule {}
