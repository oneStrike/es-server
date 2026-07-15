import type { DbTransaction, PageResult } from '@db/core'
import type {
  PurchaseRecordResponseDto,
  QueryPurchasedWorkChapterCommandDto,
  QueryPurchasedWorkCommandDto,
} from '../dto/purchase.dto'
import type {
  PaymentMethodEnum,
  PurchaseTargetTypeEnum,
} from '../purchase.constant'

/** 购买校验后供订单冻结的最小章节价格事实。 */
export interface ResolvedPurchaseTarget {
  originalPrice: number
}

/** 订单价格快照在内容历史查询中的中立表达。 */
export interface PurchasePricingSnapshot {
  originalPrice: number
  payableRate: number
  payablePrice: number
  discountAmount: number
}

/** 购买成功后写入内容权益时保留的订单价格与优惠事实。 */
export interface PurchaseContentEntitlementGrantSnapshot {
  originalPrice: number
  paidPrice: number
  payableRate: string
  paymentMethod: PaymentMethodEnum
  outTradeNo: string | null | undefined
  couponInstanceId: number | null | undefined
  discountAmount: number
  levelPayableRate: string
  levelDiscountAmount: number
  couponDiscountAmount: number
  discountSource: number
}

/** 购买成功后写入内容权益和计数所需的冻结订单事实。 */
export interface GrantPurchaseContentEntitlementInput {
  userId: number
  targetType: PurchaseTargetTypeEnum
  targetId: number
  sourceId: number
  grantSnapshot: PurchaseContentEntitlementGrantSnapshot
}

/** 内容域已购作品历史查询返回的作品展示行。 */
export interface PurchasedWorkPortWork {
  id: number
  type: number
  name: string
  cover: string
}

/** 内容域已购作品历史查询向购买域返回的内部读模型。 */
export interface PurchasedWorkPortItem {
  work: PurchasedWorkPortWork
  purchasedChapterCount: number
  lastPurchasedAt: Date
}

/** 内容域已购章节历史查询返回的章节展示行。 */
export interface PurchasedWorkChapterPortChapter {
  id: number
  workId: number
  workType: number
  title: string
  subtitle: string | null
  cover: string | null
  sortOrder: number
  isPublished: boolean
  publishAt: Date | null
}

/** 内容域已购章节历史查询向购买域返回的内部读模型。 */
export interface PurchasedWorkChapterPortItem extends PurchaseRecordResponseDto {
  purchasePricing: PurchasePricingSnapshot
  chapter: PurchasedWorkChapterPortChapter
}

/**
 * 购买域消费内容域能力的最小同步端口。
 * 购买域拥有订单、钱包和券事务；内容适配器只在传入事务内处理权益和计数。
 */
export interface PurchaseContentPort {
  ensureChapterPurchaseable: (
    targetType: PurchaseTargetTypeEnum,
    targetId: number,
  ) => Promise<ResolvedPurchaseTarget>
  grantPurchaseEntitlement: (
    tx: DbTransaction,
    input: GrantPurchaseContentEntitlementInput,
  ) => Promise<void>
  getPurchasedWorks: (
    query: QueryPurchasedWorkCommandDto,
  ) => Promise<PageResult<PurchasedWorkPortItem>>
  getPurchasedWorkChapters: (
    query: QueryPurchasedWorkChapterCommandDto,
  ) => Promise<PageResult<PurchasedWorkChapterPortItem>>
}
