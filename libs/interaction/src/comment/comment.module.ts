import { SensitiveWordModule } from '@libs/sensitive-word'
import { SystemConfigModule } from '@libs/system-config'
import { GrowthLedgerModule } from '@libs/user/growth-ledger'
import { Module } from '@nestjs/common'
import { CommentGrowthService } from './comment-growth.service'
import { CommentInteractionService } from './comment-interaction.service'
import { CommentPermissionService } from './comment-permission.service'
import { CommentService } from './comment.service'

@Module({
  imports: [SensitiveWordModule, SystemConfigModule, GrowthLedgerModule],
  providers: [
    CommentGrowthService,
    CommentService,
    CommentPermissionService,
    CommentInteractionService,
  ],
  exports: [CommentService, CommentInteractionService],
})
export class CommentModule {}
