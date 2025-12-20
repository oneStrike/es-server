import { Module } from '@nestjs/common'
import { WorkAuthorModule } from './author/author.module'
import { WorkCategoryModule } from './category/category.module'
import { ComicModule } from './comic/core/comic.module'
import { WorkTagModule } from './tag/tag.module'

@Module({
  imports: [ComicModule, WorkAuthorModule, WorkCategoryModule, WorkTagModule],
})
export class ContentModule {}
