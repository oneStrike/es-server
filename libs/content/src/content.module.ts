import { Module } from '@nestjs/common'
import { WorkAuthorModule } from './author/author.module'
import { WorkCategoryModule } from './category/category.module'
import { WorkTagModule } from './tag/tag.module'
import { WorkChapterModule } from './work/chapter/work-chapter.module'
import { WorkCommentModule } from './work/comment/work-comment.module'
import { ContentModule as WorkContentModule } from './work/content/content.module'
import { WorkModule } from './work/core/work.module'

/**
 * 内容模块
 * 聚合所有内容相关的子模块
 */
@Module({
  imports: [
    WorkModule,
    WorkChapterModule,
    WorkContentModule,
    WorkAuthorModule,
    WorkCategoryModule,
    WorkTagModule,
    WorkCommentModule,
  ],
  exports: [
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
