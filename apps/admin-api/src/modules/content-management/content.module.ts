import { Module } from '@nestjs/common'
import { WorkAuthorModule } from './author/author.module'
import { WorkCategoryModule } from './category/category.module'
import { ComicChapterModule } from './comic/chapter/comic-chapter.module'
import { ChapterContentModule } from './comic/chapter-content/chapter-content.module'
import { ComicModule } from './comic/core/comic.module'
import { ComicThirdPartyModule } from './comic/third-party/third-party.module'
import { NovelModule } from './novel/novel.module'
import { WorkTagModule } from './tag/tag.module'

@Module({
  imports: [
    ComicModule,
    ComicChapterModule,
    ChapterContentModule,
    ComicThirdPartyModule,
    NovelModule,
    WorkAuthorModule,
    WorkCategoryModule,
    WorkTagModule,
  ],
})
export class ContentModule {}
