import { COUPON_CONTENT_PORT } from '@libs/interaction/coupon/coupon-content.port'
import { Module } from '@nestjs/common'
import { ContentCouponPortAdapter } from './content-coupon-port.adapter'
import { ContentPermissionModule } from './content-permission.module'

/** 内容域导出的阅读券端口适配器模块。 */
@Module({
  imports: [ContentPermissionModule],
  providers: [
    ContentCouponPortAdapter,
    {
      provide: COUPON_CONTENT_PORT,
      useExisting: ContentCouponPortAdapter,
    },
  ],
  exports: [COUPON_CONTENT_PORT],
})
export class ContentCouponPortModule {}
