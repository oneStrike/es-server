import { DrizzleModule } from '@db/core'
import { EventingModule } from '@libs/eventing/eventing/eventing.module'
import { Module } from '@nestjs/common'
import { EventDefinitionModule } from '../event-definition/event-definition.module'
import { UserGrowthRewardModule } from '../growth-reward/growth-reward.module'
import { TaskDefinitionService } from './task-definition.service'
import { TaskEventFailureService } from './task-event-failure.service'
import { TaskEventTemplateRegistry } from './task-event-template.registry'
import { TaskExecutionService } from './task-execution.service'
import { TaskNotificationService } from './task-notification.service'
import { TaskRewardRetryService } from './task-reward-retry.service'
import { TaskRuntimeService } from './task-runtime.service'
import { TaskService } from './task.service'

@Module({
  imports: [
    DrizzleModule,
    UserGrowthRewardModule,
    EventingModule,
    EventDefinitionModule,
  ],
  providers: [
    TaskDefinitionService,
    TaskEventFailureService,
    TaskEventTemplateRegistry,
    TaskExecutionService,
    TaskNotificationService,
    TaskRewardRetryService,
    TaskRuntimeService,
    TaskService,
  ],
  exports: [
    TaskEventTemplateRegistry,
    TaskEventFailureService,
    TaskRewardRetryService,
    TaskRuntimeService,
    TaskService,
  ],
})
export class TaskModule {}
