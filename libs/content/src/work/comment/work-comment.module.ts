import { ForumUserActionLogModule } from '@libs/forum/action-log/action-log.module'
import { SensitiveWordModule } from '@libs/sensitive-word'
import { SystemConfigModule } from '@libs/system-config'
import { UserLevelRuleModule } from '@libs/user/level-rule'
import { Module } from '@nestjs/common'
import { WorkCommentService } from './work-comment.service'

@Module({
  imports: [
    ForumUserActionLogModule,
    SensitiveWordModule,
    SystemConfigModule,
    UserLevelRuleModule,
  ],
  providers: [WorkCommentService],
  exports: [WorkCommentService],
})
export class WorkCommentModule {}
