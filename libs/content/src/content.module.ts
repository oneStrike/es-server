import { InteractionModule } from '@libs/interaction'
import { Module } from '@nestjs/common'
import { WorkAuthorModule } from './author/author.module'
import { WorkCategoryModule } from './category/category.module'
import { ContentInteractionModule } from './interaction'
import { WorkTagModule } from './tag/tag.module'
import { WorkCommentModule } from './work/comment/work-comment.module'
import { WorkModule } from './work/work.module'

@Module({
  imports: [
    InteractionModule,
    ContentInteractionModule,
    WorkModule,
    WorkAuthorModule,
    WorkCategoryModule,
    WorkTagModule,
    WorkCommentModule,
  ],
  exports: [
    InteractionModule,
    WorkModule,
    WorkAuthorModule,
    WorkCategoryModule,
    WorkTagModule,
    WorkCommentModule,
  ],
})
export class ContentModule {}
