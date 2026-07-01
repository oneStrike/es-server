import {
  ArrayProperty,
  DateProperty,
  EnumProperty,
  NumberProperty,
  ObjectProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto, PageDto } from '@libs/platform/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import {
  TASK_EVENT_FAILURE_MAX_RETRY_COUNT,
  TaskEventFailureStatusEnum,
} from '../task.constant'

/** 任务事件消费失败事实基础 DTO。 */
export class BaseTaskEventFailureDto extends BaseDto {
  @StringProperty({
    description: '任务事件消费失败幂等键',
    example: 'task:event:COMIC_WORK_VIEW:view:comic:1:user:10001',
    maxLength: 255,
    validation: false,
  })
  idempotencyKey!: string

  @StringProperty({
    description: '成长事件 key',
    example: 'COMIC_WORK_VIEW',
    maxLength: 80,
  })
  eventKey!: string

  @StringProperty({
    description: '事件业务幂等键',
    example: 'view:comic:1:user:10001',
    maxLength: 180,
  })
  eventBizKey!: string

  @NumberProperty({
    description: '成长事件编码',
    example: 100,
  })
  eventCode!: number

  @StringProperty({
    description: '事件模板键',
    example: 'COMIC_WORK_VIEW',
    nullable: true,
    maxLength: 80,
    validation: false,
  })
  templateKey!: string | null

  @NumberProperty({
    description: '归属用户 ID',
    example: 10001,
  })
  userId!: number

  @StringProperty({
    description: '事件目标类型',
    example: 'comic_work',
    nullable: true,
    maxLength: 80,
    validation: false,
  })
  targetType!: string | null

  @NumberProperty({
    description: '事件目标 ID',
    example: 88,
    nullable: true,
    validation: false,
  })
  targetId!: number | null

  @EnumProperty({
    description: '失败事实状态（1=待重试；2=重试中；3=已解决；4=终态失败）',
    example: TaskEventFailureStatusEnum.PENDING,
    enum: TaskEventFailureStatusEnum,
  })
  status!: TaskEventFailureStatusEnum

  @NumberProperty({
    description: `已执行重试次数，默认最多 ${TASK_EVENT_FAILURE_MAX_RETRY_COUNT} 次`,
    example: 0,
    validation: false,
  })
  retryCount!: number

  @DateProperty({
    description: '最近一次重试时间',
    example: '2026-06-08T08:00:00.000Z',
    nullable: true,
    validation: false,
  })
  lastRetryAt!: Date | null

  @StringProperty({
    description: '最近一次失败原因',
    example: '任务事件消费失败',
    nullable: true,
    maxLength: 1000,
    validation: false,
  })
  lastErrorMessage!: string | null

  @DateProperty({
    description: '解决时间',
    example: '2026-06-08T08:05:00.000Z',
    nullable: true,
    validation: false,
  })
  resolvedAt!: Date | null

  @DateProperty({
    description: '终态失败时间',
    example: '2026-06-08T08:05:00.000Z',
    nullable: true,
    validation: false,
  })
  terminalErrorAt!: Date | null

  @StringProperty({
    description: '终态失败原因',
    example: '超过最大重试次数',
    nullable: true,
    maxLength: 500,
    validation: false,
  })
  terminalReason!: string | null

  @DateProperty({
    description: '事件发生时间',
    example: '2026-06-08T08:00:00.000Z',
    validation: false,
  })
  occurredAt!: Date

  @ObjectProperty({
    description: '重试所需事件快照 JSON',
    example: { bizKey: 'view:comic:1:user:10001' },
    validation: false,
  })
  requestPayload!: Record<string, unknown>
}

class TaskEventFailurePageFilterFieldsDto extends PickType(
  BaseTaskEventFailureDto,
  ['eventKey', 'eventBizKey', 'eventCode', 'userId', 'status'] as const,
) {}

/** 任务事件消费失败事实分页查询 DTO。 */
export class QueryTaskEventFailurePageDto extends IntersectionType(
  PageDto,
  PartialType(TaskEventFailurePageFilterFieldsDto),
) {}

/** 任务事件消费失败单条重试结果 DTO。 */
export class TaskEventFailureRetryResultDto {
  @NumberProperty({
    description: '失败事实 ID',
    example: 88,
    validation: false,
  })
  failureId!: number

  @EnumProperty({
    description: '重试后的失败事实状态（1=待重试；2=重试中；3=已解决；4=终态失败）',
    example: TaskEventFailureStatusEnum.RESOLVED,
    enum: TaskEventFailureStatusEnum,
    validation: false,
  })
  status!: TaskEventFailureStatusEnum

  @NumberProperty({
    description: '重试后的累计重试次数',
    example: 1,
    validation: false,
  })
  retryCount!: number

  @StringProperty({
    description: '处理结果说明',
    example: '任务事件消费重试成功',
    validation: false,
  })
  message!: string
}

/** 任务事件消费失败批量重试入参 DTO。 */
export class RetryTaskEventFailureBatchDto {
  @NumberProperty({
    description: '本次最多扫描的待重试失败事实数，最大 500',
    example: 100,
    required: false,
    min: 1,
    max: 500,
  })
  limit?: number
}

/** 任务事件消费失败批量重试失败摘要 DTO。 */
export class TaskEventFailureRetryFailureDto {
  @NumberProperty({
    description: '失败事实 ID',
    example: 88,
    validation: false,
  })
  failureId!: number

  @StringProperty({
    description: '失败原因摘要',
    example: '任务事件消费失败',
    validation: false,
  })
  message!: string
}

/** 任务事件消费失败批量重试结果 DTO。 */
export class TaskEventFailureRetryBatchResultDto {
  @NumberProperty({
    description: '本次扫描到的失败事实数',
    example: 12,
    validation: false,
  })
  scannedCount!: number

  @NumberProperty({
    description: '本次重试成功数',
    example: 10,
    validation: false,
  })
  succeededCount!: number

  @NumberProperty({
    description: '本次重试后仍失败的事实数',
    example: 1,
    validation: false,
  })
  failedCount!: number

  @NumberProperty({
    description: '本次扫描后跳过的事实数',
    example: 1,
    validation: false,
  })
  skippedCount!: number

  @ArrayProperty({
    description: '失败摘要列表，最多返回前 20 条',
    itemClass: TaskEventFailureRetryFailureDto,
    validation: false,
  })
  failures!: TaskEventFailureRetryFailureDto[]
}
