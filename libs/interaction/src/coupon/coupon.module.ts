import { ContentPermissionModule } from '@libs/content/permission/content-permission.module'
import { CheckInModule } from '@libs/growth/check-in/check-in.module'
import { Module } from '@nestjs/common'
import { CouponAdminGrantWorkflowHandler } from './coupon-admin-grant-workflow.handler'
import { CouponAdminGrantWorkflowService } from './coupon-admin-grant-workflow.service'
import { CouponService } from './coupon.service'

@Module({
  imports: [ContentPermissionModule, CheckInModule],
  providers: [
    CouponService,
    CouponAdminGrantWorkflowHandler,
    CouponAdminGrantWorkflowService,
  ],
  exports: [CouponService, CouponAdminGrantWorkflowService],
})
export class CouponModule {}
