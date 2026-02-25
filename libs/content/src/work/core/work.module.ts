import { InteractionModule } from '@libs/interaction'
import { UserGrowthEventModule } from '@libs/user/growth-event'
import { Module } from '@nestjs/common'
import { WorkService } from './work.service'

@Module({
  imports: [InteractionModule, UserGrowthEventModule],
  providers: [WorkService],
  exports: [WorkService],
})
export class WorkModule {}
