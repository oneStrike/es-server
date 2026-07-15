import { DrizzleModule } from '@db/core'
import { Module } from '@nestjs/common'
import { ContentEntitlementService } from './content-entitlement.service'
import { ContentPermissionService } from './content-permission.service'
import { MembershipEntitlementService } from './membership-entitlement.service'

@Module({
  imports: [DrizzleModule],
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
