import {
  ArrayProperty,
  DateProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  ObjectProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { PageDto } from '@libs/platform/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import {
  WorkflowAttemptStatusEnum,
  WorkflowAttemptTriggerTypeEnum,
  WorkflowEventTypeEnum,
  WorkflowJobStatusEnum,
  WorkflowOperatorTypeEnum,
} from '../workflow.constant'

/** 工作流任务 ID 字段。 */
class WorkflowJobIdentityFieldsDto {
  @StringProperty({
    description: '工作流任务ID',
    example: '8f12f79c-7d89-4daa-a6ea-c2af4d56e650',
    required: true,
  })
  jobId!: string
}

/** 工作流类型字段。 */
class WorkflowTypeFieldsDto {
  @StringProperty({
    description: '工作流类型',
    example: 'content-import.third-party-import',
    required: true,
  })
  workflowType!: string
}

/** 工作流任务状态字段。 */
class WorkflowJobStatusFieldsDto {
  @EnumProperty({
    description:
      '任务状态（1=草稿；2=待处理；3=处理中；4=成功；5=部分失败；6=失败；7=已取消；8=已过期）',
    enum: WorkflowJobStatusEnum,
    example: WorkflowJobStatusEnum.PENDING,
    required: true,
  })
  status!: WorkflowJobStatusEnum
}

/** 工作流 attempt DTO。 */
export class WorkflowAttemptDto {
  @NumberProperty({
    description: '主键ID',
    example: 1,
    required: true,
    validation: false,
  })
  id!: number

  @StringProperty({
    description: '工作流 attempt ID',
    example: '8f12f79c-7d89-4daa-a6ea-c2af4d56e650',
    required: true,
    validation: false,
  })
  attemptId!: string

  @NumberProperty({
    description: 'attempt 序号',
    example: 1,
    required: true,
    validation: false,
  })
  attemptNo!: number

  @EnumProperty({
    description: '触发类型（1=首次确认；2=人工重试；3=系统恢复）',
    enum: WorkflowAttemptTriggerTypeEnum,
    example: WorkflowAttemptTriggerTypeEnum.INITIAL_CONFIRM,
    required: true,
    validation: false,
  })
  triggerType!: WorkflowAttemptTriggerTypeEnum

  @EnumProperty({
    description:
      'attempt状态（1=待处理；2=处理中；3=成功；4=部分失败；5=失败；6=已取消）',
    enum: WorkflowAttemptStatusEnum,
    example: WorkflowAttemptStatusEnum.PENDING,
    required: true,
    validation: false,
  })
  status!: WorkflowAttemptStatusEnum

  @NumberProperty({
    description: '选中条目数',
    example: 3,
    required: true,
    validation: false,
  })
  selectedItemCount!: number

  @NumberProperty({
    description: '成功条目数',
    example: 2,
    required: true,
    validation: false,
  })
  successItemCount!: number

  @NumberProperty({
    description: '失败条目数',
    example: 1,
    required: true,
    validation: false,
  })
  failedItemCount!: number

  @NumberProperty({
    description: '跳过条目数',
    example: 0,
    required: true,
    validation: false,
  })
  skippedItemCount!: number

  @StringProperty({
    description: '当前处理 worker',
    example: 'admin-api-worker-1',
    required: false,
    validation: false,
  })
  claimedBy!: string | null

  @DateProperty({
    description: 'claim 过期时间',
    example: '2026-05-17T03:00:00.000Z',
    required: false,
    validation: false,
  })
  claimExpiresAt!: Date | null

  @DateProperty({
    description: '最近心跳时间',
    example: '2026-05-17T03:00:00.000Z',
    required: false,
    validation: false,
  })
  heartbeatAt!: Date | null

  @StringProperty({
    description: '错误码',
    example: 'ATTEMPT_LEASE_EXPIRED',
    required: false,
    validation: false,
  })
  errorCode!: string | null

  @StringProperty({
    description: '错误信息',
    example: 'attempt 租约过期',
    required: false,
    validation: false,
  })
  errorMessage!: string | null

  @DateProperty({
    description: '开始处理时间',
    example: '2026-05-17T03:00:00.000Z',
    required: false,
    validation: false,
  })
  startedAt!: Date | null

