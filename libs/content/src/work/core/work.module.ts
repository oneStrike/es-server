import { InteractionModule } from '@libs/interaction'
import { UserGrowthEventModule } from '@libs/user/growth-event'
import { UserPermissionModule } from '@libs/user/permission'
import { Module } from '@nestjs/common'
import { WorkService } from './work.service'

@Module({
  imports: [InteractionModule, UserGrowthEventModule, UserPermissionModule],
  providers: [WorkService],
  exports: [WorkService],
})
export class WorkModule {}
