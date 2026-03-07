import { UploadModule } from '@libs/base/modules'
import { InteractionModule } from '@libs/interaction'
import { UserPermissionModule } from '@libs/user/permission'
import { UserPointModule } from '@libs/user/point'
import { UserGrowthRewardModule } from '@libs/user/growth-reward'
import { Module } from '@nestjs/common'
import { ContentPermissionModule } from '../permission'
import { WorkChapterService } from './chapter/work-chapter.service'
import { ComicContentService } from './content/comic-content.service'
import { NovelContentService } from './content/novel-content.service'
import { WorkService } from './core/work.service'
import { WorkReportService } from './report/work-report.service'

@Module({
  imports: [
    InteractionModule,
    UserPermissionModule,
    ContentPermissionModule,
    UserPointModule,
    UserGrowthRewardModule,
    UploadModule,
  ],
  providers: [
    WorkService,
    WorkChapterService,
    NovelContentService,
    ComicContentService,
    WorkReportService,
  ],
  exports: [
    WorkService,
    WorkChapterService,
    NovelContentService,
    ComicContentService,
    WorkReportService,
  ],
})
export class WorkModule {}
