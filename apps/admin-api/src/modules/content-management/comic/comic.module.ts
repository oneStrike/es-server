import { Module } from '@nestjs/common'
import { ComicChapterCommentModule } from './chapter-comment/comic-chapter-comment.module'
import { ChapterContentModule } from './chapter-content/chapter-content.module'
import { ComicChapterModule } from './chapter/comic-chapter.module'
import { ComicModule } from './core/comic.module'
import { ComicThirdPartyModule } from './third-party/third-party.module'

/**
 * 漫画模块
 * 提供漫画管理的完整功能
 */
@Module({
  imports: [
    ComicModule,
    ComicChapterModule,
    ComicChapterCommentModule,
    ChapterContentModule,
    ComicThirdPartyModule,
  ],
  controllers: [],
  providers: [],
  exports: [],
})
export class WorkComicModule {}
