import type {
  GrowthAssetTypeEnum,
  GrowthLedgerFailReasonEnum,
} from '../growth-ledger/growth-ledger.constant'
import type {
  TaskAssignmentRewardResultTypeEnum,
} from '../task/task.constant'

export interface TaskRewardAssetResult {
  assetType: GrowthAssetTypeEnum.POINTS | GrowthAssetTypeEnum.EXPERIENCE
  configuredAmount: number
  success: boolean
  duplicated: boolean
  skipped: boolean
  recordId?: number
  reason?: GrowthLedgerFailReasonEnum | 'not_configured'
}

export interface TaskRewardSettlementResult {
  success: boolean
  resultType: TaskAssignmentRewardResultTypeEnum
  settledAt: Date
  ledgerRecordIds: number[]
  errorMessage?: string
  pointsReward: TaskRewardAssetResult
  experienceReward: TaskRewardAssetResult
}
