import { SensitiveWordModule } from '@libs/sensitive-word'
import { SystemConfigModule } from '@libs/system-config'
import { Module } from '@nestjs/common'
import { CommentInteractionService } from './comment-interaction.service'
import { CommentPermissionService } from './comment-permission.service'
import { CommentService } from './comment.service'

@Module({
  imports: [SensitiveWordModule, SystemConfigModule],
  providers: [
    CommentService,
    CommentPermissionService,
    CommentInteractionService,
  ],
  exports: [CommentService, CommentInteractionService],
})
export class CommentModule {}
