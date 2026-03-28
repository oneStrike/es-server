import { UserGrowthRewardModule } from '@libs/growth/growth-reward'
import { MessageOutboxModule } from '@libs/message/outbox'
import { Module } from '@nestjs/common'
import { TaskService } from './task.service'

@Module({
  imports: [UserGrowthRewardModule, MessageOutboxModule],
  providers: [TaskService],
  exports: [TaskService],
})
export class TaskModule {}
