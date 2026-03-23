/**
 * 购买模块。
 *
 * 说明：
 * - 提供章节购买功能
 * - 集成内容权限校验、积分扣减、成长奖励等能力
 */
import { ContentPermissionModule } from '@libs/content/permission'
import { GrowthLedgerModule } from '@libs/growth/growth-ledger'
import { Module } from '@nestjs/common'
import { PurchaseService } from './purchase.service'

@Module({
  imports: [ContentPermissionModule, GrowthLedgerModule],
  providers: [PurchaseService],
  exports: [PurchaseService],
})
export class PurchaseModule {}
