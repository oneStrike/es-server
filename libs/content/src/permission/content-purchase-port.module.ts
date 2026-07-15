import { DrizzleModule } from '@db/core'
import { PURCHASE_CONTENT_PORT } from '@libs/interaction/purchase/purchase-content.port'
import { Module } from '@nestjs/common'
import { WorkCounterModule } from '../work-counter/work-counter.module'
import { ContentPermissionModule } from './content-permission.module'
import { ContentPurchasePortAdapter } from './content-purchase-port.adapter'

/** 内容域导出的购买端口适配器模块。 */
@Module({
  imports: [DrizzleModule, ContentPermissionModule, WorkCounterModule],
  providers: [
    ContentPurchasePortAdapter,
    {
      provide: PURCHASE_CONTENT_PORT,
      useExisting: ContentPurchasePortAdapter,
    },
  ],
  exports: [PURCHASE_CONTENT_PORT],
})
export class ContentPurchasePortModule {}
