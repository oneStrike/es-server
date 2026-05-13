import {
  DateProperty,
  EnumProperty,
  NumberProperty,
  ObjectProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { PageDto } from '@libs/platform/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import {
  BACKGROUND_TASK_DEFAULT_MAX_RETRY,
  BackgroundTaskStatusEnum,
} from '../background-task.constant'

/** 后台任务 ID 字段。 */
class BackgroundTaskIdentityFieldsDto {
  @StringProperty({
    description: '后台任务ID',
    example: '8f12f79c-7d89-4daa-a6ea-c2af4d56e650',
    required: true,
  })
  taskId!: string
}

/** 后台任务类型字段。 */
class BackgroundTaskTypeFieldsDto {
  @StringProperty({
    description: '后台任务类型',
    example: 'content.third-party-comic-import',
    required: true,
  })
  taskType!: string
}

/** 后台任务状态字段。 */
class BackgroundTaskStatusFieldsDto {
  @EnumProperty({
    description:
      '任务状态（1=待处理；2=处理中；3=最终写入中；4=成功；5=失败；6=已取消；7=回滚失败）',
    enum: BackgroundTaskStatusEnum,
    example: BackgroundTaskStatusEnum.PENDING,
    required: true,
  })
  status!: BackgroundTaskStatusEnum
}

/** 后台任务负载字段。 */
class BackgroundTaskPayloadFieldsDto {
  @ObjectProperty({
    description: '任务负载',
    example: { comicId: 'woduzishenji' },
    required: true,
  })
  payload!: Record<string, unknown>
}

/** 后台任务详情 DTO。 */
export class BackgroundTaskDto {
  @NumberProperty({
    description: '主键id',
    example: 1,
    required: true,
    validation: false,
  })
  id!: number

  @StringProperty({
    description: '后台任务ID',
    example: '8f12f79c-7d89-4daa-a6ea-c2af4d56e650',
    required: true,
    validation: false,
  })
  taskId!: string

  @StringProperty({
    description: '后台任务类型',
    example: 'content.third-party-comic-import',
    required: true,
    validation: false,
  })
  taskType!: string

  @EnumProperty({
    description:
      '任务状态（1=待处理；2=处理中；3=最终写入中；4=成功；5=失败；6=已取消；7=回滚失败）',
    enum: BackgroundTaskStatusEnum,
    example: BackgroundTaskStatusEnum.PENDING,
    required: true,
    validation: false,
  })
  status!: BackgroundTaskStatusEnum

  @ObjectProperty({
    description: '任务负载',
    example: { comicId: 'woduzishenji' },
    required: true,
    validation: false,
  })
  payload!: Record<string, unknown>

  @ObjectProperty({
    description: '任务进度',
    example: { percent: 0, message: '等待执行' },
    required: true,
    validation: false,
  })
  progress!: Record<string, unknown>

  @ObjectProperty({
    description: '任务成功结果',
    example: { importedCount: 10 },
    required: false,
    validation: false,
    nullable: true,
  })
  result!: Record<string, unknown> | null

  @ObjectProperty({
    description: '任务错误信息',
    example: { message: '导入失败' },
    required: false,
    validation: false,
    nullable: true,
  })
  error!: Record<string, unknown> | null

  @ObjectProperty({
    description: '任务残留诊断',
    example: { createdWorkIds: [1] },
    required: false,
    validation: false,
    nullable: true,
  })
  residue!: Record<string, unknown> | null

  @ObjectProperty({
    description: '回滚失败诊断',
    example: { message: '清理文件失败' },
    required: false,
    validation: false,
    nullable: true,
  })
  rollbackError!: Record<string, unknown> | null

  @NumberProperty({
    description: '已重试次数',
    example: 0,
    required: true,
    validation: false,
  })
  retryCount!: number

  @NumberProperty({
    description: '最大允许重试次数',
    example: BACKGROUND_TASK_DEFAULT_MAX_RETRY,
    required: true,
    validation: false,
  })
  maxRetries!: number

  @DateProperty({
    description: '取消请求时间',
    example: '2026-05-13T03:00:00.000Z',
    required: false,
    validation: false,
  })
  cancelRequestedAt!: Date | null

  @StringProperty({
    description: '当前处理 worker',
    example: 'admin-api-worker-1',
    required: false,
    validation: false,
  })
  claimedBy!: string | null

  @DateProperty({
    description: 'claim 过期时间',
    example: '2026-05-13T03:05:00.000Z',
    required: false,
    validation: false,
  })
  claimExpiresAt!: Date | null

  @DateProperty({
    description: '开始处理时间',
    example: '2026-05-13T03:00:00.000Z',
    required: false,
    validation: false,
  })
  startedAt!: Date | null

  @DateProperty({
    description: '进入最终写入时间',
    example: '2026-05-13T03:01:00.000Z',
    required: false,
    validation: false,
  })
  finalizingAt!: Date | null

  @DateProperty({
    description: '完成时间',
    example: '2026-05-13T03:03:00.000Z',
    required: false,
    validation: false,
  })
  finishedAt!: Date | null

  @DateProperty({
    description: '创建时间',
    example: '2024-01-01T00:00:00.000Z',
    required: true,
    validation: false,
  })
  createdAt!: Date

  @DateProperty({
    description: '更新时间',
    example: '2024-01-01T00:00:00.000Z',
    required: true,
    validation: false,
  })
  updatedAt!: Date
}

/** 后台任务 ID DTO。 */
export class BackgroundTaskIdDto extends PickType(
  BackgroundTaskIdentityFieldsDto,
  ['taskId'] as const,
) {}

/** 后台任务分页查询 DTO。 */
export class BackgroundTaskPageRequestDto extends IntersectionType(
  PageDto,
  PartialType(
    IntersectionType(
      BackgroundTaskIdentityFieldsDto,
      IntersectionType(
        BackgroundTaskTypeFieldsDto,
        BackgroundTaskStatusFieldsDto,
      ),
    ),
  ),
) {}

/** 创建后台任务 DTO。 */
export class CreateBackgroundTaskDto extends IntersectionType(
  BackgroundTaskTypeFieldsDto,
  BackgroundTaskPayloadFieldsDto,
) {
  @NumberProperty({
    description: '最大允许重试次数',
    example: BACKGROUND_TASK_DEFAULT_MAX_RETRY,
    required: false,
    default: BACKGROUND_TASK_DEFAULT_MAX_RETRY,
  })
  maxRetries?: number
}
