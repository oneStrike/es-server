import { UserGrowthRewardModule } from '@libs/growth/growth-reward'
import { Module } from '@nestjs/common'
import { TaskService } from './task.service'

@Module({
  imports: [ UserGrowthRewardModule],
  providers: [TaskService],
  exports: [TaskService],
})
export class TaskModule {}
