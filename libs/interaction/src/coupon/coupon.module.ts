import type { CouponModuleRegisterOptions } from './coupon.module.type'
import { DrizzleModule } from '@db/core'
import { CheckInModule } from '@libs/growth/check-in/check-in.module'
import { WorkflowModule } from '@libs/workflow/workflow/workflow.module'
import { DynamicModule, Module } from '@nestjs/common'
import { CouponAdminGrantWorkflowHandler } from './coupon-admin-grant-workflow.handler'
import { CouponAdminGrantWorkflowService } from './coupon-admin-grant-workflow.service'
import { CouponService } from './coupon.service'

/** 券模块必须由应用组合根显式绑定内容权益端口。 */
@Module({})
export class CouponModule {
  // 装配券事务 owner 与内容域端口，避免父模块 provider 的隐式可见性。
  static register(options: CouponModuleRegisterOptions): DynamicModule {
    return {
      module: CouponModule,
      imports: [
        DrizzleModule,
        options.contentPortModule,
        CheckInModule,
        WorkflowModule,
      ],
      providers: [
        CouponService,
        CouponAdminGrantWorkflowHandler,
        CouponAdminGrantWorkflowService,
      ],
      exports: [CouponService, CouponAdminGrantWorkflowService],
    }
  }
}