  @DateProperty({
    description: '完成时间',
    example: '2026-05-17T03:00:00.000Z',
    required: false,
    validation: false,
  })
  finishedAt!: Date | null

  @DateProperty({
    description: '创建时间',
    example: '2026-05-17T03:00:00.000Z',
    required: true,
    validation: false,
  })
  createdAt!: Date

  @DateProperty({
    description: '更新时间',
    example: '2026-05-17T03:00:00.000Z',
    required: true,
    validation: false,
  })
  updatedAt!: Date
}

/** 工作流事件 DTO。 */
export class WorkflowEventDto {
  @NumberProperty({
    description: '主键ID',
    example: 1,
    required: true,
    validation: false,
  })
  id!: number

  @EnumProperty({
    description:
      '事件类型（1=创建草稿；2=确认任务；3=claim attempt；4=心跳；5=进度更新；6=条目成功；7=条目失败；8=attempt完成；9=请求取消；10=人工重试；11=草稿过期；12=资源清理）',
    enum: WorkflowEventTypeEnum,
    example: WorkflowEventTypeEnum.JOB_CREATED,
    required: true,
    validation: false,
  })
  eventType!: WorkflowEventTypeEnum

  @StringProperty({
    description: '事件文案',
    example: '任务已创建',
    required: true,
    validation: false,
  })
  message!: string

  @ObjectProperty({
    description: '事件诊断详情',
    example: { itemId: 'chapter-1' },
    required: false,
    validation: false,
    nullable: true,
  })
  detail!: Record<string, unknown> | null

  @DateProperty({
    description: '创建时间',
    example: '2026-05-17T03:00:00.000Z',
    required: true,
    validation: false,
  })
  createdAt!: Date
}

/** 工作流任务 DTO。 */
export class WorkflowJobDto {
  @NumberProperty({
    description: '主键ID',
    example: 1,
    required: true,
    validation: false,
  })
  id!: number

  @StringProperty({
    description: '工作流任务ID',
    example: '8f12f79c-7d89-4daa-a6ea-c2af4d56e650',
    required: true,
    validation: false,
  })
  jobId!: string

  @StringProperty({
    description: '工作流类型',
    example: 'content-import.third-party-import',
    required: true,
    validation: false,
  })
  workflowType!: string

  @StringProperty({
    description: '展示名称',
    example: '我独自升级',
    required: true,
    validation: false,
  })
  displayName!: string

  @EnumProperty({
    description: '操作者类型（1=后台管理员；2=系统）',
    enum: WorkflowOperatorTypeEnum,
    example: WorkflowOperatorTypeEnum.ADMIN,
    required: true,
    validation: false,
  })
  operatorType!: WorkflowOperatorTypeEnum

  @NumberProperty({
    description: '后台管理员操作者ID；系统任务为空',
    example: 1,
    required: false,
    validation: false,
  })
  operatorUserId!: number | null

  @EnumProperty({
    description:
      '任务状态（1=草稿；2=待处理；3=处理中；4=成功；5=部分失败；6=失败；7=已取消；8=已过期）',
    enum: WorkflowJobStatusEnum,
    example: WorkflowJobStatusEnum.PENDING,
    required: true,
    validation: false,
  })
  status!: WorkflowJobStatusEnum

  @NumberProperty({
    description: '进度百分比',
    example: 40,
    required: true,
    validation: false,
  })
  progressPercent!: number

  @StringProperty({
    description: '进度文案',
    example: '导入中',
    required: false,
    validation: false,
  })
  progressMessage!: string | null

  @NumberProperty({
    description: '选中条目数',
    example: 3,
    required: true,
    validation: false,
  })
  selectedItemCount!: number

  @NumberProperty({
    description: '成功条目数',
    example: 2,
    required: true,
    validation: false,
  })
  successItemCount!: number

  @NumberProperty({
    description: '失败条目数',
    example: 1,
    required: true,
    validation: false,
  })
  failedItemCount!: number

  @NumberProperty({
    description: '跳过条目数',
    example: 0,
    required: true,
    validation: false,
  })
  skippedItemCount!: number

  @DateProperty({
    description: '取消请求时间',
    example: '2026-05-17T03:00:00.000Z',
    required: false,
    validation: false,
  })
  cancelRequestedAt!: Date | null

