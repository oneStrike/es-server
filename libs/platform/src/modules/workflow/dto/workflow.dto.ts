import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
  EnumArrayProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  ObjectProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { PageDto } from '@libs/platform/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import { WorkflowErrorCodeEnum } from '../workflow-error-facts'
import {
  WorkflowAttemptStatusEnum,
  WorkflowAttemptTriggerTypeEnum,
  WorkflowEventTypeEnum,
  WorkflowJobArchiveScopeEnum,
  WorkflowJobStatusEnum,
  WorkflowNotificationKindEnum,
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

/** 工作流错误事实 DTO。 */
export class WorkflowErrorFactsDto {
  @EnumProperty({
    description: '错误或状态码',
    enum: WorkflowErrorCodeEnum,
    example: WorkflowErrorCodeEnum.ATTEMPT_LEASE_EXPIRED,
    required: true,
    validation: false,
  })
  code!: WorkflowErrorCodeEnum | string

  @StringProperty({
    description: '错误领域',
    example: 'workflow',
    required: true,
    validation: false,
  })
  domain!: string

  @StringProperty({
    description: '错误阶段',
    example: 'lease-recovery',
    required: true,
    validation: false,
  })
  stage!: string

  @StringProperty({
    description: '严重级别',
    example: 'error',
    required: true,
    validation: false,
  })
  severity!: string

  @BooleanProperty({
    description: '是否可重试',
    example: false,
    required: true,
    validation: false,
  })
  retryable!: boolean

  @ObjectProperty({
    description: '可公开给 admin 表达层使用的事实',
    example: { attemptId: '8f12f79c-7d89-4daa-a6ea-c2af4d56e650' },
    required: true,
    validation: false,
  })
  context!: Record<string, unknown>
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

  @DateProperty({
    description: '最早可被 worker 消费的时间',
    example: '2026-05-17T03:10:00.000Z',
    required: false,
    validation: false,
  })
  notBeforeAt!: Date | null

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

  @NestedProperty({
    description: '错误事实；admin 负责根据 code/context 表达',
    example: {
      code: WorkflowErrorCodeEnum.ATTEMPT_LEASE_EXPIRED,
      context: { attemptId: '8f12f79c-7d89-4daa-a6ea-c2af4d56e650' },
      domain: 'workflow',
      retryable: false,
      severity: 'error',
      stage: 'lease-recovery',
    },
    nullable: true,
    required: false,
    type: WorkflowErrorFactsDto,
    validation: false,
  })
  error!: WorkflowErrorFactsDto | null

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
    description: '事件码',
    example: 'WORKFLOW_JOB_CREATED',
    required: true,
    validation: false,
  })
  eventCode!: string

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

/** 工作流处理记录 DTO。 */
export class WorkflowRecordDto extends WorkflowEventDto {
  @StringProperty({
    description: '工作流 attempt ID',
    example: '8f12f79c-7d89-4daa-a6ea-c2af4d56e650',
    required: false,
    validation: false,
  })
  attemptId!: string | null

  @NumberProperty({
    description: 'attempt 序号',
    example: 1,
    required: false,
    validation: false,
  })
  attemptNo!: number | null
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
    description: '当前进度展示代码；后台根据代码和上下文生成文案',
    example: WorkflowErrorCodeEnum.CONTENT_IMPORT_PROGRESS_UPDATED,
    required: false,
    validation: false,
  })
  progressCode!: string | null

  @ObjectProperty({
    description: '当前进度展示上下文',
    example: { completedItemCount: 3, selectedItemCount: 5 },
    required: false,
    validation: false,
    nullable: true,
  })
  progressContext!: Record<string, unknown> | null

  @ObjectProperty({
    description: '结构化进度详情快照；用于展示当前运行中的子进度',
    example: { kind: 'content-import.image', imageIndex: 1, imageTotal: 20 },
    required: false,
    validation: false,
    nullable: true,
  })
  progressDetail!: Record<string, unknown> | null

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

  @DateProperty({
    description: '归档时间；为空表示未归档',
    example: '2026-05-17T03:00:00.000Z',
    required: false,
    validation: false,
  })
  archivedAt!: Date | null

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
}

