import {
  ArrayProperty,
  BooleanProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { GrowthRewardSettlementStatusEnum } from '../../growth-reward/growth-reward.constant'

/** 任务奖励批量重试入参 DTO。 */
export class RetryTaskRewardBatchDto {
  @NumberProperty({
    description: '本次最多扫描的待补偿任务实例数，最大 500',
    example: 100,
    required: false,
    min: 1,
    max: 500,
  })
  limit?: number
}

/** 任务奖励重试结果 DTO。 */
export class TaskRewardRetryResultDto {
  @NumberProperty({
    description: '任务实例 ID',
    example: 88,
    validation: false,
  })
  instanceId!: number

  @NumberProperty({
    description: '奖励结算事实 ID',
    example: 501,
    nullable: true,
    validation: false,
  })
  rewardSettlementId!: number | null

  @EnumProperty({
    description: '补偿状态（0=待补偿重试；1=已补偿成功；2=终态失败）',
    example: GrowthRewardSettlementStatusEnum.SUCCESS,
    enum: GrowthRewardSettlementStatusEnum,
    nullable: true,
    validation: false,
  })
  settlementStatus!: GrowthRewardSettlementStatusEnum | null

  @BooleanProperty({
    description: '本次重试后是否已补偿成功',
    example: true,
    validation: false,
  })
  succeeded!: boolean

  @StringProperty({
    description: '本次重试处理结果说明',
    example: '任务奖励已补偿成功',
    validation: false,
  })
  message!: string
}

/** 任务奖励批量重试失败摘要 DTO。 */
export class TaskRewardRetryFailureDto {
  @NumberProperty({
    description: '任务实例 ID',
    example: 88,
    validation: false,
  })
  instanceId!: number

  @NumberProperty({
    description: '奖励结算事实 ID',
    example: 501,
    nullable: true,
    validation: false,
  })
  rewardSettlementId!: number | null

  @StringProperty({
    description: '失败原因摘要',
    example: '任务奖励发放失败，请稍后重试',
    validation: false,
  })
  message!: string
}

/** 任务奖励批量重试结果 DTO。 */
export class TaskRewardRetryBatchResultDto {
  @NumberProperty({
    description: '本次扫描到的任务实例数',
    example: 12,
    validation: false,
  })
  scannedCount!: number

  @NumberProperty({
    description: '本次补偿成功数',
    example: 10,
    validation: false,
  })
  succeededCount!: number

  @NumberProperty({
    description: '本次补偿后仍未成功的任务实例数',
    example: 1,
    validation: false,
  })
  failedCount!: number

  @NumberProperty({
    description: '本次扫描后判定不可重试并跳过的任务实例数',
    example: 1,
    validation: false,
  })
  skippedCount!: number

  @ArrayProperty({
    description: '失败摘要列表，最多返回前 20 条',
    itemClass: TaskRewardRetryFailureDto,
    validation: false,
  })
  failures!: TaskRewardRetryFailureDto[]
}
