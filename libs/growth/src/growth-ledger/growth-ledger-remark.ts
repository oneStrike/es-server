import type {
  ResolveGrowthLedgerRemarkInput,
  ResolveStoredGrowthLedgerRemarkInput,
} from './growth-ledger-remark.type'
import { EVENT_DEFINITION_MAP } from '../event-definition/event-definition.map'
import {
  GrowthAssetTypeEnum,
  GrowthLedgerActionEnum,
  GrowthLedgerSourceEnum,
} from './growth-ledger.constant'

/**
 * 按统一策略解析账本说明文案。
 * 规则型流水优先由 `ruleType -> EventDefinition.ledgerRemark` 派生；
 * 非规则直写流水则按 source / action / assetType 收口到中心 policy。
 */
export function resolveGrowthLedgerRemark(
  input: ResolveGrowthLedgerRemarkInput,
) {
  if (typeof input.ruleType === 'number') {
    const ruleRemark = EVENT_DEFINITION_MAP[input.ruleType]?.ledgerRemark
    if (ruleRemark) {
      return ruleRemark
    }
  }

  return resolveDirectGrowthLedgerRemark(input)
}

/**
 * 为历史账本记录回填 remark。
 * 历史记录没有显式 action 时，通过 delta 正负推导增减语义。
 */
export function resolveStoredGrowthLedgerRemark(
  input: ResolveStoredGrowthLedgerRemarkInput,
) {
  const action =
    input.delta < 0
      ? GrowthLedgerActionEnum.CONSUME
      : GrowthLedgerActionEnum.GRANT

  return resolveGrowthLedgerRemark({
    assetType: input.assetType,
    source: input.source,
    action,
    ruleType: input.ruleType,
  })
}

function resolveDirectGrowthLedgerRemark(
  input: ResolveGrowthLedgerRemarkInput,
) {
  switch (input.source) {
    case GrowthLedgerSourceEnum.TASK_BONUS:
      return buildBracketedAssetRemark('任务奖励', input.assetType)
    case GrowthLedgerSourceEnum.CHECK_IN_BASE_BONUS:
      return buildBracketedAssetRemark('签到奖励', input.assetType)
    case GrowthLedgerSourceEnum.CHECK_IN_STREAK_BONUS:
      return buildBracketedAssetRemark('连续签到奖励', input.assetType)
    case 'purchase':
      if (
        input.action === GrowthLedgerActionEnum.CONSUME &&
        input.assetType === GrowthAssetTypeEnum.POINTS
      ) {
        return '购买章节'
      }
      break
    case 'comic_sync':
      if (input.assetType === GrowthAssetTypeEnum.POINTS) {
        return input.action === GrowthLedgerActionEnum.CONSUME
          ? '漫画系统积分消费'
          : '漫画系统积分增加'
      }
      break
    case 'admin_app_user_module':
      return input.action === GrowthLedgerActionEnum.CONSUME
        ? buildActionAssetRemark('管理端人工扣减', input.assetType)
        : buildActionAssetRemark('管理端人工发放', input.assetType)
    case 'point_service':
      return input.action === GrowthLedgerActionEnum.CONSUME
        ? buildActionAssetRemark('扣减', input.assetType)
        : buildActionAssetRemark('发放', input.assetType)
    default:
      return input.action === GrowthLedgerActionEnum.CONSUME
        ? buildActionAssetRemark('扣减', input.assetType)
        : buildActionAssetRemark('发放', input.assetType)
  }

  return input.action === GrowthLedgerActionEnum.CONSUME
    ? buildActionAssetRemark('扣减', input.assetType)
    : buildActionAssetRemark('发放', input.assetType)
}

function buildBracketedAssetRemark(
  prefix: string,
  assetType: GrowthAssetTypeEnum,
) {
  return `${prefix}（${resolveGrowthLedgerAssetLabel(assetType)}）`
}

function buildActionAssetRemark(
  verb: string,
  assetType: GrowthAssetTypeEnum,
) {
  return `${verb}${resolveGrowthLedgerAssetLabel(assetType)}`
}

function resolveGrowthLedgerAssetLabel(assetType: GrowthAssetTypeEnum) {
  switch (assetType) {
    case GrowthAssetTypeEnum.POINTS:
      return '积分'
    case GrowthAssetTypeEnum.EXPERIENCE:
      return '经验'
    case GrowthAssetTypeEnum.ITEM:
      return '道具'
    case GrowthAssetTypeEnum.CURRENCY:
      return '虚拟货币'
    case GrowthAssetTypeEnum.LEVEL:
      return '等级'
    default:
      return '资产'
  }
}
