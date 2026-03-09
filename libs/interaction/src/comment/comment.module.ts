import { MessageModule } from '@libs/message'
import { SensitiveWordModule } from '@libs/sensitive-word'
import { SystemConfigModule } from '@libs/system-config'
import { GrowthLedgerModule } from '@libs/user/growth-ledger'
import { Module } from '@nestjs/common'
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
    CommentGrowthService,
    CommentService,
    CommentPermissionService,
  ],
  exports: [CommentService],
})
export class CommentModule {}
