import { DrizzleModule } from '@db/core'
import { ForumSectionModule } from '@libs/forum/section/forum-section.module'
import { UserPermissionModule } from '@libs/growth/permission/permission.module'
import { UserPointModule } from '@libs/growth/point/point.module'
import { InteractionModule } from '@libs/interaction/interaction.module'
import { ReportModule } from '@libs/interaction/report/report.module'
import { WorkflowModule } from '@libs/workflow/workflow/workflow.module'
import { Module } from '@nestjs/common'
import { WorkAuthorModule } from '../author/author.module'
import { ContentPermissionModule } from '../permission/content-permission.module'
import { WorkCounterModule } from '../work-counter/work-counter.module'
import { WorkComicChapterBrowseLogResolver } from './chapter/resolver/work-comic-chapter-browse-log.resolver'
import { WorkComicChapterCommentResolver } from './chapter/resolver/work-comic-chapter-comment.resolver'
import { WorkComicChapterDownloadResolver } from './chapter/resolver/work-comic-chapter-download.resolver'
import { WorkComicChapterLikeResolver } from './chapter/resolver/work-comic-chapter-like.resolver'
import { WorkComicChapterReportResolver } from './chapter/resolver/work-comic-chapter-report.resolver'
import { WorkNovelChapterBrowseLogResolver } from './chapter/resolver/work-novel-chapter-browse-log.resolver'
import { WorkNovelChapterCommentResolver } from './chapter/resolver/work-novel-chapter-comment.resolver'
import { WorkNovelChapterDownloadResolver } from './chapter/resolver/work-novel-chapter-download.resolver'
import { WorkNovelChapterLikeResolver } from './chapter/resolver/work-novel-chapter-like.resolver'
import { WorkNovelChapterReportResolver } from './chapter/resolver/work-novel-chapter-report.resolver'
import { WorkChapterService } from './chapter/work-chapter.service'
import { ContentImportModule } from './content-import/content-import.module'
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
    DrizzleModule,
    WorkCounterModule,
    ForumSectionModule,
    WorkAuthorModule,
    InteractionModule,
    ReportModule,
    UserPermissionModule,
    ContentPermissionModule,
    UserPointModule,
    ContentImportModule,
    WorkflowModule,
  ],
  providers: [
    WorkService,
    WorkChapterService,
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
    WorkReadingStateResolver,
    WorkComicBrowseLogResolver,
    WorkNovelBrowseLogResolver,
    WorkComicChapterBrowseLogResolver,
    WorkNovelChapterBrowseLogResolver,
  ],
  exports: [
    WorkService,
    WorkCounterModule,
    WorkChapterService,
    ContentImportModule,
  ],
})
export class WorkModule {}
