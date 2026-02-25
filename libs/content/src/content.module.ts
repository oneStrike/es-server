import { InteractionModule } from '@libs/interaction'
import { Module } from '@nestjs/common'
import { WorkAuthorModule } from './author/author.module'
import { WorkCategoryModule } from './category/category.module'
import { WorkTagModule } from './tag/tag.module'
import { WorkChapterModule } from './work/chapter/work-chapter.module'
import { WorkCommentModule } from './work/comment/work-comment.module'
import { ContentModule as WorkContentModule } from './work/content/content.module'
import { WorkModule } from './work/core/work.module'
import { ContentInteractionModule } from './interaction'

@Module({
  imports: [
    InteractionModule,
    ContentInteractionModule,
    WorkModule,
    WorkChapterModule,
    WorkContentModule,
    WorkAuthorModule,
    WorkCategoryModule,
    WorkTagModule,
    WorkCommentModule,
  ],
  exports: [
    InteractionModule,
    WorkModule,
    WorkChapterModule,
    WorkContentModule,
    WorkAuthorModule,
    WorkCategoryModule,
    WorkTagModule,
    WorkCommentModule,
  ],
})
export class ContentModule {}
