import { WorkCategoryModule as WorkCategoryCoreModule } from '@libs/content/category/category.module'
import { WorkTagModule as WorkTagCoreModule } from '@libs/content/tag/tag.module'
import { WorkModule as WorkCoreModule } from '@libs/content/work/work.module'
import { CommentModule as CommentCoreModule } from '@libs/interaction/comment/comment.module'
import { Module } from '@nestjs/common'
import { WorkCategoryController } from './work-category.controller'
import { WorkChapterController } from './work-chapter.controller'
import { WorkTagController } from './work-tag.controller'
import { WorkController } from './work.controller'

@Module({
  imports: [
    WorkCoreModule,
    WorkCategoryCoreModule,
    WorkTagCoreModule,
    CommentCoreModule,
  ],
  controllers: [
    WorkController,
    WorkCategoryController,
    WorkTagController,
    WorkChapterController,
  ],
})
export class WorkModule {}
