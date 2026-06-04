import { MessageDomainEventModule } from '@libs/message/eventing/message-domain-event.module'
import { Module } from '@nestjs/common'
import { EventDefinitionModule } from '../event-definition/event-definition.module'
import { UserGrowthRewardModule } from '../growth-reward/growth-reward.module'
import { TaskDefinitionService } from './task-definition.service'
import { TaskEventTemplateRegistry } from './task-event-template.registry'
import { TaskExecutionService } from './task-execution.service'
import { TaskNotificationService } from './task-notification.service'
import { TaskRewardRetryService } from './task-reward-retry.service'
import { TaskRuntimeService } from './task-runtime.service'
import { TaskService } from './task.service'

@Module({
  imports: [
    UserGrowthRewardModule,
    MessageDomainEventModule,
    EventDefinitionModule,
  ],
  providers: [
    TaskDefinitionService,
    TaskEventTemplateRegistry,
    TaskExecutionService,
    TaskNotificationService,
    TaskRewardRetryService,
    TaskRuntimeService,
    TaskService,
  ],
  exports: [
    TaskEventTemplateRegistry,
    TaskRewardRetryService,
    TaskRuntimeService,
    TaskService,
  ],
})
export class TaskModule {}
