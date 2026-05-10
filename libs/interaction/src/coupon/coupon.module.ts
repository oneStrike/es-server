import { ContentPermissionModule } from '@libs/content/permission/content-permission.module'
import { Module } from '@nestjs/common'
import { CouponService } from './coupon.service'

@Module({
  imports: [ContentPermissionModule],
  providers: [CouponService],
  exports: [CouponService],
})
export class CouponModule {}
