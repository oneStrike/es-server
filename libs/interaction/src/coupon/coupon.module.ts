import { ContentPermissionModule } from '@libs/content/permission/content-permission.module'
import { CheckInModule } from '@libs/growth/check-in/check-in.module'
import { Module } from '@nestjs/common'
import { CouponService } from './coupon.service'

@Module({
  imports: [ContentPermissionModule, CheckInModule],
  providers: [CouponService],
  exports: [CouponService],
})
export class CouponModule {}
