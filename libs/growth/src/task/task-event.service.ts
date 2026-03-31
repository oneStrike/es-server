import type {
  TaskEventProgressInput,
  TaskEventProgressResult,
} from './task.type'
import { DrizzleService } from '@db/core'
import {
  canConsumeEventEnvelopeByConsumer,
  EventDefinitionConsumerEnum,
} from '@libs/growth/event-definition'
import { MessageOutboxService } from '@libs/message/outbox'
import { Injectable } from '@nestjs/common'
import { UserGrowthRewardService } from '../growth-reward/growth-reward.service'
import { TaskServiceSupport } from './task.service.support'

/**
 * 任务事件推进服务。
 *
 * 负责消费外部业务事件，把符合条件的 `EVENT_COUNT` 任务推进到对应周期 assignment。
 */
@Injectable()
export class TaskEventService extends TaskServiceSupport {
  constructor(
    drizzle: DrizzleService,
    userGrowthRewardService: UserGrowthRewardService,
    messageOutboxService: MessageOutboxService,
  ) {
    super(drizzle, userGrowthRewardService, messageOutboxService)
  }

  /**
   * 消费业务事件并推进事件型任务。
   *
   * 该链路按 event envelope 的 `occurredAt` 落周期，并通过 assignment + bizKey 保证幂等。
   */
  async consumeEventProgress(
    input: TaskEventProgressInput,
  ) {
    const result: TaskEventProgressResult = {
      matchedTaskIds: [],
      progressedAssignmentIds: [],
      completedAssignmentIds: [],
      duplicateAssignmentIds: [],
    }

    if (
      !canConsumeEventEnvelopeByConsumer(
        input.eventEnvelope,
        EventDefinitionConsumerEnum.TASK,
      )
    ) {
      return result
    }

    const occurredAt = input.eventEnvelope.occurredAt ?? new Date()
    const candidateTasks = await this.findEventProgressTasks(
      input.eventEnvelope.code,
      occurredAt,
    )

    for (const taskRecord of candidateTasks) {
      if (
        !this.matchesTaskObjectiveConfig(
          taskRecord.objectiveConfig,
          input.eventEnvelope.context,
        )
      ) {
        continue
      }

      result.matchedTaskIds.push(taskRecord.id)
      const assignmentResult = await this.advanceAssignmentByEvent({
        taskRecord,
        userId: input.eventEnvelope.subjectId,
        eventEnvelope: input.eventEnvelope,
        eventBizKey: input.bizKey,
        occurredAt,
      })

      if (!assignmentResult.assignmentId) {
        continue
      }
      if (assignmentResult.duplicate) {
        result.duplicateAssignmentIds.push(assignmentResult.assignmentId)
        continue
      }
      if (assignmentResult.completed) {
        result.completedAssignmentIds.push(assignmentResult.assignmentId)
        continue
      }
      if (assignmentResult.progressed) {
        result.progressedAssignmentIds.push(assignmentResult.assignmentId)
      }
    }

    return result
  }
}
