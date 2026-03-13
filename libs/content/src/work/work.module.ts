import { InteractionModule, ReportModule } from '@libs/interaction'
import { UploadModule } from '@libs/platform/modules'
import { UserPermissionModule, UserPointModule } from '@libs/user'

import { Module } from '@nestjs/common'
import { ContentPermissionModule } from '../permission'
import { WorkComicChapterLikeResolver } from './chapter/resolver/work-comic-chapter-like.resolver'
import { WorkComicChapterReportResolver } from './chapter/resolver/work-comic-chapter-report.resolver'
import { WorkNovelChapterLikeResolver } from './chapter/resolver/work-novel-chapter-like.resolver'
import { WorkNovelChapterReportResolver } from './chapter/resolver/work-novel-chapter-report.resolver'
import { WorkChapterService } from './chapter/work-chapter.service'
import { ComicContentService } from './content/comic-content.service'
import { NovelContentService } from './content/novel-content.service'
import { WorkComicFavoriteResolver } from './core/resolver/work-comic-favorite.resolver'
import { WorkComicLikeResolver } from './core/resolver/work-comic-like.resolver'
import { WorkComicReportResolver } from './core/resolver/work-comic-report.resolver'
import { WorkNovelFavoriteResolver } from './core/resolver/work-novel-favorite.resolver'
import { WorkNovelLikeResolver } from './core/resolver/work-novel-like.resolver'
import { WorkNovelReportResolver } from './core/resolver/work-novel-report.resolver'
import { WorkService } from './core/work.service'

@Module({
  imports: [
    InteractionModule,
    ReportModule,
    UserPermissionModule,
    ContentPermissionModule,
    UserPointModule,
    UploadModule,
  ],
  providers: [
    WorkService,
    WorkChapterService,
    NovelContentService,
    ComicContentService,
    WorkComicFavoriteResolver,
    WorkNovelFavoriteResolver,
    WorkComicLikeResolver,
    WorkNovelLikeResolver,
    WorkComicReportResolver,
    WorkNovelReportResolver,
    WorkComicChapterLikeResolver,
    WorkNovelChapterLikeResolver,
    WorkComicChapterReportResolver,
    WorkNovelChapterReportResolver,
  ],
  exports: [
    WorkService,
    WorkChapterService,
    NovelContentService,
    ComicContentService,
  ],
})
export class WorkModule {}
