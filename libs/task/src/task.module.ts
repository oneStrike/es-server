import { UserGrowthEventModule } from '@libs/user/growth-event'
import { Module } from '@nestjs/common'
import { TaskService } from './task.service'

@Module({
  imports: [UserGrowthEventModule],
  providers: [TaskService],
  exports: [TaskService],
})
export class TaskModule {}
