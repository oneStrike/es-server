import { Module } from '@nestjs/common'
import { ContentEntitlementService } from './content-entitlement.service'
import { ContentPermissionService } from './content-permission.service'
import { MembershipEntitlementService } from './membership-entitlement.service'

@Module({
  providers: [
    ContentPermissionService,
    ContentEntitlementService,
    MembershipEntitlementService,
  ],
  exports: [
    ContentPermissionService,
    ContentEntitlementService,
    MembershipEntitlementService,
  ],
})
export class ContentPermissionModule {}
