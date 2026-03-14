/**
 * 购买模块。
 *
 * 说明：
 * - 提供章节购买功能
 * - 集成内容权限校验、积分扣减、成长奖励等能力
 */
// eslint-disable-next-line no-restricted-imports -- avoid circular deps via content barrel
import { ContentPermissionModule } from '@libs/content/permission'
import { GrowthLedgerModule } from '@libs/growth'
import { Module } from '@nestjs/common'
import { PurchaseService } from './purchase.service'

@Module({
  imports: [ContentPermissionModule, GrowthLedgerModule],
  providers: [PurchaseService],
  exports: [PurchaseService],
})
export class PurchaseModule {}
