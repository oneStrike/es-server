import { MessageOutboxModule } from '@libs/message/outbox'
import { Module } from '@nestjs/common'
import { UserGrowthRewardModule } from '../growth-reward/growth-reward.module'
import { TaskService } from './task.service'

@Module({
  imports: [UserGrowthRewardModule, MessageOutboxModule],
  providers: [TaskService],
  exports: [TaskService],
})
export class TaskModule {}
