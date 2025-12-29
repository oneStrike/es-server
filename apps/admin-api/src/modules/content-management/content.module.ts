import { Module } from '@nestjs/common'
import { WorkAuthorModule } from './author/author.module'
import { WorkCategoryModule } from './category/category.module'
import { WorkComicModule } from './comic/comic.module'
import { WorkTagModule } from './tag/tag.module'

@Module({
  imports: [
    WorkComicModule,
    WorkAuthorModule,
    WorkCategoryModule,
    WorkTagModule,
  ],
})
export class ContentModule {}
