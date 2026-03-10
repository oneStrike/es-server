import { Module } from '@nestjs/common'
import { WorkAuthorModule } from './author/author.module'
import { WorkCategoryModule } from './category/category.module'
import { WorkTagModule } from './tag/tag.module'
import { WorkModule } from './work/work.module'

@Module({
  imports: [WorkModule, WorkAuthorModule, WorkCategoryModule, WorkTagModule],
  exports: [WorkModule, WorkAuthorModule, WorkCategoryModule, WorkTagModule],
})
export class ContentModule {}