  @DateProperty({
    description: '开始处理时间',
    example: '2026-05-17T03:00:00.000Z',
    required: false,
    validation: false,
  })
  startedAt!: Date | null

  @DateProperty({
    description: '完成时间',
    example: '2026-05-17T03:00:00.000Z',
    required: false,
    validation: false,
  })
  finishedAt!: Date | null

  @DateProperty({
    description: '草稿过期时间',
    example: '2026-05-17T03:00:00.000Z',
    required: false,
    validation: false,
  })
  expiresAt!: Date | null

  @ObjectProperty({
    description: '运行时非查询诊断摘要',
    example: { reason: 'partial failed' },
    required: false,
    validation: false,
    nullable: true,
  })
  summary!: Record<string, unknown> | null

  @DateProperty({
    description: '创建时间',
    example: '2026-05-17T03:00:00.000Z',
    required: true,
    validation: false,
  })
  createdAt!: Date

  @DateProperty({
    description: '更新时间',
    example: '2026-05-17T03:00:00.000Z',
    required: true,
    validation: false,
  })
  updatedAt!: Date
}

/** 工作流详情 DTO。 */
export class WorkflowJobDetailDto extends WorkflowJobDto {
  @ArrayProperty({
    description: 'attempt 列表',
    itemClass: WorkflowAttemptDto,
    required: true,
    validation: false,
  })
  attempts!: WorkflowAttemptDto[]

  @ArrayProperty({
    description: '事件列表',
    itemClass: WorkflowEventDto,
    required: true,
    validation: false,
  })
  events!: WorkflowEventDto[]
}

/** 工作流任务 ID DTO。 */
export class WorkflowJobIdDto extends PickType(WorkflowJobIdentityFieldsDto, [
  'jobId',
] as const) {}

/** 工作流分页查询 DTO。 */
export class WorkflowJobPageRequestDto extends IntersectionType(
  PageDto,
  PartialType(
    IntersectionType(
      WorkflowJobIdentityFieldsDto,
      IntersectionType(WorkflowTypeFieldsDto, WorkflowJobStatusFieldsDto),
    ),
  ),
) {}

/** 工作流重试条目 DTO。 */
export class WorkflowRetryItemsDto extends WorkflowJobIdDto {
  @ArrayProperty({
    description: '重试条目ID列表',
    example: ['chapter-1', 'chapter-2'],
    itemType: 'string',
    minLength: 1,
    required: true,
  })
  itemIds!: string[]
}

/** 工作流清理 retained resource DTO。 */
export class WorkflowExpireDto extends WorkflowJobIdDto {}

/** 工作流 attempt 状态更新 DTO。 */
export class WorkflowAttemptCompleteDto {
  @StringProperty({
    description: '工作流 attempt ID',
    example: '8f12f79c-7d89-4daa-a6ea-c2af4d56e650',
    required: true,
  })
  attemptId!: string

  @EnumProperty({
    description: 'attempt终态（3=成功；4=部分失败；5=失败；6=已取消）',
    enum: WorkflowAttemptStatusEnum,
    example: WorkflowAttemptStatusEnum.SUCCESS,
    required: true,
  })
  status!: WorkflowAttemptStatusEnum

  @NumberProperty({
    description: '成功条目数',
    example: 2,
    required: true,
  })
  successItemCount!: number

  @NumberProperty({
    description: '失败条目数',
    example: 1,
    required: true,
  })
  failedItemCount!: number

  @NumberProperty({
    description: '跳过条目数',
    example: 0,
    required: true,
  })
  skippedItemCount!: number

  @StringProperty({
    description: '错误码',
    example: 'UPSTREAM_FAILED',
    required: false,
  })
  errorCode?: string

  @StringProperty({
    description: '错误信息',
    example: '上游章节接口失败',
    required: false,
  })
  errorMessage?: string
}

/** 工作流详情响应内容扩展 DTO。 */
export class WorkflowJobDetailPayloadDto {
  @NestedProperty({
    description: '任务摘要',
    type: WorkflowJobDetailDto,
    required: true,
    validation: false,
  })
  job!: WorkflowJobDetailDto
}
