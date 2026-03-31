import { MessageOutboxModule } from '@libs/message/outbox'
import { Module } from '@nestjs/common'
import { UserGrowthRewardModule } from '../growth-reward/growth-reward.module'
import { TaskAssignmentService } from './task-assignment.service'
import { TaskConfigService } from './task-config.service'
import { TaskEventService } from './task-event.service'
import { TaskReadService } from './task-read.service'
import { TaskRewardService } from './task-reward.service'
import { TaskRuntimeService } from './task-runtime.service'

@Module({
  imports: [UserGrowthRewardModule, MessageOutboxModule],
  providers: [
    TaskAssignmentService,
    TaskConfigService,
    TaskEventService,
    TaskReadService,
    TaskRewardService,
    TaskRuntimeService,
  ],
  exports: [
    TaskAssignmentService,
    TaskConfigService,
    TaskEventService,
    TaskReadService,
    TaskRewardService,
    TaskRuntimeService,
  ],
})
export class TaskModule {}
