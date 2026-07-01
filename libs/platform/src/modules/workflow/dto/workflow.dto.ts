import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
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
  WorkflowItemStatusEnum,
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

/** 工作流通用条目状态字段。 */
class WorkflowItemStatusFieldsDto {
  @EnumProperty({
    description: '条目状态（1=待处理；2=处理中；3=成功；4=失败；5=重试中；6=已跳过）',
    enum: WorkflowItemStatusEnum,
    example: WorkflowItemStatusEnum.FAILED,
    required: true,
  })
  status!: WorkflowItemStatusEnum
}

/** 工作流错误事实 DTO。 */
export class WorkflowErrorFactsDto {
  @EnumProperty({
    description:
      '错误或状态码，返回归档导入、内容导入、三方导入、数据库写入或工作流运行错误等稳定代码',
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

/** 工作流执行轮次 DTO。 */
export class WorkflowAttemptDto {
  @NumberProperty({
    description: '主键ID',
    example: 1,
    required: true,
    validation: false,
  })
  id!: number

  @StringProperty({
    description: '工作流执行轮次ID',
    example: '8f12f79c-7d89-4daa-a6ea-c2af4d56e650',
    required: true,
    validation: false,
  })
  attemptId!: string

  @NumberProperty({
    description: '执行轮次序号',
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
      '执行轮次状态（1=待处理；2=处理中；3=成功；4=部分失败；5=失败；6=已取消）',
    enum: WorkflowAttemptStatusEnum,
    example: WorkflowAttemptStatusEnum.PENDING,
    required: true,
    validation: false,
  })
  status!: WorkflowAttemptStatusEnum

  @DateProperty({
    description: '最早可被处理节点领取的时间',
    example: '2026-05-17T03:10:00.000Z',
    nullable: true,
    required: true,
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
    description: '当前处理节点',
    example: 'admin-api-node-1',
    nullable: true,
    required: true,
    validation: false,
  })
  claimedBy!: string | null

  @DateProperty({
    description: 'claim 过期时间',
    example: '2026-05-17T03:00:00.000Z',
    nullable: true,
    required: true,
    validation: false,
  })
  claimExpiresAt!: Date | null

  @DateProperty({
    description: '最近心跳时间',
    example: '2026-05-17T03:00:00.000Z',
    nullable: true,
    required: true,
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
    required: true,
    type: WorkflowErrorFactsDto,
    validation: false,
  })
  error!: WorkflowErrorFactsDto | null

  @DateProperty({
    description: '开始处理时间',
    example: '2026-05-17T03:00:00.000Z',
    nullable: true,
    required: true,
    validation: false,
  })
  startedAt!: Date | null

  @DateProperty({
    description: '完成时间',
    example: '2026-05-17T03:00:00.000Z',
    nullable: true,
    required: true,
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
      '事件类型（1=创建草稿；2=确认任务；3=认领执行轮次；4=心跳；5=进度更新；6=条目成功；7=条目失败；8=执行轮次完成；9=请求取消；10=人工重试；11=草稿过期；12=资源清理）',
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
    required: true,
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
    description: '工作流执行轮次ID',
    example: '8f12f79c-7d89-4daa-a6ea-c2af4d56e650',
    nullable: true,
    validation: false,
  })
  attemptId!: string | null

  @NumberProperty({
    description: '执行轮次序号',
    example: 1,
    nullable: true,
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
    nullable: true,
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
    nullable: true,
    required: true,
    validation: false,
  })
  progressCode!: string | null

  @ObjectProperty({
    description: '当前进度展示上下文',
    example: { completedItemCount: 3, selectedItemCount: 5 },
    required: true,
    validation: false,
    nullable: true,
  })
  progressContext!: Record<string, unknown> | null

  @ObjectProperty({
    description: '结构化进度详情快照；用于展示当前运行中的子进度',
    example: { kind: 'content-import.image', imageIndex: 1, imageTotal: 20 },
    required: true,
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
    nullable: true,
    required: true,
    validation: false,
  })
  cancelRequestedAt!: Date | null

  @DateProperty({
    description: '开始处理时间',
    example: '2026-05-17T03:00:00.000Z',
    nullable: true,
    required: true,
    validation: false,
  })
  startedAt!: Date | null

  @DateProperty({
    description: '完成时间',
    example: '2026-05-17T03:00:00.000Z',
    nullable: true,
    required: true,
    validation: false,
  })
  finishedAt!: Date | null

  @DateProperty({
    description: '草稿过期时间',
    example: '2026-05-17T03:00:00.000Z',
    nullable: true,
    required: true,
    validation: false,
  })
  expiresAt!: Date | null

  @DateProperty({
    description: '归档时间；为空表示未归档',
    example: '2026-05-17T03:00:00.000Z',
    nullable: true,
    required: true,
    validation: false,
  })
  archivedAt!: Date | null

  @ObjectProperty({
    description: '运行时非查询诊断摘要',
    example: { reason: 'partial failed' },
    required: true,
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
    description: '执行轮次列表',
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
    description: '通知事实类型（执行完成；异常后正在系统重试；最终失败）',
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
    nullable: true,
    validation: false,
  })
  nextRetryAt!: Date | null
}

/** 工作流通用条目 DTO。 */
export class WorkflowItemDto {
  @NumberProperty({
    description: '主键ID',
    example: 1,
    required: true,
    validation: false,
  })
  id!: number

  @StringProperty({
    description: '工作流条目ID',
    example: '8f12f79c-7d89-4daa-a6ea-c2af4d56e650',
    required: true,
    validation: false,
  })
  itemId!: string

  @StringProperty({
    description: '条目标题',
    example: '用户 #1001',
    required: true,
    validation: false,
  })
  title!: string

  @EnumProperty({
    description: '条目状态（1=待处理；2=处理中；3=成功；4=失败；5=重试中；6=已跳过）',
    enum: WorkflowItemStatusEnum,
    example: WorkflowItemStatusEnum.FAILED,
    required: true,
    validation: false,
  })
  status!: WorkflowItemStatusEnum

  @StringProperty({
    description: '业务对象类型',
    example: 'app-user',
    nullable: true,
    validation: false,
  })
  subjectType!: string | null

  @NumberProperty({
    description: '业务对象 ID',
    example: 1001,
    nullable: true,
    validation: false,
  })
  subjectId!: number | null

  @StringProperty({
    description: '业务对象展示名',
    example: '用户昵称',
    nullable: true,
    validation: false,
  })
  subjectLabel!: string | null

  @NumberProperty({
    description: '成功数量',
    example: 1,
    required: true,
    validation: false,
  })
  successCount!: number

  @NumberProperty({
    description: '总数量',
    example: 1,
    required: true,
    validation: false,
  })
  totalCount!: number

  @NumberProperty({
    description: '失败次数',
    example: 1,
    required: true,
    validation: false,
  })
  failureCount!: number

  @NestedProperty({
    description: '最近错误事实；admin 负责根据 code/context 表达',
    example: {
      code: 'COUPON_ADMIN_GRANT_ITEM_FAILED',
      context: { userId: 1001 },
      domain: 'coupon',
      retryable: true,
      severity: 'error',
      stage: 'grant-user',
    },
    nullable: true,
    required: true,
    type: WorkflowErrorFactsDto,
    validation: false,
  })
  lastError!: WorkflowErrorFactsDto | null

  @DateProperty({
    description: '下次可重试时间',
    example: '2026-05-17T03:10:00.000Z',
    nullable: true,
    required: true,
    validation: false,
  })
  nextRetryAt!: Date | null

  @ObjectProperty({
    description: '条目元数据',
    example: { phoneNumber: '13800000000' },
    required: true,
    validation: false,
    nullable: true,
  })
  metadata!: Record<string, unknown> | null

  @DateProperty({
    description: '更新时间',
    example: '2026-05-17T03:00:00.000Z',
    required: true,
    validation: false,
  })
  updatedAt!: Date
}

/** 工作流通用条目分页查询 DTO。 */
export class WorkflowItemPageRequestDto extends IntersectionType(
  PageDto,
  PartialType(
    IntersectionType(
      PickType(WorkflowJobIdentityFieldsDto, ['jobId'] as const),
      WorkflowItemStatusFieldsDto,
    ),
  ),
) {}

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
    description: '归档筛选范围（未归档；已归档；全部）',
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
    description: '工作流执行轮次ID',
    example: '8f12f79c-7d89-4daa-a6ea-c2af4d56e650',
    required: false,
  })
  attemptId?: string

