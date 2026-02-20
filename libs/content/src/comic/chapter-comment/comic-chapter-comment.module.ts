import { ForumUserActionLogModule } from '@libs/forum/action-log/action-log.module'
import { SensitiveWordModule } from '@libs/sensitive-word'
import { SystemConfigModule } from '@libs/system-config'
import { UserLevelRuleModule } from '@libs/user/level-rule'
import { Module } from '@nestjs/common'
import { ComicChapterCommentService } from './comic-chapter-comment.service'

@Module({
  imports: [
    SensitiveWordModule,
    SystemConfigModule,
    UserLevelRuleModule,
    ForumUserActionLogModule,
  ],
  providers: [ComicChapterCommentService],
  exports: [ComicChapterCommentService],
})
export class ComicChapterCommentModule {}
