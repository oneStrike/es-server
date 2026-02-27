import { Module } from '@nestjs/common'
import { ContentPermissionService } from './content-permission.service'

@Module({
  providers: [ContentPermissionService],
  exports: [ContentPermissionService],
})
export class ContentPermissionModule {}
