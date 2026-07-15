import { DrizzleModule } from '@db/core'
import { Module } from '@nestjs/common'
import { UserPermissionService } from './permission.service'

@Module({
  imports: [DrizzleModule],
  providers: [UserPermissionService],
  exports: [UserPermissionService],
})
export class UserPermissionModule {}