/** 工作流通知列表项 DTO。 */
export class WorkflowNotificationItemDto extends PickType(WorkflowJobDto, [
  'jobId',
  'workflowType',
  'displayName',
  'status',
  'selectedItemCount',
  'successItemCount',
  'failedItemCount',
  'skippedItemCount',
  'updatedAt',
] as const) {
  @NumberProperty({
    description: '通知事件ID',
    example: 1,
    required: true,
    validation: false,
  })
  id!: number

  @EnumProperty({
    description: '通知事实类型（success=执行完成；retrying=异常后正在系统重试；failed=最终失败）',
    enum: WorkflowNotificationKindEnum,
    example: WorkflowNotificationKindEnum.SUCCESS,
    required: true,
    validation: false,
  })
  kind!: WorkflowNotificationKindEnum

  @DateProperty({
    description: '通知事件创建时间',
    example: '2026-05-17T03:00:00.000Z',
    required: true,
    validation: false,
  })
  createdAt!: Date

  @DateProperty({
    description: '下次系统重试时间；仅重试中通知可能存在',
    example: '2026-05-17T03:10:00.000Z',
    required: false,
    validation: false,
  })
  nextRetryAt!: Date | null
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
) {
  @EnumProperty({
    description: '归档筛选范围（active=未归档；archived=已归档；all=全部）',
    enum: WorkflowJobArchiveScopeEnum,
    example: WorkflowJobArchiveScopeEnum.ACTIVE,
    required: false,
    default: WorkflowJobArchiveScopeEnum.ACTIVE,
  })
  archiveScope?: WorkflowJobArchiveScopeEnum
}

/** 工作流处理记录分页查询 DTO。 */
export class WorkflowRecordPageRequestDto extends IntersectionType(
  PageDto,
  WorkflowJobIdDto,
) {
  @StringProperty({
    description: '工作流 attempt ID',
    example: '8f12f79c-7d89-4daa-a6ea-c2af4d56e650',
    required: false,
  })
  attemptId?: string

  @EnumArrayProperty({
    description: '事件类型过滤；不传时默认返回关键生命周期/诊断记录',
    enum: WorkflowEventTypeEnum,
    example: [
      WorkflowEventTypeEnum.JOB_CREATED,
      WorkflowEventTypeEnum.JOB_CONFIRMED,
      WorkflowEventTypeEnum.ITEM_FAILED,
    ],
    required: false,
  })
  eventTypes?: WorkflowEventTypeEnum[]
}

/** 工作流通知列表查询 DTO。 */
export class WorkflowNotificationListRequestDto {
  @DateProperty({
    description: '游标时间；只返回该时间之后的通知事件',
    example: '2026-05-17T03:00:00.000Z',
    required: false,
  })
  createdAfter?: Date

  @NumberProperty({
    description: '同一游标时间下已读取的最后通知事件ID',
    example: 20,
    min: 0,
    required: false,
  })
  afterId?: number

  @NumberProperty({
    description: '返回条数；默认20，最大50',
    default: 20,
    example: 20,
    max: 50,
    min: 1,
    required: false,
  })
  limit?: number

  @EnumArrayProperty({
    description: '通知事实类型过滤；不传时返回执行完成、异常重试、最终失败',
    enum: WorkflowNotificationKindEnum,
    example: [
      WorkflowNotificationKindEnum.SUCCESS,
      WorkflowNotificationKindEnum.RETRYING,
    ],
    required: false,
  })
  kinds?: WorkflowNotificationKindEnum[]
}

/** 工作流通知列表响应 DTO。 */
export class WorkflowNotificationListResponseDto {
  @ArrayProperty({
    description: '工作流通知事实列表',
    itemClass: WorkflowNotificationItemDto,
    required: true,
    validation: false,
  })
  list!: WorkflowNotificationItemDto[]

  @DateProperty({
    description: '下一次轮询游标时间',
    example: '2026-05-17T03:00:00.000Z',
    required: false,
    validation: false,
  })
  nextCreatedAfter!: Date | null

  @NumberProperty({
    description: '同一游标时间下下一次轮询游标ID',
    example: 20,
    required: false,
    validation: false,
  })
  nextAfterId!: number | null

  @DateProperty({
    description: '服务端当前时间；用于首次进入时静默建立游标',
    example: '2026-05-17T03:00:00.000Z',
    required: true,
    validation: false,
  })
  serverTime!: Date
}

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

/** 工作流归档 DTO。 */
export class WorkflowArchiveDto extends WorkflowJobIdDto {}

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

  @NestedProperty({
    description: '错误事实；admin 负责根据 code/context 表达',
    example: {
      code: WorkflowErrorCodeEnum.UNKNOWN_WORKFLOW_ERROR,
      context: {},
      domain: 'unknown',
      retryable: false,
      severity: 'error',
      stage: 'unknown',
    },
    nullable: true,
    required: false,
    type: WorkflowErrorFactsDto,
    validation: false,
  })
  error?: WorkflowErrorFactsDto | null

  @ObjectProperty({
    description: '内部诊断对象；不作为 admin 展示文案来源',
    example: { source: 'manual-complete' },
    nullable: true,
    required: false,
    validation: false,
  })
  errorDiagnostic?: Record<string, unknown> | null
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
