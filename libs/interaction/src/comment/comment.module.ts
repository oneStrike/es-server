import { SensitiveWordModule } from '@libs/sensitive-word'
import { SystemConfigModule } from '@libs/system-config'
import { Module } from '@nestjs/common'
import { CommentCountService } from './comment-count.service'
import { CommentInteractionService } from './comment-interaction.service'
import { CommentPermissionService } from './comment-permission.service'
import { CommentService } from './comment.service'

@Module({
  imports: [SensitiveWordModule, SystemConfigModule],
  providers: [
    CommentService,
    CommentPermissionService,
    CommentCountService,
    CommentInteractionService,
  ],
  exports: [CommentService, CommentInteractionService],
})
export class CommentModule {}
