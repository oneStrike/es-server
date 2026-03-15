import { UserPermissionModule, UserPointModule } from '@libs/growth'
import { InteractionModule, ReportModule } from '@libs/interaction'
import { UploadModule } from '@libs/platform/modules'

import { Module } from '@nestjs/common'
import { ContentPermissionModule } from '../permission'
import { WorkComicChapterBrowseLogResolver } from './chapter/resolver/work-comic-chapter-browse-log.resolver'
import { WorkComicChapterCommentResolver } from './chapter/resolver/work-comic-chapter-comment.resolver'
import { WorkComicChapterDownloadResolver } from './chapter/resolver/work-comic-chapter-download.resolver'
import { WorkComicChapterLikeResolver } from './chapter/resolver/work-comic-chapter-like.resolver'
import { WorkComicChapterPurchaseResolver } from './chapter/resolver/work-comic-chapter-purchase.resolver'
import { WorkComicChapterReportResolver } from './chapter/resolver/work-comic-chapter-report.resolver'
import { WorkNovelChapterBrowseLogResolver } from './chapter/resolver/work-novel-chapter-browse-log.resolver'
import { WorkNovelChapterCommentResolver } from './chapter/resolver/work-novel-chapter-comment.resolver'
import { WorkNovelChapterDownloadResolver } from './chapter/resolver/work-novel-chapter-download.resolver'
import { WorkNovelChapterLikeResolver } from './chapter/resolver/work-novel-chapter-like.resolver'
import { WorkNovelChapterPurchaseResolver } from './chapter/resolver/work-novel-chapter-purchase.resolver'
import { WorkNovelChapterReportResolver } from './chapter/resolver/work-novel-chapter-report.resolver'
import { WorkChapterService } from './chapter/work-chapter.service'
import { ComicContentService } from './content/comic-content.service'
import { NovelContentService } from './content/novel-content.service'
import { WorkComicBrowseLogResolver } from './core/resolver/work-comic-browse-log.resolver'
import { WorkComicCommentResolver } from './core/resolver/work-comic-comment.resolver'
import { WorkComicFavoriteResolver } from './core/resolver/work-comic-favorite.resolver'
import { WorkComicLikeResolver } from './core/resolver/work-comic-like.resolver'
import { WorkComicReportResolver } from './core/resolver/work-comic-report.resolver'
import { WorkNovelBrowseLogResolver } from './core/resolver/work-novel-browse-log.resolver'
import { WorkNovelCommentResolver } from './core/resolver/work-novel-comment.resolver'
import { WorkNovelFavoriteResolver } from './core/resolver/work-novel-favorite.resolver'
import { WorkNovelLikeResolver } from './core/resolver/work-novel-like.resolver'
import { WorkNovelReportResolver } from './core/resolver/work-novel-report.resolver'
import { WorkReadingStateResolver } from './core/resolver/work-reading-state.resolver'
import { WorkService } from './core/work.service'

/**
 * 作品模块
 * 整合漫画、小说的作品和章节相关功能
 */
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
    WorkComicCommentResolver,
    WorkNovelCommentResolver,
    WorkComicChapterLikeResolver,
    WorkNovelChapterLikeResolver,
    WorkComicChapterReportResolver,
    WorkNovelChapterReportResolver,
    WorkComicChapterCommentResolver,
    WorkNovelChapterCommentResolver,
    WorkComicChapterDownloadResolver,
    WorkNovelChapterDownloadResolver,
    WorkComicChapterPurchaseResolver,
    WorkNovelChapterPurchaseResolver,
    WorkReadingStateResolver,
    WorkComicBrowseLogResolver,
    WorkNovelBrowseLogResolver,
    WorkComicChapterBrowseLogResolver,
    WorkNovelChapterBrowseLogResolver,
  ],
  exports: [
    WorkService,
    WorkChapterService,
    NovelContentService,
    ComicContentService,
  ],
})
export class WorkModule {}
