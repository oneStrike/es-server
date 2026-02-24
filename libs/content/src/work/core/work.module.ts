import { UserGrowthEventModule } from '@libs/user/growth-event'
import { Module } from '@nestjs/common'
import { WorkService } from './work.service'

@Module({
  imports: [UserGrowthEventModule],
  providers: [WorkService],
  exports: [WorkService],
})
export class WorkModule {}