  @ArrayProperty({
    description:
      '事件类型过滤；不传时默认返回关键生命周期/诊断记录（1=创建草稿；2=确认任务；3=认领执行轮次；4=心跳；5=进度更新；6=条目成功；7=条目失败；8=执行轮次完成；9=请求取消；10=人工重试；11=草稿过期；12=资源清理）',
    itemEnum: WorkflowEventTypeEnum,
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

  @ArrayProperty({
    description:
      '通知事实类型过滤；不传时返回执行完成、异常重试、最终失败',
    itemEnum: WorkflowNotificationKindEnum,
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
    nullable: true,
    validation: false,
  })
  nextCreatedAfter!: Date | null

  @NumberProperty({
    description: '同一游标时间下下一次轮询游标ID',
    example: 20,
    nullable: true,
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

/** 工作流执行轮次状态更新 DTO。 */
export class WorkflowAttemptCompleteDto {
  @StringProperty({
    description: '工作流执行轮次ID',
    example: '8f12f79c-7d89-4daa-a6ea-c2af4d56e650',
    required: true,
  })
  attemptId!: string

  @EnumProperty({
    description: '执行轮次终态（3=成功；4=部分失败；5=失败；6=已取消）',
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
    type: WorkflowErrorFactsDto,
    validation: false,
  })
  error!: WorkflowErrorFactsDto | null

  @ObjectProperty({
    description: '内部诊断对象；不作为 admin 展示文案来源',
    example: { source: 'manual-complete' },
    nullable: true,
    validation: false,
  })
  errorDiagnostic!: Record<string, unknown> | null
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

/** 工作流类型选项 DTO。 */
export class WorkflowTypeOptionDto {
  @StringProperty({
    description: '工作流类型',
    example: 'content-import.third-party-import',
    required: true,
    validation: false,
  })
  type!: string

  @StringProperty({
    description: '运营侧展示名称',
    example: '三方导入',
    required: true,
    validation: false,
  })
  label!: string

  @StringProperty({
    description: '工作流说明',
    example: '从三方书源导入漫画内容',
    nullable: true,
    required: true,
    validation: false,
  })
  description!: string | null

  @BooleanProperty({
    description: '是否可在后台筛选中展示为启用',
    example: true,
    required: true,
    validation: false,
  })
  enabled!: boolean
}

/** 工作流类型选项响应 DTO。 */
export class WorkflowTypeOptionsResponseDto {
  @ArrayProperty({
    description: '工作流类型选项列表',
    itemClass: WorkflowTypeOptionDto,
    required: true,
    validation: false,
  })
  list!: WorkflowTypeOptionDto[]
}
