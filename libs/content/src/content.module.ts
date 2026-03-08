import { InteractionModule } from '@libs/interaction'
import { Module } from '@nestjs/common'
import { WorkAuthorModule } from './author/author.module'
import { WorkCategoryModule } from './category/category.module'
import { WorkTagModule } from './tag/tag.module'
import { WorkModule } from './work/work.module'

@Module({
  imports: [
    InteractionModule,
    WorkModule,
    WorkAuthorModule,
    WorkCategoryModule,
    WorkTagModule,
  ],
  exports: [
    InteractionModule,
    WorkModule,
    WorkAuthorModule,
    WorkCategoryModule,
    WorkTagModule,
  ],
})
export class ContentModule {}
