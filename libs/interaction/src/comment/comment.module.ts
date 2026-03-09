import { MessageModule } from '@libs/message'
import { SensitiveWordModule } from '@libs/sensitive-word'
import { SystemConfigModule } from '@libs/system-config'
import { GrowthLedgerModule } from '@libs/user/growth-ledger'
import { Module } from '@nestjs/common'
import { InteractionTargetAccessService } from '../interaction-target-access.service'
import { CommentGrowthService } from './comment-growth.service'
import { CommentPermissionService } from './comment-permission.service'
import { CommentService } from './comment.service'

@Module({
  imports: [
    SensitiveWordModule,
    SystemConfigModule,
    GrowthLedgerModule,
    MessageModule,
  ],
  providers: [
    InteractionTargetAccessService,
    CommentGrowthService,
    CommentService,
    CommentPermissionService,
  ],
  exports: [CommentService],
})
export class CommentModule {}
