import { Module } from '@nestjs/common'
import { ContentAuthorModule } from './author/author.module'
import { ContentCategoryModule } from './category/category.module'
import { ChapterContentModule } from './comic/chapter-content/chapter-content.module'
import { ComicChapterModule } from './comic/chapter/comic-chapter.module'
import { ComicModule } from './comic/core/comic.module'
import { ComicThirdPartyModule } from './comic/third-party/third-party.module'
import { ContentEmojiModule } from './emoji/emoji.module'
import { NovelModule } from './novel/novel.module'
import { ContentTagModule } from './tag/tag.module'

@Module({
  imports: [
    ComicModule,
    ComicChapterModule,
    ChapterContentModule,
    ComicThirdPartyModule,
    NovelModule,
    ContentEmojiModule,
    ContentAuthorModule,
    ContentCategoryModule,
    ContentTagModule,
  ],
})
export class ContentModule {}
