import { Module } from '@nestjs/common'
import { UserPermissionService } from './permission.service'

@Module({
  providers: [UserPermissionService],
  exports: [UserPermissionService],
})
export class UserPermissionModule {}
