import { MessageOutboxModule } from '@libs/message/outbox'
import { Module } from '@nestjs/common'
import { UserGrowthRewardModule } from '../growth-reward/growth-reward.module'
import { TaskDefinitionService } from './task-definition.service'
import { TaskExecutionService } from './task-execution.service'
import { TaskRuntimeService } from './task-runtime.service'
import { TaskService } from './task.service'

@Module({
  imports: [UserGrowthRewardModule, MessageOutboxModule],
  providers: [
    TaskDefinitionService,
    TaskExecutionService,
    TaskRuntimeService,
    TaskService,
  ],
  exports: [
    TaskService,
    TaskRuntimeService,
  ],
})
export class TaskModule {}
