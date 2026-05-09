import type {
  MembershipPlanSelect,
  PaymentOrderSelect,
  PaymentProviderConfigSelect,
  UserMembershipSubscriptionSelect,
} from '@db/schema'
import type { SQL } from 'drizzle-orm'
import type {
  BenefitValueRecord,
  ConfirmPaymentOrderContext,
  ConsumeCouponRedemptionInput,
  ConsumeCouponRedemptionResult,
  CouponInstanceLookupInput,
  CreatePaymentOrderInput,
  MembershipAgreementSnapshot,
  MembershipPageAgreementQueryOptions,
  MembershipPlanUpdateData,
  MonetizationTx,
  MembershipPageConfigIdentity as PageConfigIdentity,
  PaymentOrderPublicResult,
  ReserveDiscountCouponInput,
} from './monetization.type'
import { randomUUID } from 'node:crypto'
import { DrizzleService } from '@db/core'
import {
  ContentEntitlementGrantSourceEnum,
  ContentEntitlementStatusEnum,
  ContentEntitlementTargetTypeEnum,
  MembershipSubscriptionSourceTypeEnum,
  MembershipSubscriptionStatusEnum,
} from '@libs/content/permission/content-entitlement.constant'
import { ContentEntitlementService } from '@libs/content/permission/content-entitlement.service'
import { ContentPermissionService } from '@libs/content/permission/content-permission.service'
import {
  GrowthAssetTypeEnum,
  GrowthLedgerActionEnum,
} from '@libs/growth/growth-ledger/growth-ledger.constant'
import { GrowthLedgerService } from '@libs/growth/growth-ledger/growth-ledger.service'
import {
  BusinessErrorCode,
  WorkViewPermissionEnum,
} from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { startOfTodayInAppTimeZone } from '@libs/platform/utils'
import { Injectable, Logger } from '@nestjs/common'
import { and, asc, desc, eq, gt, gte, inArray, sql } from 'drizzle-orm'
import { AD_REWARD_PROVIDER_ADAPTERS } from './ad-reward-provider.adapter'
import {
  AdRewardVerificationDto,
  ConfirmPaymentOrderDto,
  CreateAdProviderConfigDto,
  CreateCouponDefinitionDto,
  CreateCurrencyPackageDto,
  CreateCurrencyRechargeOrderDto,
  CreateMembershipBenefitDefinitionDto,
  CreateMembershipPageConfigDto,
  CreateMembershipPlanDto,
  CreatePaymentOrderBaseDto,
  CreatePaymentProviderConfigDto,
  CreateVipSubscriptionOrderDto,
  GrantCouponDto,
  MembershipPlanBenefitInputDto,
  QueryAdProviderConfigDto,
  QueryCouponDefinitionDto,
  QueryCurrencyPackageDto,
  QueryMembershipAutoRenewAgreementDto,
  QueryMembershipBenefitDefinitionDto,
  QueryMembershipPageConfigDto,
  QueryMembershipPlanDto,
  QueryPaymentOrderDto,
  QueryPaymentProviderConfigDto,
  QueryUserCouponDto,
  RedeemCouponCommandDto,
  UpdateAdProviderConfigDto,
  UpdateCouponDefinitionDto,
  UpdateCurrencyPackageDto,
  UpdateMembershipBenefitDefinitionDto,
  UpdateMembershipPageConfigDto,
  UpdateMembershipPlanDto,
  UpdatePaymentProviderConfigDto,
} from './dto/monetization.dto'
import {
  AdRewardStatusEnum,
  CouponInstanceStatusEnum,
  CouponRedemptionStatusEnum,
  CouponRedemptionTargetTypeEnum,
  CouponTypeEnum,
  MembershipAutoRenewAgreementStatusEnum,
  MembershipBenefitGrantPolicyEnum,
  MembershipBenefitTypeEnum,
  MembershipPlanTierEnum,
  PaymentOrderStatusEnum,
  PaymentOrderTypeEnum,
  PaymentSceneEnum,
  PaymentSubscriptionModeEnum,
  READING_COIN_ASSET_KEY,
} from './monetization.constant'
import { PAYMENT_PROVIDER_ADAPTERS } from './payment-provider.adapter'

@Injectable()
export class MonetizationService {
  private readonly logger = new Logger(MonetizationService.name)

  // 注入变现模块依赖的数据库、账本、权限和权益服务。
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly growthLedgerService: GrowthLedgerService,
    private readonly contentPermissionService: ContentPermissionService,
    private readonly contentEntitlementService: ContentEntitlementService,
  ) {}

  // 获取当前请求使用的 Drizzle 查询实例。
  private get db() {
    return this.drizzle.db
  }

  // 获取支付 provider 配置表定义。
  private get paymentProviderConfig() {
    return this.drizzle.schema.paymentProviderConfig
  }

  // 获取支付订单表定义。
  private get paymentOrder() {
    return this.drizzle.schema.paymentOrder
  }

  // 获取虚拟币充值包表定义。
  private get currencyPackage() {
    return this.drizzle.schema.currencyPackage
  }

  // 获取会员套餐表定义。
  private get membershipPlan() {
    return this.drizzle.schema.membershipPlan
  }

  // 获取会员权益定义表定义。
  private get membershipBenefitDefinition() {
    return this.drizzle.schema.membershipBenefitDefinition
  }

  // 获取会员套餐权益关联表定义。
  private get membershipPlanBenefit() {
    return this.drizzle.schema.membershipPlanBenefit
  }

  // 获取会员订阅页配置表定义。
  private get membershipPageConfig() {
    return this.drizzle.schema.membershipPageConfig
  }

  // 获取会员订阅页协议关联表定义。
  private get membershipPageConfigAgreement() {
    return this.drizzle.schema.membershipPageConfigAgreement
  }

  // 获取应用协议表定义。
  private get appAgreement() {
    return this.drizzle.schema.appAgreement
  }

  // 获取会员自动续费协议表定义。
  private get membershipAutoRenewAgreement() {
    return this.drizzle.schema.membershipAutoRenewAgreement
  }

  // 获取会员权益领取记录表定义。
  private get membershipBenefitClaimRecord() {
    return this.drizzle.schema.membershipBenefitClaimRecord
  }

  // 获取用户会员订阅事实表定义。
  private get userMembershipSubscription() {
    return this.drizzle.schema.userMembershipSubscription
  }

  // 获取券定义表定义。
  private get couponDefinition() {
    return this.drizzle.schema.couponDefinition
  }

  // 获取用户券实例表定义。
  private get userCouponInstance() {
    return this.drizzle.schema.userCouponInstance
  }

  // 获取券核销记录表定义。
  private get couponRedemptionRecord() {
    return this.drizzle.schema.couponRedemptionRecord
  }

  // 获取广告 provider 配置表定义。
  private get adProviderConfig() {
    return this.drizzle.schema.adProviderConfig
  }

  // 获取广告奖励记录表定义。
  private get adRewardRecord() {
    return this.drizzle.schema.adRewardRecord
  }

  // 获取用户资产余额表定义。
  private get userAssetBalance() {
    return this.drizzle.schema.userAssetBalance
  }

  // 获取用户内容权益事实表定义。
  private get userContentEntitlement() {
    return this.drizzle.schema.userContentEntitlement
  }

  // 获取作品章节表定义。
  private get workChapter() {
    return this.drizzle.schema.workChapter
  }

  // 汇总用户钱包、会员、券和已购章节概览。
  async getWalletDetail(userId: number) {
    const [balanceRow, vipRow, couponCountRow, purchasedChapterRow] =
      await Promise.all([
        this.db.query.userAssetBalance.findFirst({
          where: {
            userId,
            assetType: GrowthAssetTypeEnum.CURRENCY,
            assetKey: READING_COIN_ASSET_KEY,
          },
          columns: { balance: true },
        }),
        this.db
          .select({
            vipExpiresAt: sql<Date | null>`max(${this.userMembershipSubscription.endsAt})`,
          })
          .from(this.userMembershipSubscription)
          .where(
            and(
              eq(this.userMembershipSubscription.userId, userId),
              eq(
                this.userMembershipSubscription.status,
                MembershipSubscriptionStatusEnum.ACTIVE,
              ),
              gt(this.userMembershipSubscription.endsAt, new Date()),
            ),
          ),
        this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(this.userCouponInstance)
          .where(
            and(
              eq(this.userCouponInstance.userId, userId),
              eq(
                this.userCouponInstance.status,
                CouponInstanceStatusEnum.AVAILABLE,
              ),
              gt(this.userCouponInstance.remainingUses, 0),
            ),
          ),
        this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(this.userContentEntitlement)
          .where(
            and(
              eq(this.userContentEntitlement.userId, userId),
              eq(
                this.userContentEntitlement.grantSource,
                ContentEntitlementGrantSourceEnum.PURCHASE,
              ),
              eq(
                this.userContentEntitlement.status,
                ContentEntitlementStatusEnum.ACTIVE,
              ),
            ),
          ),
      ])

    const purchasedWorkRows = await this.db
      .select({
        total: sql<bigint>`COUNT(DISTINCT ${this.workChapter.workId})::bigint`,
      })
      .from(this.userContentEntitlement)
      .innerJoin(
        this.workChapter,
        eq(this.workChapter.id, this.userContentEntitlement.targetId),
      )
      .where(
        and(
          eq(this.userContentEntitlement.userId, userId),
          eq(
            this.userContentEntitlement.grantSource,
            ContentEntitlementGrantSourceEnum.PURCHASE,
          ),
          eq(
            this.userContentEntitlement.status,
            ContentEntitlementStatusEnum.ACTIVE,
          ),
        ),
      )

    return {
      currencyBalance: balanceRow?.balance ?? 0,
      vipExpiresAt: vipRow[0]?.vipExpiresAt ?? null,
      availableCouponCount: Number(couponCountRow[0]?.count ?? 0),
      purchasedChapterCount: Number(purchasedChapterRow[0]?.count ?? 0),
      purchasedWorkCount: Number(purchasedWorkRows[0]?.total ?? 0n),
    }
  }

  // 获取 App 可展示的会员套餐列表。
  async getMembershipPlanList() {
    return this.db
      .select()
      .from(this.membershipPlan)
      .where(eq(this.membershipPlan.isEnabled, true))
      .orderBy(
        asc(this.membershipPlan.tier),
        asc(this.membershipPlan.sortOrder),
        asc(this.membershipPlan.id),
      )
  }

  // 聚合订阅页所需的套餐、权益、法务文案和当前用户订阅摘要，避免客户端硬编码截图页字段。
  async getVipSubscriptionPage(userId: number) {
    const pageConfig = await this.getEnabledMembershipPageConfig()
    const agreements = await this.getMembershipPageAgreementItems(
      pageConfig.id,
      { publishedOnly: true },
    )
    const plans = await this.getMembershipPlanList()
    const planIds = plans.map((plan) => plan.id)
    const benefits =
      planIds.length > 0 ? await this.getEnabledPlanBenefitItems(planIds) : []
    const currentSubscription =
      await this.resolveMembershipSubscriptionSummary(userId)

    return {
      pageConfig: {
        ...pageConfig,
        agreements,
      },
      plans,
      benefits,
      currentSubscription,
    }
  }

  // 获取 App 可购买的虚拟币充值包列表。
  async getCurrencyPackageList() {
    return this.db
      .select()
      .from(this.currencyPackage)
      .where(eq(this.currencyPackage.isEnabled, true))
      .orderBy(
        asc(this.currencyPackage.sortOrder),
        asc(this.currencyPackage.id),
      )
  }

  // 创建虚拟币充值支付订单。
  async createCurrencyRechargeOrder(
    userId: number,
    dto: CreateCurrencyRechargeOrderDto,
  ) {
    const [pack] = await this.db
      .select()
      .from(this.currencyPackage)
      .where(
        and(
          eq(this.currencyPackage.id, dto.packageId),
          eq(this.currencyPackage.isEnabled, true),
        ),
      )
      .limit(1)
    if (!pack) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '充值包不存在或未启用',
      )
    }

    return this.createPaymentOrder(userId, {
      ...dto,
      orderType: PaymentOrderTypeEnum.CURRENCY_RECHARGE,
      targetId: pack.id,
      payableAmount: pack.price,
      targetSnapshot: {
        packageKey: pack.packageKey,
        currencyAmount: pack.currencyAmount,
        bonusAmount: pack.bonusAmount,
      },
    })
  }

  // 创建 VIP 订阅支付订单，并冻结下单时的协议快照。
  async createVipSubscriptionOrder(
    userId: number,
    dto: CreateVipSubscriptionOrderDto,
  ) {
    const subscriptionMode =
      dto.subscriptionMode ?? PaymentSubscriptionModeEnum.ONE_TIME
    if (
      ![
        PaymentSubscriptionModeEnum.ONE_TIME,
        PaymentSubscriptionModeEnum.AUTO_RENEW_SIGNING,
      ].includes(subscriptionMode)
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        'VIP 下单只支持一次性订阅或自动续费签约首单',
      )
    }
    const plan = await this.db.query.membershipPlan.findFirst({
      where: {
        id: dto.planId,
        isEnabled: true,
      },
    })
    if (!plan) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        'VIP 套餐不存在或未启用',
      )
    }
    if (
      subscriptionMode === PaymentSubscriptionModeEnum.AUTO_RENEW_SIGNING &&
      !plan.autoRenewEnabled
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '当前 VIP 套餐不支持自动续费',
      )
    }
    const agreements = await this.resolveEnabledMembershipAgreementSnapshots()

    return this.createPaymentOrder(userId, {
      ...dto,
      subscriptionMode,
      orderType: PaymentOrderTypeEnum.VIP_SUBSCRIPTION,
      targetId: plan.id,
      payableAmount: plan.priceAmount,
      targetSnapshot: {
        planKey: plan.planKey,
        tier: plan.tier,
        durationDays: plan.durationDays,
        bonusPointAmount: plan.bonusPointAmount,
        agreements,
      },
    })
  }

  // 确认 provider 已验签支付结果，app 场景必须绑定当前用户订单。
  async confirmPaymentOrder(
    dto: ConfirmPaymentOrderDto,
    context?: ConfirmPaymentOrderContext,
  ) {
    const order = await this.db.query.paymentOrder.findFirst({
      where: { orderNo: dto.orderNo },
    })
    if (!order) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '支付订单不存在',
      )
    }
    if (context?.userId !== undefined && order.userId !== context.userId) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '支付订单不存在',
      )
    }

    const config = await this.getPaymentProviderConfigById(
      order.providerConfigId,
    )
    const adapter = this.getPaymentAdapter(order.channel)
    const notifyInput = {
      order,
      config,
      payload: dto.notifyPayload,
    }
    if (!adapter.verifyNotify(notifyInput)) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '支付回调验签失败',
      )
    }
    const parsed = adapter.parseNotify(notifyInput)
    const providerTradeNo = parsed.providerTradeNo
    const paidAmount = parsed.paidAmount
    const agreementNo = parsed.agreementNo
    if (!providerTradeNo || paidAmount === undefined) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '支付回调缺少已验签交易字段',
      )
    }
    const autoRenewAgreementNo =
      order.subscriptionMode === PaymentSubscriptionModeEnum.AUTO_RENEW_SIGNING
        ? this.requireAutoRenewAgreementNo(agreementNo)
        : undefined
    if (
      paidAmount !== order.payableAmount ||
      (dto.paidAmount !== undefined && dto.paidAmount !== paidAmount) ||
      (dto.providerTradeNo !== undefined &&
        dto.providerTradeNo !== providerTradeNo)
    ) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '支付回调金额或交易号与订单不一致',
      )
    }

    if (order.status === PaymentOrderStatusEnum.PAID) {
      this.assertPaidOrderMatchesNotify(order, paidAmount, providerTradeNo)
      return this.toPaymentOrderResult(order, {})
    }

    if (order.status !== PaymentOrderStatusEnum.PENDING) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '当前订单状态不允许支付确认',
      )
    }

    return this.drizzle.withTransaction(async (tx) => {
      const [paidOrder] = await tx
        .update(this.paymentOrder)
        .set({
          status: PaymentOrderStatusEnum.PAID,
          paidAmount,
          providerTradeNo,
          notifyPayload: dto.notifyPayload,
          paidAt: new Date(),
        })
        .where(
          and(
            eq(this.paymentOrder.id, order.id),
            eq(this.paymentOrder.status, PaymentOrderStatusEnum.PENDING),
          ),
        )
        .returning()

      if (!paidOrder) {
        const latestOrder = await tx.query.paymentOrder.findFirst({
          where: { id: order.id },
        })
        if (latestOrder?.status === PaymentOrderStatusEnum.PAID) {
          this.assertPaidOrderMatchesNotify(
            latestOrder,
            paidAmount,
            providerTradeNo,
          )
          return this.toPaymentOrderResult(latestOrder, {})
        }
        if (latestOrder) {
          throw new BusinessException(
            BusinessErrorCode.STATE_CONFLICT,
            '当前订单状态不允许支付确认',
          )
        }
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_NOT_FOUND,
          '支付订单不存在',
        )
      }

      await this.settlePaidOrder(tx, paidOrder, autoRenewAgreementNo)

      this.logger.log(
        `payment_order_paid orderNo=${paidOrder.orderNo} userId=${paidOrder.userId} orderType=${paidOrder.orderType} providerConfigId=${paidOrder.providerConfigId} providerConfigVersion=${paidOrder.providerConfigVersion}`,
      )

      return this.toPaymentOrderResult(paidOrder, {})
    })
  }

  // 分页查询用户当前可用券实例。
  async getUserCouponPage(userId: number, dto: QueryUserCouponDto) {
    const page = this.drizzle.buildPage(dto)
    const conditions = [
      eq(this.userCouponInstance.userId, userId),
      eq(this.userCouponInstance.status, CouponInstanceStatusEnum.AVAILABLE),
      gt(this.userCouponInstance.remainingUses, 0),
    ]
    if (dto.couponType !== undefined) {
      conditions.push(eq(this.userCouponInstance.couponType, dto.couponType))
    }

    const [rows, totalRows] = await Promise.all([
      this.db
        .select({
          id: this.userCouponInstance.id,
          userId: this.userCouponInstance.userId,
          couponDefinitionId: this.userCouponInstance.couponDefinitionId,
          couponType: this.userCouponInstance.couponType,
          status: this.userCouponInstance.status,
          remainingUses: this.userCouponInstance.remainingUses,
          expiresAt: this.userCouponInstance.expiresAt,
          createdAt: this.userCouponInstance.createdAt,
          updatedAt: this.userCouponInstance.updatedAt,
          name: this.couponDefinition.name,
        })
        .from(this.userCouponInstance)
        .innerJoin(
          this.couponDefinition,
          eq(
            this.couponDefinition.id,
            this.userCouponInstance.couponDefinitionId,
          ),
        )
        .where(and(...conditions))
        .orderBy(desc(this.userCouponInstance.createdAt))
        .limit(page.limit)
        .offset(page.offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(this.userCouponInstance)
        .where(and(...conditions)),
    ])

    return {
      list: rows,
      total: Number(totalRows[0]?.total ?? 0),
      pageIndex: page.pageIndex,
      pageSize: page.pageSize,
    }
  }

  // 核销用户券并在同一事务中执行对应权益发放。
  async redeemCoupon(dto: RedeemCouponCommandDto) {
    return this.drizzle.withTransaction(async (tx) => {
      const redemption = await this.redeemCouponInTx(tx, dto)
      return redemption
    })
  }

  // 购买章节前预留折扣券并返回优惠后的应付价格。
  async reserveDiscountCoupon(
    tx: MonetizationTx,
    input: ReserveDiscountCouponInput,
  ) {
    const coupon = await this.getCouponInstanceWithDefinition(tx, {
      userId: input.userId,
      couponInstanceId: input.couponInstanceId,
    })
    if (coupon.couponType !== CouponTypeEnum.DISCOUNT) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '只有折扣券可以参与章节购买价格计算',
      )
    }

    const discountedByRate = Math.floor(
      (input.originalPrice * coupon.discountRateBps) / 10000,
    )
    const paidPrice = Math.max(0, discountedByRate - coupon.discountAmount)
    const discountAmount = input.originalPrice - paidPrice
    const bizKey = `discount:${input.userId}:${input.targetType}:${input.targetId}:${input.couponInstanceId}`

    const { redemption } = await this.consumeCouponAndWriteRedemption(tx, {
      ...input,
      coupon,
      bizKey,
      redemptionSnapshot: {
        originalPrice: input.originalPrice,
        paidPrice,
        discountAmount,
        discountRateBps: coupon.discountRateBps,
      },
    })

    return {
      paidPrice,
      discountAmount,
      couponInstanceId: input.couponInstanceId,
      redemptionRecordId: redemption.id,
      discountSource: CouponTypeEnum.DISCOUNT,
    }
  }

  // 验证广告奖励回调并写入奖励权益事实。
  async verifyAdReward(userId: number, dto: AdRewardVerificationDto) {
    const config = await this.resolveAdProviderConfig(dto)
    const adapter = this.getAdRewardAdapter(dto.provider)
    if (!adapter.verifyRewardCallback({ userId, config, payload: dto })) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '广告奖励验证失败',
      )
    }
    const rewardPayload = adapter.parseRewardPayload({
      userId,
      config,
      payload: dto,
    })
    await this.assertAdTargetAllowed(dto)

    return this.drizzle.withTransaction(async (tx) => {
      const existing = await tx.query.adRewardRecord.findFirst({
        where: {
          adProviderConfigId: config.id,
          providerRewardId: rewardPayload.providerRewardId,
        },
      })
      if (existing) {
        return existing
      }

      if (config.dailyLimit > 0) {
        const [countRow] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(this.adRewardRecord)
          .where(
            and(
              eq(this.adRewardRecord.userId, userId),
              eq(this.adRewardRecord.adProviderConfigId, config.id),
              gte(this.adRewardRecord.createdAt, startOfTodayInAppTimeZone()),
            ),
          )
        if (Number(countRow?.count ?? 0) >= config.dailyLimit) {
          throw new BusinessException(
            BusinessErrorCode.QUOTA_NOT_ENOUGH,
            '广告奖励次数已达上限',
          )
        }
      }

      const [record] = await tx
        .insert(this.adRewardRecord)
        .values({
          userId,
          adProviderConfigId: config.id,
          adProviderConfigVersion: config.configVersion,
          credentialVersionRef: config.credentialVersionRef,
          providerRewardId: rewardPayload.providerRewardId,
          placementKey: rewardPayload.placementKey,
          targetType: this.resolveContentEntitlementTargetType(dto.targetType),
          targetId: dto.targetId,
          status: AdRewardStatusEnum.SUCCESS,
          clientContext: dto.clientContext,
          rawNotifyPayload: dto.verifyPayload,
          verifyPayload: {
            provider: dto.provider,
            platform: dto.platform,
            environment: dto.environment,
            clientAppKey: this.normalizeKey(dto.clientAppKey),
            appId: this.normalizeKey(dto.appId),
          },
        })
        .onConflictDoNothing()
        .returning()
      if (!record) {
        const duplicated = await tx.query.adRewardRecord.findFirst({
          where: {
            adProviderConfigId: config.id,
            providerRewardId: rewardPayload.providerRewardId,
          },
        })
        if (duplicated) {
          return duplicated
        }
        throw new BusinessException(
          BusinessErrorCode.STATE_CONFLICT,
          '广告奖励写入失败',
        )
      }

      await this.contentEntitlementService.grantEntitlement(tx, {
        userId,
        targetType: this.resolveContentEntitlementTargetType(dto.targetType),
        targetId: dto.targetId,
        grantSource: ContentEntitlementGrantSourceEnum.AD,
        sourceId: record.id,
        sourceKey: rewardPayload.providerRewardId,
        expiresAt: this.addDays(new Date(), 1),
        grantSnapshot: {
          adProviderConfigId: config.id,
          adProviderConfigVersion: config.configVersion,
          credentialVersionRef: config.credentialVersionRef,
          placementKey: rewardPayload.placementKey,
        },
      })

      this.logger.log(
        `ad_reward_success userId=${userId} adProviderConfigId=${config.id} adProviderConfigVersion=${config.configVersion} providerRewardId=${rewardPayload.providerRewardId}`,
      )

      return record
    })
  }

  // 分页查询后台会员套餐配置。
  async getMembershipPlanPage(dto: QueryMembershipPlanDto) {
    const conditions: SQL[] = []
    if (dto.tier !== undefined) {
      conditions.push(eq(this.membershipPlan.tier, dto.tier))
    }
    if (dto.isEnabled !== undefined) {
      conditions.push(eq(this.membershipPlan.isEnabled, dto.isEnabled))
    }
    const page = await this.drizzle.ext.findPagination(this.membershipPlan, {
      ...dto,
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: dto.orderBy ?? JSON.stringify({ sortOrder: 'asc', id: 'asc' }),
    })
    return {
      ...page,
      list: await this.withMembershipPlanBenefits(page.list),
    }
  }

  // 创建会员套餐并同步写入套餐权益关联。
  async createMembershipPlan(dto: CreateMembershipPlanDto) {
    const { benefits, ...data } = dto
    const normalizedBenefits = benefits ?? []
    this.assertMembershipPlanBenefitIdsDistinct(normalizedBenefits)
    await this.drizzle.withErrorHandling(
      async () =>
        this.drizzle.withTransaction(async (tx) => {
          const [plan] = await tx
            .insert(this.membershipPlan)
            .values(this.normalizeMembershipPlanCreate(data))
            .returning({ id: this.membershipPlan.id })

          await this.replaceMembershipPlanBenefits(
            tx,
            plan.id,
            normalizedBenefits,
            false,
          )
        }),
      { duplicate: 'VIP 套餐生成业务键冲突，请重试' },
    )
    return true
  }

  // 更新会员套餐基础信息和可选权益关联。
  async updateMembershipPlan(dto: UpdateMembershipPlanDto) {
    const { id, benefits, ...data } = dto
    const normalizedBenefits = benefits ?? []
    this.assertMembershipPlanBenefitIdsDistinct(normalizedBenefits)
    const existing = await this.db.query.membershipPlan.findFirst({
      where: { id },
    })
    if (!existing) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        'VIP 套餐不存在',
      )
    }
    await this.drizzle.withErrorHandling(
      async () =>
        this.drizzle.withTransaction(async (tx) => {
          await tx
            .update(this.membershipPlan)
            .set(this.normalizeMembershipPlanUpdate(data, existing))
            .where(eq(this.membershipPlan.id, id))

          await this.replaceMembershipPlanBenefits(tx, id, normalizedBenefits)
        }),
      { notFound: 'VIP 套餐不存在' },
    )
    return true
  }

  // 启用或停用会员套餐。
  async updateMembershipPlanStatus(id: number, isEnabled: boolean) {
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.membershipPlan)
          .set({ isEnabled })
          .where(eq(this.membershipPlan.id, id)),
      { notFound: 'VIP 套餐不存在' },
    )
    return true
  }

  // 分页查询会员权益定义。
  async getMembershipBenefitDefinitionPage(
    dto: QueryMembershipBenefitDefinitionDto,
  ) {
    const conditions: SQL[] = []
    if (dto.benefitType !== undefined) {
      conditions.push(
        eq(this.membershipBenefitDefinition.benefitType, dto.benefitType),
      )
    }
    if (dto.isEnabled !== undefined) {
      conditions.push(
        eq(this.membershipBenefitDefinition.isEnabled, dto.isEnabled),
      )
    }
    return this.drizzle.ext.findPagination(this.membershipBenefitDefinition, {
      ...dto,
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: dto.orderBy ?? JSON.stringify({ sortOrder: 'asc', id: 'asc' }),
    })
  }

  // 创建会员权益定义。
  async createMembershipBenefitDefinition(
    dto: CreateMembershipBenefitDefinitionDto,
  ) {
    await this.drizzle.withErrorHandling(
      () =>
        this.db.insert(this.membershipBenefitDefinition).values({
          ...dto,
          code: this.generateBusinessKey('vip_benefit', dto.name, 80),
        }),
      { duplicate: '会员权益生成业务键冲突，请重试' },
    )
    return true
  }

  // 更新会员权益定义。
  async updateMembershipBenefitDefinition(
    dto: UpdateMembershipBenefitDefinitionDto,
  ) {
    const { id, ...data } = dto
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.membershipBenefitDefinition)
          .set(data)
          .where(eq(this.membershipBenefitDefinition.id, id)),
      { notFound: '会员权益不存在' },
    )
    return true
  }

  // 启用或停用会员权益定义。
  async updateMembershipBenefitDefinitionStatus(
    id: number,
    isEnabled: boolean,
  ) {
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.membershipBenefitDefinition)
          .set({ isEnabled })
          .where(eq(this.membershipBenefitDefinition.id, id)),
      { notFound: '会员权益不存在' },
    )
    return true
  }

  // 分页查询会员订阅页配置。
  async getMembershipPageConfigPage(dto: QueryMembershipPageConfigDto) {
    const conditions: SQL[] = []
    if (dto.pageKey !== undefined) {
      conditions.push(eq(this.membershipPageConfig.pageKey, dto.pageKey))
    }
    if (dto.isEnabled !== undefined) {
      conditions.push(eq(this.membershipPageConfig.isEnabled, dto.isEnabled))
    }
    const page = await this.drizzle.ext.findPagination(
      this.membershipPageConfig,
      {
        ...dto,
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: dto.orderBy ?? JSON.stringify({ sortOrder: 'asc', id: 'asc' }),
      },
    )
    return {
      ...page,
      list: await this.withPageAgreements(page.list),
    }
  }

  // 创建会员订阅页配置并写入协议关联。
  async createMembershipPageConfig(dto: CreateMembershipPageConfigDto) {
    const { agreementIds, ...data } = dto
    await this.drizzle.withErrorHandling(
      async () =>
        this.drizzle.withTransaction(async (tx) => {
          const normalizedAgreementIds =
            await this.assertMembershipAgreementIdsWritable(tx, agreementIds)
          if ((data.isEnabled ?? true) && normalizedAgreementIds.length === 0) {
            throw new BusinessException(
              BusinessErrorCode.OPERATION_NOT_ALLOWED,
              '启用的会员订阅页必须关联至少一个已发布协议',
            )
          }
          const [pageConfig] = await tx
            .insert(this.membershipPageConfig)
            .values({
              ...data,
              pageKey: this.generateBusinessKey('vip_page', data.title, 80),
            })
            .returning({ id: this.membershipPageConfig.id })
          await this.replaceMembershipPageConfigAgreements(
            tx,
            pageConfig.id,
            normalizedAgreementIds,
          )
        }),
      { duplicate: '会员订阅页配置生成业务键冲突，请重试' },
    )
    return true
  }

  // 更新会员订阅页配置和可选协议关联。
  async updateMembershipPageConfig(dto: UpdateMembershipPageConfigDto) {
    const { id, agreementIds, ...data } = dto
    const existing = await this.db.query.membershipPageConfig.findFirst({
      where: { id },
    })
    if (!existing) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '会员订阅页配置不存在',
      )
    }
    await this.drizzle.withErrorHandling(
      async () =>
        this.drizzle.withTransaction(async (tx) => {
          const normalizedAgreementIds =
            agreementIds === undefined
              ? undefined
              : await this.assertMembershipAgreementIdsWritable(
                  tx,
                  agreementIds,
                )
          const nextEnabled = data.isEnabled ?? existing.isEnabled
          if (nextEnabled) {
            if (normalizedAgreementIds !== undefined) {
              this.assertMembershipAgreementCount(normalizedAgreementIds)
            } else {
              await this.assertMembershipPageConfigHasPublishedAgreements(id)
            }
          }
          await tx
            .update(this.membershipPageConfig)
            .set(data)
            .where(eq(this.membershipPageConfig.id, id))
          if (normalizedAgreementIds !== undefined) {
            await this.replaceMembershipPageConfigAgreements(
              tx,
              id,
              normalizedAgreementIds,
            )
          }
        }),
      {
        notFound: '会员订阅页配置不存在',
      },
    )
    return true
  }

  // 启用或停用会员订阅页配置。
  async updateMembershipPageConfigStatus(id: number, isEnabled: boolean) {
    if (isEnabled) {
      await this.assertMembershipPageConfigHasPublishedAgreements(id)
    }
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.membershipPageConfig)
          .set({ isEnabled })
          .where(eq(this.membershipPageConfig.id, id)),
      { notFound: '会员订阅页配置不存在' },
    )
    return true
  }

  // 分页查询会员自动续费协议事实。
  async getMembershipAutoRenewAgreementPage(
    dto: QueryMembershipAutoRenewAgreementDto,
  ) {
    const conditions: SQL[] = []
    if (dto.userId !== undefined) {
      conditions.push(eq(this.membershipAutoRenewAgreement.userId, dto.userId))
    }
    if (dto.planId !== undefined) {
      conditions.push(eq(this.membershipAutoRenewAgreement.planId, dto.planId))
    }
    if (dto.channel !== undefined) {
      conditions.push(
        eq(this.membershipAutoRenewAgreement.channel, dto.channel),
      )
    }
    if (dto.paymentScene !== undefined) {
      conditions.push(
        eq(this.membershipAutoRenewAgreement.paymentScene, dto.paymentScene),
      )
    }
    if (dto.status !== undefined) {
      conditions.push(eq(this.membershipAutoRenewAgreement.status, dto.status))
    }
    return this.drizzle.ext.findPagination(this.membershipAutoRenewAgreement, {
      ...dto,
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: dto.orderBy ?? JSON.stringify({ createdAt: 'desc', id: 'desc' }),
    })
  }

  // 取消生效中的会员自动续费协议。
  async cancelMembershipAutoRenewAgreement(id: number) {
    const agreement =
      await this.db.query.membershipAutoRenewAgreement.findFirst({
        where: { id },
      })
    if (!agreement) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        'VIP 自动续费协议不存在',
      )
    }
    if (agreement.status !== MembershipAutoRenewAgreementStatusEnum.ACTIVE) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '只有生效中的自动续费协议可以取消',
      )
    }

    await this.db
      .update(this.membershipAutoRenewAgreement)
      .set({
        status: MembershipAutoRenewAgreementStatusEnum.CANCELLED,
        cancelledAt: new Date(),
      })
      .where(eq(this.membershipAutoRenewAgreement.id, id))
    return true
  }

  // 分页查询后台虚拟币充值包配置。
  async getCurrencyPackagePage(dto: QueryCurrencyPackageDto) {
    const conditions: SQL[] = []
    if (dto.isEnabled !== undefined) {
      conditions.push(eq(this.currencyPackage.isEnabled, dto.isEnabled))
    }
    return this.drizzle.ext.findPagination(this.currencyPackage, {
      ...dto,
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: dto.orderBy ?? JSON.stringify({ sortOrder: 'asc', id: 'asc' }),
    })
  }

  // 创建虚拟币充值包。
  async createCurrencyPackage(dto: CreateCurrencyPackageDto) {
    await this.drizzle.withErrorHandling(
      () => this.db.insert(this.currencyPackage).values(dto),
      { duplicate: '充值包业务键已存在' },
    )
    return true
  }

  // 更新虚拟币充值包。
  async updateCurrencyPackage(dto: UpdateCurrencyPackageDto) {
    const { id, ...data } = dto
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.currencyPackage)
          .set(data)
          .where(eq(this.currencyPackage.id, id)),
      { notFound: '充值包不存在', duplicate: '充值包业务键已存在' },
    )
    return true
  }

  // 启用或停用虚拟币充值包。
  async updateCurrencyPackageStatus(id: number, isEnabled: boolean) {
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.currencyPackage)
          .set({ isEnabled })
          .where(eq(this.currencyPackage.id, id)),
      { notFound: '充值包不存在' },
    )
    return true
  }

  // 分页查询券定义。
  async getCouponDefinitionPage(dto: QueryCouponDefinitionDto) {
    const conditions: SQL[] = []
    if (dto.couponType !== undefined) {
      conditions.push(eq(this.couponDefinition.couponType, dto.couponType))
    }
    if (dto.targetScope !== undefined) {
      conditions.push(eq(this.couponDefinition.targetScope, dto.targetScope))
    }
    if (dto.isEnabled !== undefined) {
      conditions.push(eq(this.couponDefinition.isEnabled, dto.isEnabled))
    }
    return this.drizzle.ext.findPagination(this.couponDefinition, {
      ...dto,
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: dto.orderBy ?? JSON.stringify({ id: 'desc' }),
    })
  }

  // 创建券定义。
  async createCouponDefinition(dto: CreateCouponDefinitionDto) {
    await this.drizzle.withErrorHandling(() =>
      this.db.insert(this.couponDefinition).values(dto),
    )
    return true
  }

  // 更新券定义。
  async updateCouponDefinition(dto: UpdateCouponDefinitionDto) {
    const { id, ...data } = dto
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.couponDefinition)
          .set(data)
          .where(eq(this.couponDefinition.id, id)),
      { notFound: '券定义不存在' },
    )
    return true
  }

  // 启用或停用券定义。
  async updateCouponDefinitionStatus(id: number, isEnabled: boolean) {
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.couponDefinition)
          .set({ isEnabled })
          .where(eq(this.couponDefinition.id, id)),
      { notFound: '券定义不存在' },
    )
    return true
  }

  // 向用户发放指定券定义的券实例。
  async grantCoupon(dto: GrantCouponDto) {
    const definition = await this.db.query.couponDefinition.findFirst({
      where: { id: dto.couponDefinitionId, isEnabled: true },
    })
    if (!definition) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '券定义不存在或未启用',
      )
    }
    const expiresAt =
      definition.validDays > 0
        ? this.addDays(new Date(), definition.validDays)
        : null

    await this.drizzle.withErrorHandling(() =>
      this.db.insert(this.userCouponInstance).values({
        userId: dto.userId,
        couponDefinitionId: definition.id,
        couponType: definition.couponType,
        status: CouponInstanceStatusEnum.AVAILABLE,
        remainingUses: definition.usageLimit,
        sourceType: dto.sourceType,
        sourceId: dto.sourceId,
        expiresAt,
        grantSnapshot: {
          couponName: definition.name,
          couponType: definition.couponType,
          targetScope: definition.targetScope,
        },
      }),
    )
    return true
  }

  // 分页查询支付 provider 配置。
  async getPaymentProviderConfigPage(dto: QueryPaymentProviderConfigDto) {
    const conditions = this.buildPaymentProviderConfigConditions(dto)
    return this.drizzle.ext.findPagination(this.paymentProviderConfig, {
      ...dto,
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: dto.orderBy ?? JSON.stringify({ sortOrder: 'asc', id: 'asc' }),
    })
  }

  // 创建支付 provider 配置。
  async createPaymentProviderConfig(dto: CreatePaymentProviderConfigDto) {
    await this.drizzle.withErrorHandling(
      () =>
        this.db.insert(this.paymentProviderConfig).values({
          ...dto,
          clientAppKey: this.normalizeKey(dto.clientAppKey),
          appId: this.normalizeKey(dto.appId),
          mchId: this.normalizeKey(dto.mchId),
        }),
      { duplicate: '支付 provider 启用配置已存在' },
    )
    return true
  }

  // 更新支付 provider 配置并推进配置版本。
  async updatePaymentProviderConfig(dto: UpdatePaymentProviderConfigDto) {
    const { id, ...data } = dto
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.paymentProviderConfig)
          .set({
            ...data,
            clientAppKey:
              data.clientAppKey === undefined
                ? undefined
                : this.normalizeKey(data.clientAppKey),
            appId:
              data.appId === undefined
                ? undefined
                : this.normalizeKey(data.appId),
            mchId:
              data.mchId === undefined
                ? undefined
                : this.normalizeKey(data.mchId),
          })
          .where(eq(this.paymentProviderConfig.id, id)),
      {
        notFound: '支付 provider 配置不存在',
        duplicate: '支付 provider 启用配置已存在',
      },
    )
    return true
  }

  // 启用或停用支付 provider 配置。
  async updatePaymentProviderStatus(id: number, isEnabled: boolean) {
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.paymentProviderConfig)
          .set({ isEnabled })
          .where(eq(this.paymentProviderConfig.id, id)),
      {
        notFound: '支付 provider 配置不存在',
        duplicate: '支付 provider 启用配置已存在',
      },
    )
    return true
  }

  // 分页查询广告 provider 配置。
  async getAdProviderConfigPage(dto: QueryAdProviderConfigDto) {
    const conditions: SQL[] = []
    if (dto.provider !== undefined) {
      conditions.push(eq(this.adProviderConfig.provider, dto.provider))
    }
    if (dto.platform !== undefined) {
      conditions.push(eq(this.adProviderConfig.platform, dto.platform))
    }
    if (dto.environment !== undefined) {
      conditions.push(eq(this.adProviderConfig.environment, dto.environment))
    }
    if (dto.clientAppKey !== undefined) {
      conditions.push(
        eq(
          this.adProviderConfig.clientAppKey,
          this.normalizeKey(dto.clientAppKey),
        ),
      )
    }
    if (dto.placementKey !== undefined) {
      conditions.push(eq(this.adProviderConfig.placementKey, dto.placementKey))
    }
    if (dto.isEnabled !== undefined) {
      conditions.push(eq(this.adProviderConfig.isEnabled, dto.isEnabled))
    }
    return this.drizzle.ext.findPagination(this.adProviderConfig, {
      ...dto,
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: dto.orderBy ?? JSON.stringify({ sortOrder: 'asc', id: 'asc' }),
    })
  }

  // 创建广告 provider 配置。
  async createAdProviderConfig(dto: CreateAdProviderConfigDto) {
    await this.drizzle.withErrorHandling(
      () =>
        this.db.insert(this.adProviderConfig).values({
          ...dto,
          clientAppKey: this.normalizeKey(dto.clientAppKey),
          appId: this.normalizeKey(dto.appId),
        }),
      { duplicate: '广告 provider 启用配置已存在' },
    )
    return true
  }

  // 更新广告 provider 配置并推进配置版本。
  async updateAdProviderConfig(dto: UpdateAdProviderConfigDto) {
    const { id, ...data } = dto
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.adProviderConfig)
          .set({
            ...data,
            clientAppKey:
              data.clientAppKey === undefined
                ? undefined
                : this.normalizeKey(data.clientAppKey),
            appId:
              data.appId === undefined
                ? undefined
                : this.normalizeKey(data.appId),
          })
          .where(eq(this.adProviderConfig.id, id)),
      {
        notFound: '广告 provider 配置不存在',
        duplicate: '广告 provider 启用配置已存在',
      },
    )
    return true
  }

  // 启用或停用广告 provider 配置。
  async updateAdProviderStatus(id: number, isEnabled: boolean) {
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.adProviderConfig)
          .set({ isEnabled })
          .where(eq(this.adProviderConfig.id, id)),
      {
        notFound: '广告 provider 配置不存在',
        duplicate: '广告 provider 启用配置已存在',
      },
    )
    return true
  }

  // 分页查询支付订单。
  async getPaymentOrderPage(dto: QueryPaymentOrderDto) {
    const conditions: SQL[] = []
    if (dto.orderType !== undefined) {
      conditions.push(eq(this.paymentOrder.orderType, dto.orderType))
    }
    if (dto.status !== undefined) {
      conditions.push(eq(this.paymentOrder.status, dto.status))
    }
    return this.drizzle.ext.findPagination(this.paymentOrder, {
      ...dto,
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: dto.orderBy ?? JSON.stringify({ createdAt: 'desc', id: 'desc' }),
    })
  }

  // 创建支付订单并在同一事务中写入客户端支付参数，避免半成品 pending 订单。
  private async createPaymentOrder(
    userId: number,
    input: CreatePaymentOrderInput,
  ) {
    this.assertPaymentSceneContext(input)
    const config = await this.resolvePaymentProviderConfig(input)
    const subscriptionMode =
      input.subscriptionMode ?? PaymentSubscriptionModeEnum.ONE_TIME
    if (
      input.orderType !== PaymentOrderTypeEnum.VIP_SUBSCRIPTION &&
      subscriptionMode !== PaymentSubscriptionModeEnum.ONE_TIME
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '非 VIP 订单不支持订阅模式',
      )
    }
    if (
      subscriptionMode !== PaymentSubscriptionModeEnum.ONE_TIME &&
      !config.supportsAutoRenew
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '当前支付配置不支持自动续费',
      )
    }
    const orderNo = this.generateOrderNo()
    const clientAppKey = this.normalizeKey(input.clientAppKey)
    const clientContext = {
      platform: input.platform,
      environment: input.environment,
      clientAppKey,
      appId: this.normalizeKey(input.appId),
      mchId: this.normalizeKey(input.mchId),
      openId: input.openId,
      terminalIp: input.terminalIp,
      returnUrl: input.returnUrl,
      targetSnapshot: input.targetSnapshot,
    }

    return this.drizzle.withTransaction(async (tx) => {
      const [order] = await tx
        .insert(this.paymentOrder)
        .values({
          orderNo,
          userId,
          orderType: input.orderType,
          channel: input.channel,
          paymentScene: input.paymentScene,
          platform: input.platform,
          environment: input.environment,
          clientAppKey,
          subscriptionMode,
          status: PaymentOrderStatusEnum.PENDING,
          payableAmount: input.payableAmount,
          targetId: input.targetId,
          providerConfigId: config.id,
          providerConfigVersion: config.configVersion,
          credentialVersionRef: config.credentialVersionRef,
          configSnapshot: this.buildProviderConfigSnapshot(config),
          clientContext,
        })
        .returning()

      const adapter = this.getPaymentAdapter(input.channel)
      const clientPayPayload = adapter.createOrder({
        order,
        config,
        sceneContext: input,
      })
      const updatedRows = await tx
        .update(this.paymentOrder)
        .set({ clientPayPayload })
        .where(eq(this.paymentOrder.id, order.id))
        .returning({ id: this.paymentOrder.id })
      if (!updatedRows[0]) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_NOT_FOUND,
          '支付订单不存在',
        )
      }
      return this.toPaymentOrderResult(order, clientPayPayload)
    })
  }

  // 结算已支付订单的资产、订阅和签约事实，自动续费必须传入已验签协议号。
  private async settlePaidOrder(
    tx: MonetizationTx,
    order: PaymentOrderSelect,
    agreementNo?: string,
  ) {
    if (order.orderType === PaymentOrderTypeEnum.CURRENCY_RECHARGE) {
      const [pack] = await tx
        .select()
        .from(this.currencyPackage)
        .where(eq(this.currencyPackage.id, order.targetId))
        .limit(1)
      if (!pack) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_NOT_FOUND,
          '充值包不存在',
        )
      }
      const grantAmount = pack.currencyAmount + pack.bonusAmount
      const result = await this.growthLedgerService.applyDelta(tx, {
        userId: order.userId,
        assetType: GrowthAssetTypeEnum.CURRENCY,
        assetKey: READING_COIN_ASSET_KEY,
        action: GrowthLedgerActionEnum.GRANT,
        amount: grantAmount,
        bizKey: `payment:${order.id}:currency`,
        source: 'payment_order',
        targetType: order.orderType,
        targetId: order.targetId,
        context: {
          orderNo: order.orderNo,
          providerTradeNo: order.providerTradeNo,
          currencyAmount: pack.currencyAmount,
          bonusAmount: pack.bonusAmount,
        },
      })
      if (!result.success && !result.duplicated) {
        throw new BusinessException(
          BusinessErrorCode.STATE_CONFLICT,
          '虚拟币发放失败',
        )
      }
      return
    }

    const plan = await tx.query.membershipPlan.findFirst({
      where: { id: order.targetId },
    })
    if (!plan) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        'VIP 套餐不存在',
      )
    }
    const autoRenewAgreementNo =
      order.subscriptionMode === PaymentSubscriptionModeEnum.AUTO_RENEW_SIGNING
        ? this.requireAutoRenewAgreementNo(agreementNo)
        : undefined
    const now = new Date()
    const active = await tx.query.userMembershipSubscription.findFirst({
      where: {
        userId: order.userId,
        status: MembershipSubscriptionStatusEnum.ACTIVE,
      },
      orderBy: { endsAt: 'desc' },
    })
    const startsAt = active && active.endsAt > now ? active.endsAt : now
    const [subscription] = await tx
      .insert(this.userMembershipSubscription)
      .values({
        userId: order.userId,
        planId: plan.id,
        sourceType: MembershipSubscriptionSourceTypeEnum.PAYMENT_ORDER,
        sourceId: order.id,
        status: MembershipSubscriptionStatusEnum.ACTIVE,
        startsAt,
        endsAt: this.addDays(startsAt, plan.durationDays),
        sourceSnapshot: {
          orderNo: order.orderNo,
          planKey: plan.planKey,
          tier: plan.tier,
          durationDays: plan.durationDays,
          paidAmount: order.paidAmount,
          bonusPointAmount: plan.bonusPointAmount,
        },
      })
      .returning()

    if (plan.bonusPointAmount > 0) {
      const result = await this.growthLedgerService.applyDelta(tx, {
        userId: order.userId,
        assetType: GrowthAssetTypeEnum.POINTS,
        assetKey: '',
        action: GrowthLedgerActionEnum.GRANT,
        amount: plan.bonusPointAmount,
        bizKey: `payment:${order.id}:vip_bonus_points`,
        source: 'membership_plan',
        targetType: order.orderType,
        targetId: plan.id,
        context: {
          orderNo: order.orderNo,
          planKey: plan.planKey,
          tier: plan.tier,
        },
      })
      if (!result.success && !result.duplicated) {
        throw new BusinessException(
          BusinessErrorCode.STATE_CONFLICT,
          'VIP 赠送积分发放失败',
        )
      }
    }

    if (autoRenewAgreementNo) {
      await this.writeAutoRenewAgreement(
        tx,
        order,
        plan,
        subscription,
        autoRenewAgreementNo,
      )
    }
  }

  // 自动续费签约首单支付成功后写入独立协议事实，后续取消只更新协议，不撤销当前订阅。
  private async writeAutoRenewAgreement(
    tx: MonetizationTx,
    order: PaymentOrderSelect,
    plan: MembershipPlanSelect,
    subscription: UserMembershipSubscriptionSelect,
    agreementNo: string,
  ) {
    await tx.insert(this.membershipAutoRenewAgreement).values({
      userId: order.userId,
      planId: plan.id,
      channel: order.channel,
      paymentScene: order.paymentScene,
      platform: order.platform,
      environment: order.environment,
      clientAppKey: order.clientAppKey,
      providerConfigId: order.providerConfigId,
      providerConfigVersion: order.providerConfigVersion,
      credentialVersionRef: order.credentialVersionRef,
      agreementNo,
      status: MembershipAutoRenewAgreementStatusEnum.ACTIVE,
      signedAt: order.paidAt ?? new Date(),
      nextRenewAt: subscription.endsAt,
      rawPayload: order.notifyPayload,
      agreementSnapshot: {
        orderNo: order.orderNo,
        subscriptionId: subscription.id,
        planKey: plan.planKey,
        tier: plan.tier,
        durationDays: plan.durationDays,
        agreements: this.getOrderMembershipAgreementSnapshots(order),
        configSnapshot: order.configSnapshot,
      },
    })
  }

  // 获取当前启用的会员订阅页配置。
  private async getEnabledMembershipPageConfig() {
    const [pageConfig] = await this.db
      .select()
      .from(this.membershipPageConfig)
      .where(eq(this.membershipPageConfig.isEnabled, true))
      .orderBy(
        asc(this.membershipPageConfig.sortOrder),
        asc(this.membershipPageConfig.id),
      )
      .limit(1)

    if (!pageConfig) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '会员订阅页配置不存在或未启用',
      )
    }

    return pageConfig
  }

  // 读取当前启用会员订阅页的已发布协议快照，供下单和自动续费事实冻结版本。
  private async resolveEnabledMembershipAgreementSnapshots() {
    const pageConfig = await this.getEnabledMembershipPageConfig()
    const agreements = await this.getMembershipPageAgreementItems(
      pageConfig.id,
      { publishedOnly: true },
    )
    if (agreements.length === 0) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '会员订阅页未关联已发布协议',
      )
    }
    return agreements.map((agreement) =>
      this.toMembershipAgreementSnapshot(agreement),
    )
  }

  // 校验启用中的会员订阅页至少存在一个已发布协议，避免用户无协议下单。
  private async assertMembershipPageConfigHasPublishedAgreements(
    pageConfigId: number,
  ) {
    const pageConfig = await this.db.query.membershipPageConfig.findFirst({
      where: { id: pageConfigId },
    })
    if (!pageConfig) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '会员订阅页配置不存在',
      )
    }
    const agreements = await this.getMembershipPageAgreementItems(
      pageConfigId,
      {
        publishedOnly: true,
      },
    )
    this.assertMembershipAgreementCount(agreements)
  }

  // 校验协议 ID 列表可写入会员订阅页配置，并保持输入顺序作为展示顺序。
  private async assertMembershipAgreementIdsWritable(
    tx: MonetizationTx,
    agreementIds?: number[] | null,
  ) {
    const normalizedAgreementIds = this.normalizeAgreementIds(agreementIds)
    if (normalizedAgreementIds.length === 0) {
      return normalizedAgreementIds
    }

    const agreements = await tx
      .select({
        id: this.appAgreement.id,
        isPublished: this.appAgreement.isPublished,
      })
      .from(this.appAgreement)
      .where(inArray(this.appAgreement.id, normalizedAgreementIds))

    const agreementById = new Map(
      agreements.map((agreement) => [agreement.id, agreement]),
    )
    const missingAgreementId = normalizedAgreementIds.find(
      (agreementId) => !agreementById.has(agreementId),
    )
    if (missingAgreementId !== undefined) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '关联协议不存在',
      )
    }
    if (agreements.some((agreement) => !agreement.isPublished)) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '会员订阅页只能关联已发布协议',
      )
    }

    return normalizedAgreementIds
  }

  // 将协议 ID 列表收窄为去重后的正整数列表，重复 ID 视为错误配置。
  private normalizeAgreementIds(agreementIds?: number[] | null) {
    if (!agreementIds) {
      return []
    }
    const normalizedAgreementIds = agreementIds.map((agreementId) =>
      Number(agreementId),
    )
    if (
      normalizedAgreementIds.some(
        (agreementId) => !this.isPositiveInteger(agreementId),
      )
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '关联协议 ID 必须是正整数',
      )
    }
    if (
      new Set(normalizedAgreementIds).size !== normalizedAgreementIds.length
    ) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '关联协议不能重复',
      )
    }
    return normalizedAgreementIds
  }

  // 替换会员订阅页协议关联，写入顺序即客户端展示顺序。
  private async replaceMembershipPageConfigAgreements(
    tx: MonetizationTx,
    pageConfigId: number,
    agreementIds: number[],
  ) {
    await tx
      .delete(this.membershipPageConfigAgreement)
      .where(eq(this.membershipPageConfigAgreement.pageConfigId, pageConfigId))
    if (agreementIds.length === 0) {
      return
    }
    await tx.insert(this.membershipPageConfigAgreement).values(
      agreementIds.map((agreementId, sortOrder) => ({
        pageConfigId,
        agreementId,
        sortOrder,
      })),
    )
  }

  // 按 pageConfigId 批量补全协议列表，admin 侧保留下线状态用于发现配置风险。
  private async withPageAgreements<TPageConfig extends PageConfigIdentity>(
    pageConfigs: TPageConfig[],
  ) {
    if (pageConfigs.length === 0) {
      return pageConfigs.map((pageConfig) => ({
        ...pageConfig,
        agreements: [],
      }))
    }
    const pageConfigIds = pageConfigs.map((pageConfig) => pageConfig.id)
    const agreements = await this.getMembershipPageAgreementItems(pageConfigIds)
    const agreementsByPageConfigId = new Map<number, typeof agreements>()
    for (const agreement of agreements) {
      const list = agreementsByPageConfigId.get(agreement.pageConfigId) ?? []
      list.push(agreement)
      agreementsByPageConfigId.set(agreement.pageConfigId, list)
    }
    return pageConfigs.map((pageConfig) => ({
      ...pageConfig,
      agreements: agreementsByPageConfigId.get(pageConfig.id) ?? [],
    }))
  }

  // 读取会员订阅页关联协议，app 侧可只保留已发布协议。
  private async getMembershipPageAgreementItems(
    pageConfigIds: number | number[],
    options: MembershipPageAgreementQueryOptions = {},
  ) {
    const ids = Array.isArray(pageConfigIds) ? pageConfigIds : [pageConfigIds]
    const conditions: SQL[] = [
      inArray(this.membershipPageConfigAgreement.pageConfigId, ids),
    ]
    if (options.publishedOnly) {
      conditions.push(eq(this.appAgreement.isPublished, true))
    }
    return this.db
      .select({
        pageConfigId: this.membershipPageConfigAgreement.pageConfigId,
        id: this.appAgreement.id,
        title: this.appAgreement.title,
        version: this.appAgreement.version,
        isForce: this.appAgreement.isForce,
        showInAuth: this.appAgreement.showInAuth,
        isPublished: this.appAgreement.isPublished,
        publishedAt: this.appAgreement.publishedAt,
        createdAt: this.appAgreement.createdAt,
        updatedAt: this.appAgreement.updatedAt,
      })
      .from(this.membershipPageConfigAgreement)
      .innerJoin(
        this.appAgreement,
        eq(
          this.appAgreement.id,
          this.membershipPageConfigAgreement.agreementId,
        ),
      )
      .where(and(...conditions))
      .orderBy(
        asc(this.membershipPageConfigAgreement.pageConfigId),
        asc(this.membershipPageConfigAgreement.sortOrder),
        asc(this.appAgreement.id),
      )
  }

  // 检查启用配置的协议数量，供创建、更新、启用和下单链路复用。
  private assertMembershipAgreementCount(agreements: unknown[]) {
    if (agreements.length > 0) {
      return
    }
    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      '会员订阅页必须关联至少一个已发布协议',
    )
  }

  // 从协议读取结果中提取订单和签约事实需要冻结的最小快照字段。
  private toMembershipAgreementSnapshot(
    agreement: MembershipAgreementSnapshot,
  ): MembershipAgreementSnapshot {
    return {
      id: agreement.id,
      title: agreement.title,
      version: agreement.version,
      isForce: agreement.isForce,
      publishedAt: agreement.publishedAt,
    }
  }

  // 从支付订单客户端上下文中取出下单时冻结的协议快照。
  private getOrderMembershipAgreementSnapshots(order: PaymentOrderSelect) {
    const clientContext = order.clientContext
    if (!clientContext || typeof clientContext !== 'object') {
      return []
    }
    const targetSnapshot = (clientContext as BenefitValueRecord).targetSnapshot
    if (
      !targetSnapshot ||
      typeof targetSnapshot !== 'object' ||
      Array.isArray(targetSnapshot)
    ) {
      return []
    }
    const agreements = (targetSnapshot as BenefitValueRecord).agreements
    return Array.isArray(agreements) ? agreements : []
  }

  // 在外部事务中核销券，并仅在首次核销时执行权益发放副作用。
  private async redeemCouponInTx(
    tx: MonetizationTx,
    dto: RedeemCouponCommandDto,
  ) {
    const coupon = await this.getCouponInstanceWithDefinition(tx, dto)
    if (coupon.couponType === CouponTypeEnum.DISCOUNT) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '折扣券只能在章节购买命令中使用',
      )
    }
    const readingTargetType =
      coupon.couponType === CouponTypeEnum.READING
        ? this.resolveContentEntitlementTargetType(dto.targetType)
        : undefined
    if (
      coupon.couponType === CouponTypeEnum.VIP_TRIAL &&
      dto.targetType !== CouponRedemptionTargetTypeEnum.VIP
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        'VIP 试用卡只能核销到 VIP',
      )
    }
    const bizKey =
      dto.bizKey ??
      `coupon:${dto.userId}:${dto.targetType}:${dto.targetId}:${dto.couponInstanceId}`
    const { redemption, created } = await this.consumeCouponAndWriteRedemption(
      tx,
      {
        ...dto,
        coupon,
        bizKey,
        redemptionSnapshot: {
          couponName: coupon.name,
          couponType: coupon.couponType,
          targetScope: coupon.targetScope,
        },
      },
    )

    if (!created) {
      return redemption
    }

    if (
      coupon.couponType === CouponTypeEnum.READING &&
      readingTargetType !== undefined
    ) {
      await this.contentEntitlementService.grantEntitlement(tx, {
        userId: dto.userId,
        targetType: readingTargetType,
        targetId: dto.targetId,
        grantSource: ContentEntitlementGrantSourceEnum.COUPON,
        sourceId: redemption.id,
        sourceKey: bizKey,
        expiresAt: coupon.expiresAt ?? this.addDays(new Date(), 30),
        grantSnapshot: {
          couponInstanceId: dto.couponInstanceId,
          couponDefinitionId: coupon.couponDefinitionId,
          redemptionRecordId: redemption.id,
        },
      })
    }

    if (coupon.couponType === CouponTypeEnum.VIP_TRIAL) {
      const now = new Date()
      await tx.insert(this.userMembershipSubscription).values({
        userId: dto.userId,
        sourceType: MembershipSubscriptionSourceTypeEnum.VIP_TRIAL_COUPON,
        sourceId: redemption.id,
        status: MembershipSubscriptionStatusEnum.ACTIVE,
        startsAt: now,
        endsAt: this.addDays(now, Math.max(1, coupon.validDays)),
        sourceSnapshot: {
          couponInstanceId: dto.couponInstanceId,
          couponDefinitionId: coupon.couponDefinitionId,
          redemptionRecordId: redemption.id,
        },
      })
    }

    return redemption
  }

  // 扣减券可用次数并写入幂等核销记录，返回 created 控制后续副作用。
  private async consumeCouponAndWriteRedemption(
    tx: MonetizationTx,
    input: ConsumeCouponRedemptionInput,
  ): Promise<ConsumeCouponRedemptionResult> {
    const existing = await tx.query.couponRedemptionRecord.findFirst({
      where: {
        userId: input.userId,
        bizKey: input.bizKey,
      },
    })
    if (existing) {
      return { redemption: existing, created: false }
    }

    const nextRemainingUses = input.coupon.remainingUses - 1
    const [updated] = await tx
      .update(this.userCouponInstance)
      .set({
        remainingUses: nextRemainingUses,
        status:
          nextRemainingUses > 0
            ? CouponInstanceStatusEnum.AVAILABLE
            : CouponInstanceStatusEnum.USED_UP,
      })
      .where(
        and(
          eq(this.userCouponInstance.id, input.couponInstanceId),
          eq(this.userCouponInstance.userId, input.userId),
          eq(
            this.userCouponInstance.status,
            CouponInstanceStatusEnum.AVAILABLE,
          ),
          gt(this.userCouponInstance.remainingUses, 0),
        ),
      )
      .returning({ id: this.userCouponInstance.id })

    if (!updated) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '券已被使用或状态已变化',
      )
    }

    const [redemption] = await tx
      .insert(this.couponRedemptionRecord)
      .values({
        userId: input.userId,
        couponInstanceId: input.couponInstanceId,
        couponType: input.coupon.couponType,
        targetType: input.targetType,
        targetId: input.targetId,
        status: CouponRedemptionStatusEnum.SUCCESS,
        bizKey: input.bizKey,
        redemptionSnapshot: input.redemptionSnapshot,
      })
      .returning()

    return { redemption, created: true }
  }

  // 查询可核销的用户券实例及其定义快照。
  private async getCouponInstanceWithDefinition(
    tx: MonetizationTx,
    input: CouponInstanceLookupInput,
  ) {
    const rows = await tx
      .select({
        id: this.userCouponInstance.id,
        userId: this.userCouponInstance.userId,
        couponDefinitionId: this.userCouponInstance.couponDefinitionId,
        couponType: this.userCouponInstance.couponType,
        status: this.userCouponInstance.status,
        remainingUses: this.userCouponInstance.remainingUses,
        expiresAt: this.userCouponInstance.expiresAt,
        name: this.couponDefinition.name,
        targetScope: this.couponDefinition.targetScope,
        discountAmount: this.couponDefinition.discountAmount,
        discountRateBps: this.couponDefinition.discountRateBps,
        validDays: this.couponDefinition.validDays,
      })
      .from(this.userCouponInstance)
      .innerJoin(
        this.couponDefinition,
        eq(
          this.couponDefinition.id,
          this.userCouponInstance.couponDefinitionId,
        ),
      )
      .where(
        and(
          eq(this.userCouponInstance.id, input.couponInstanceId),
          eq(this.userCouponInstance.userId, input.userId),
          eq(
            this.userCouponInstance.status,
            CouponInstanceStatusEnum.AVAILABLE,
          ),
          gt(this.userCouponInstance.remainingUses, 0),
          eq(this.couponDefinition.isEnabled, true),
        ),
      )
      .limit(1)

    const coupon = rows[0]
    if (!coupon) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '可用券不存在',
      )
    }
    if (coupon.expiresAt && coupon.expiresAt <= new Date()) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '券已过期',
      )
    }
    return coupon
  }

  // 按客户端场景解析唯一可用的支付 provider 配置。
  private async resolvePaymentProviderConfig(input: CreatePaymentOrderBaseDto) {
    const candidates = await this.db
      .select()
      .from(this.paymentProviderConfig)
      .where(
        and(
          eq(this.paymentProviderConfig.channel, input.channel),
          eq(this.paymentProviderConfig.paymentScene, input.paymentScene),
          eq(this.paymentProviderConfig.platform, input.platform),
          eq(this.paymentProviderConfig.environment, input.environment),
          eq(
            this.paymentProviderConfig.clientAppKey,
            this.normalizeKey(input.clientAppKey),
          ),
          eq(this.paymentProviderConfig.appId, this.normalizeKey(input.appId)),
          eq(this.paymentProviderConfig.mchId, this.normalizeKey(input.mchId)),
          eq(this.paymentProviderConfig.isEnabled, true),
        ),
      )
      .orderBy(
        asc(this.paymentProviderConfig.sortOrder),
        asc(this.paymentProviderConfig.id),
      )
      .limit(2)

    if (candidates.length === 0) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '支付 provider 配置缺失或未启用',
      )
    }
    if (candidates.length > 1) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '支付 provider 配置冲突',
      )
    }
    return candidates[0]
  }

  // 创建套餐时补齐默认层级、划线价、积分和自动续费字段，避免数据库 check 约束由默认值误触发。
  private normalizeMembershipPlanCreate(dto: CreateMembershipPlanDto) {
    const { benefits: _benefits, ...data } = dto
    return {
      ...data,
      planKey: this.generateBusinessKey('vip_plan', dto.name, 64),
      tier: dto.tier ?? MembershipPlanTierEnum.VIP,
      originalPriceAmount: Math.max(
        dto.originalPriceAmount ?? dto.priceAmount,
        dto.priceAmount,
      ),
      bonusPointAmount: dto.bonusPointAmount ?? 0,
      displayTag: this.normalizeKey(dto.displayTag),
      autoRenewEnabled: dto.autoRenewEnabled ?? false,
    }
  }

  // 更新套餐时用现有值补齐价格约束，保证 priceAmount 与 originalPriceAmount 始终同轮一致。
  private normalizeMembershipPlanUpdate(
    data: MembershipPlanUpdateData,
    existing: MembershipPlanSelect,
  ) {
    const { benefits: _benefits, ...planData } = data
    const nextPriceAmount = data.priceAmount ?? existing.priceAmount
    const nextOriginalPriceAmount = Math.max(
      data.originalPriceAmount ?? existing.originalPriceAmount,
      nextPriceAmount,
    )
    return {
      ...planData,
      displayTag:
        data.displayTag === undefined
          ? undefined
          : this.normalizeKey(data.displayTag),
      originalPriceAmount: nextOriginalPriceAmount,
    }
  }

  // 套餐表单以聚合方式提交完整权益列表，服务端按请求事实整体替换旧关联。
  private async replaceMembershipPlanBenefits(
    tx: MonetizationTx,
    planId: number,
    benefits: MembershipPlanBenefitInputDto[] = [],
    clearExisting = true,
  ) {
    const normalizedBenefits = benefits ?? []
    this.assertMembershipPlanBenefitIdsDistinct(normalizedBenefits)

    const values = normalizedBenefits.map((benefit, index) => ({
      planId,
      benefitId: benefit.benefitId,
      grantPolicy: benefit.grantPolicy,
      benefitValue: benefit.benefitValue ?? null,
      sortOrder: benefit.sortOrder ?? index,
      isEnabled: benefit.isEnabled ?? true,
    }))

    await Promise.all(
      values.map(async (value) =>
        this.assertMembershipPlanBenefitWritable(value, tx),
      ),
    )
    if (clearExisting) {
      await tx
        .delete(this.membershipPlanBenefit)
        .where(eq(this.membershipPlanBenefit.planId, planId))
    }

    if (values.length === 0) {
      return
    }

    await tx.insert(this.membershipPlanBenefit).values(values)
  }

  // 校验同一套餐提交的权益定义不能重复。
  private assertMembershipPlanBenefitIdsDistinct(
    benefits: MembershipPlanBenefitInputDto[],
  ) {
    const benefitIds = new Set<number>()
    for (const benefit of benefits) {
      if (benefitIds.has(benefit.benefitId)) {
        throw new BusinessException(
          BusinessErrorCode.STATE_CONFLICT,
          '套餐权益不能重复',
        )
      }
      benefitIds.add(benefit.benefitId)
    }
  }

  // 校验套餐权益配置的目标存在性和 benefitValue 闭集结构，防止 admin 用展示文案替代实际发放事实。
  private async assertMembershipPlanBenefitWritable(
    dto: MembershipPlanBenefitInputDto & { planId: number },
    runner: MonetizationTx = this.db,
  ) {
    const [plan, benefit] = await Promise.all([
      runner.query.membershipPlan.findFirst({ where: { id: dto.planId } }),
      runner.query.membershipBenefitDefinition.findFirst({
        where: { id: dto.benefitId },
      }),
    ])
    if (!plan) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        'VIP 套餐不存在',
      )
    }
    if (!benefit) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '会员权益不存在',
      )
    }

    const value = this.asBenefitValueRecord(dto.benefitValue)
    if (
      dto.grantPolicy !== MembershipBenefitGrantPolicyEnum.DISPLAY_ONLY &&
      !value
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '非展示权益必须配置 benefitValue',
      )
    }

    this.assertBenefitValueMatchesType(benefit.benefitType, value)
  }

  // 将开放 JSON 权益值收窄为普通对象，数组和基础类型都视为无效配置。
  private asBenefitValueRecord(value?: BenefitValueRecord | null) {
    if (!value || Array.isArray(value)) {
      return null
    }
    return value
  }

  // 按权益类型校验最小必要字段，具体发放链路再基于这些字段写入券、道具或权益事实。
  private assertBenefitValueMatchesType(
    benefitType: number,
    value: BenefitValueRecord | null,
  ) {
    if (benefitType === MembershipBenefitTypeEnum.DISPLAY) {
      this.assertDisplayBenefitValue(value)
      return
    }
    if (!value) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '权益配置值不能为空',
      )
    }
    if (
      benefitType === MembershipBenefitTypeEnum.COUPON_GRANT &&
      (!this.isPositiveInteger(value.couponDefinitionId) ||
        !this.isPositiveInteger(value.grantCount) ||
        !this.isNonNegativeInteger(value.validDays))
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '券发放权益必须配置 couponDefinitionId、grantCount、validDays',
      )
    }
    if (
      benefitType === MembershipBenefitTypeEnum.ITEM_GRANT &&
      (!this.isPositiveInteger(value.assetType) ||
        !this.isNonEmptyString(value.assetKey) ||
        !this.isPositiveInteger(value.grantCount) ||
        !this.isNonNegativeInteger(value.validDays))
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '道具权益必须配置 assetType、assetKey、grantCount、validDays',
      )
    }
    if (
      benefitType === MembershipBenefitTypeEnum.SUBSCRIPTION_ENTITLEMENT &&
      !this.isNonEmptyString(value.entitlementKey)
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '订阅权益必须配置 entitlementKey',
      )
    }
    if (
      benefitType === MembershipBenefitTypeEnum.NO_AD_POLICY &&
      (!this.isNonEmptyString(value.adScope) ||
        !this.isNonEmptyString(value.durationPolicy))
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '无广告权益必须配置 adScope、durationPolicy',
      )
    }
    if (
      benefitType === MembershipBenefitTypeEnum.EARLY_ACCESS_POLICY &&
      (!this.isNonEmptyString(value.contentScope) ||
        !this.isPositiveInteger(value.advanceHours))
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '优先看权益必须配置 contentScope、advanceHours',
      )
    }
  }

  // 展示型权益不能混入真实发放字段。
  private assertDisplayBenefitValue(value: BenefitValueRecord | null) {
    if (!value) {
      return
    }
    const actualEntitlementKeys = [
      'couponDefinitionId',
      'assetType',
      'assetKey',
      'grantCount',
      'validDays',
      'entitlementKey',
      'adScope',
      'durationPolicy',
      'contentScope',
      'advanceHours',
    ]
    if (actualEntitlementKeys.some((key) => key in value)) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '纯展示权益不能配置实际权益字段',
      )
    }
  }

  // 判断值是否为正整数。
  private isPositiveInteger(value: unknown) {
    return Number.isInteger(value) && Number(value) > 0
  }

  // 判断值是否为非负整数。
  private isNonNegativeInteger(value: unknown) {
    return Number.isInteger(value) && Number(value) >= 0
  }

  // 判断值是否为去空格后仍非空的字符串。
  private isNonEmptyString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0
  }

  // admin 套餐分页需要回显完整关联，包含已禁用但仍存在的配置项。
  private async withMembershipPlanBenefits(plans: MembershipPlanSelect[]) {
    if (plans.length === 0) {
      return []
    }

    const benefits = await this.getPlanBenefitItems(
      plans.map((plan) => plan.id),
      false,
    )
    const benefitMap = new Map<number, typeof benefits>()
    for (const benefit of benefits) {
      const items = benefitMap.get(benefit.planId) ?? []
      items.push(benefit)
      benefitMap.set(benefit.planId, items)
    }

    return plans.map((plan) => ({
      ...plan,
      benefits: benefitMap.get(plan.id) ?? [],
    }))
  }

  // 批量读取套餐权益展示项。
  private async getPlanBenefitItems(planIds: number[], enabledOnly: boolean) {
    const conditions: SQL[] = [
      inArray(this.membershipPlanBenefit.planId, planIds),
    ]
    if (enabledOnly) {
      conditions.push(eq(this.membershipPlanBenefit.isEnabled, true))
      conditions.push(eq(this.membershipBenefitDefinition.isEnabled, true))
    }

    return this.db
      .select({
        id: this.membershipPlanBenefit.id,
        planId: this.membershipPlanBenefit.planId,
        benefitId: this.membershipPlanBenefit.benefitId,
        grantPolicy: this.membershipPlanBenefit.grantPolicy,
        benefitValue: this.membershipPlanBenefit.benefitValue,
        sortOrder: this.membershipPlanBenefit.sortOrder,
        isEnabled: this.membershipPlanBenefit.isEnabled,
        createdAt: this.membershipPlanBenefit.createdAt,
        updatedAt: this.membershipPlanBenefit.updatedAt,
        benefit: {
          id: this.membershipBenefitDefinition.id,
          code: this.membershipBenefitDefinition.code,
          name: this.membershipBenefitDefinition.name,
          icon: this.membershipBenefitDefinition.icon,
          benefitType: this.membershipBenefitDefinition.benefitType,
          description: this.membershipBenefitDefinition.description,
          sortOrder: this.membershipBenefitDefinition.sortOrder,
          isEnabled: this.membershipBenefitDefinition.isEnabled,
          createdAt: this.membershipBenefitDefinition.createdAt,
          updatedAt: this.membershipBenefitDefinition.updatedAt,
        },
      })
      .from(this.membershipPlanBenefit)
      .innerJoin(
        this.membershipBenefitDefinition,
        eq(
          this.membershipBenefitDefinition.id,
          this.membershipPlanBenefit.benefitId,
        ),
      )
      .where(and(...conditions))
      .orderBy(
        asc(this.membershipPlanBenefit.planId),
        asc(this.membershipPlanBenefit.sortOrder),
        asc(this.membershipPlanBenefit.id),
      )
  }

  // 读取启用套餐的权益项并携带权益定义，供 app 订阅页复用。
  private async getEnabledPlanBenefitItems(planIds: number[]) {
    return this.getPlanBenefitItems(planIds, true)
  }

  // 汇总当前用户的有效订阅和自动续费状态，订阅页只消费这一份摘要。
  private async resolveMembershipSubscriptionSummary(userId: number) {
    const now = new Date()
    const [subscription] = await this.db
      .select({
        tier: this.membershipPlan.tier,
        expiresAt: this.userMembershipSubscription.endsAt,
      })
      .from(this.userMembershipSubscription)
      .innerJoin(
        this.membershipPlan,
        eq(this.membershipPlan.id, this.userMembershipSubscription.planId),
      )
      .where(
        and(
          eq(this.userMembershipSubscription.userId, userId),
          eq(
            this.userMembershipSubscription.status,
            MembershipSubscriptionStatusEnum.ACTIVE,
          ),
          gt(this.userMembershipSubscription.endsAt, now),
        ),
      )
      .orderBy(
        desc(this.membershipPlan.tier),
        desc(this.userMembershipSubscription.endsAt),
      )
      .limit(1)

    const [agreement] = await this.db
      .select({ id: this.membershipAutoRenewAgreement.id })
      .from(this.membershipAutoRenewAgreement)
      .where(
        and(
          eq(this.membershipAutoRenewAgreement.userId, userId),
          eq(
            this.membershipAutoRenewAgreement.status,
            MembershipAutoRenewAgreementStatusEnum.ACTIVE,
          ),
        ),
      )
      .limit(1)

    return {
      isActive: !!subscription,
      tier: subscription?.tier ?? null,
      expiresAt: subscription?.expiresAt ?? null,
      autoRenewActive: !!agreement,
    }
  }

  // 根据 ID 读取支付 provider 配置。
  private async getPaymentProviderConfigById(id: number) {
    const config = await this.db.query.paymentProviderConfig.findFirst({
      where: { id },
    })
    if (!config) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '支付 provider 配置不存在',
      )
    }
    return config
  }

  // 按广告奖励请求解析可用的广告 provider 配置。
  private async resolveAdProviderConfig(dto: AdRewardVerificationDto) {
    const candidates = await this.db
      .select()
      .from(this.adProviderConfig)
      .where(
        and(
          eq(this.adProviderConfig.provider, dto.provider),
          eq(this.adProviderConfig.platform, dto.platform),
          eq(this.adProviderConfig.environment, dto.environment),
          eq(
            this.adProviderConfig.clientAppKey,
            this.normalizeKey(dto.clientAppKey),
          ),
          eq(this.adProviderConfig.appId, this.normalizeKey(dto.appId)),
          eq(this.adProviderConfig.placementKey, dto.placementKey),
          eq(this.adProviderConfig.isEnabled, true),
        ),
      )
      .orderBy(
        asc(this.adProviderConfig.sortOrder),
        asc(this.adProviderConfig.id),
      )
      .limit(2)

    if (candidates.length === 0) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '广告 provider 配置缺失或未启用',
      )
    }
    if (candidates.length > 1) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '广告 provider 配置冲突',
      )
    }
    return candidates[0]
  }

  // 校验广告奖励目标当前需要广告解锁。
  private async assertAdTargetAllowed(dto: AdRewardVerificationDto) {
    const permission =
      await this.contentPermissionService.resolveChapterPermission(dto.targetId)
    if (permission.viewRule === WorkViewPermissionEnum.VIP) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '广告解锁不能用于 VIP 内容',
      )
    }
    if (
      permission.viewRule === WorkViewPermissionEnum.PURCHASE &&
      (permission.purchasePricing?.originalPrice ?? 0) > 100
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '广告解锁不能用于高价章节',
      )
    }
  }

  // 校验不同支付场景所需的客户端上下文字段。
  private assertPaymentSceneContext(input: CreatePaymentOrderBaseDto) {
    if (input.paymentScene === PaymentSceneEnum.H5 && !input.returnUrl) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        'H5 支付必须提供 returnUrl',
      )
    }
    if (input.paymentScene === PaymentSceneEnum.MINI_PROGRAM && !input.openId) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '小程序支付必须提供 openId',
      )
    }
  }

  // 将券和广告目标类型映射为内容权益目标类型。
  private resolveContentEntitlementTargetType(
    targetType: CouponRedemptionTargetTypeEnum,
  ) {
    if (targetType === CouponRedemptionTargetTypeEnum.COMIC_CHAPTER) {
      return ContentEntitlementTargetTypeEnum.COMIC_CHAPTER
    }
    if (targetType === CouponRedemptionTargetTypeEnum.NOVEL_CHAPTER) {
      return ContentEntitlementTargetTypeEnum.NOVEL_CHAPTER
    }
    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      '目标类型不支持内容权益',
    )
  }

  // 构建支付 provider 配置分页查询条件。
  private buildPaymentProviderConfigConditions(
    dto: QueryPaymentProviderConfigDto,
  ) {
    const conditions: SQL[] = []
    if (dto.channel !== undefined) {
      conditions.push(eq(this.paymentProviderConfig.channel, dto.channel))
    }
    if (dto.paymentScene !== undefined) {
      conditions.push(
        eq(this.paymentProviderConfig.paymentScene, dto.paymentScene),
      )
    }
    if (dto.platform !== undefined) {
      conditions.push(eq(this.paymentProviderConfig.platform, dto.platform))
    }
    if (dto.environment !== undefined) {
      conditions.push(
        eq(this.paymentProviderConfig.environment, dto.environment),
      )
    }
    if (dto.clientAppKey !== undefined) {
      conditions.push(
        eq(
          this.paymentProviderConfig.clientAppKey,
          this.normalizeKey(dto.clientAppKey),
        ),
      )
    }
    if (dto.isEnabled !== undefined) {
      conditions.push(eq(this.paymentProviderConfig.isEnabled, dto.isEnabled))
    }
    return conditions
  }

  // 构建不含明文密钥的 provider 配置快照。
  private buildProviderConfigSnapshot(config: PaymentProviderConfigSelect) {
    return {
      channel: config.channel,
      paymentScene: config.paymentScene,
      platform: config.platform,
      environment: config.environment,
      clientAppKey: config.clientAppKey,
      configName: config.configName,
      appId: config.appId,
      mchId: config.mchId,
      notifyUrl: config.notifyUrl,
      returnUrl: config.returnUrl,
      agreementNotifyUrl: config.agreementNotifyUrl,
      allowedReturnDomains: config.allowedReturnDomains,
      certMode: config.certMode,
      publicKeyRef: config.publicKeyRef,
      privateKeyRef: config.privateKeyRef,
      apiV3KeyRef: config.apiV3KeyRef,
      appCertRef: config.appCertRef,
      platformCertRef: config.platformCertRef,
      rootCertRef: config.rootCertRef,
      configVersion: config.configVersion,
      credentialVersionRef: config.credentialVersionRef,
      configMetadata: config.configMetadata,
      supportsAutoRenew: config.supportsAutoRenew,
    }
  }

  // 获取指定支付渠道的 provider 适配器。
  private getPaymentAdapter(channel: number) {
    const adapter = PAYMENT_PROVIDER_ADAPTERS.find(
      (candidate) => candidate.channel === channel,
    )
    if (!adapter) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '不支持的支付渠道',
      )
    }
    return adapter
  }

  // 获取指定广告 provider 的奖励适配器。
  private getAdRewardAdapter(provider: number) {
    const adapter = AD_REWARD_PROVIDER_ADAPTERS.find(
      (candidate) => candidate.provider === provider,
    )
    if (!adapter) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '不支持的广告 provider',
      )
    }
    return adapter
  }

  // 将支付订单行映射为 App 公开支付结果，禁止透出 provider 内部字段。
  private toPaymentOrderResult(
    order: PaymentOrderSelect,
    clientPayPayload: Record<string, unknown>,
  ): PaymentOrderPublicResult {
    return {
      orderNo: order.orderNo,
      orderType: order.orderType,
      status: order.status,
      subscriptionMode: order.subscriptionMode,
      payableAmount: order.payableAmount,
      clientPayPayload,
    }
  }

  // 自动续费签约订单必须携带 provider 已验签协议号，禁止本地合成协议身份。
  private requireAutoRenewAgreementNo(agreementNo?: string) {
    if (!agreementNo) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '自动续费回调缺少已验签协议号',
      )
    }
    return agreementNo
  }

  // 已支付幂等分支仍必须与本次已验签回调事实一致。
  private assertPaidOrderMatchesNotify(
    order: PaymentOrderSelect,
    paidAmount: number,
    providerTradeNo: string,
  ) {
    if (
      order.paidAmount !== paidAmount ||
      (order.providerTradeNo !== null &&
        order.providerTradeNo !== providerTradeNo)
    ) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '支付回调金额或交易号与已支付订单不一致',
      )
    }
  }

  // 标准化可选业务键，空值统一落为空字符串。
  private normalizeKey(input?: string | null) {
    return input?.trim() ?? ''
  }

  // 基于名称生成带前缀的稳定业务键。
  private generateBusinessKey(
    prefix: 'vip_benefit' | 'vip_page' | 'vip_plan',
    source: string,
    maxLength: number,
  ) {
    const suffix = randomUUID().replace(/-/g, '').slice(0, 8)
    const slug = this.normalizeBusinessKeySlug(source)
    const maxBaseLength = Math.max(prefix.length, maxLength - suffix.length - 1)
    const base = `${prefix}_${slug}`.slice(0, maxBaseLength).replace(/_+$/, '')
    return `${base}_${suffix}`
  }

  // 将任意名称收敛为业务键可用的 slug。
  private normalizeBusinessKeySlug(source: string) {
    const slug = source
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
    return slug || 'item'
  }

  // 生成站内支付订单号。
  private generateOrderNo() {
    const now = new Date()
    const timestamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0'),
      String(now.getMilliseconds()).padStart(3, '0'),
    ].join('')
    return `PAY${timestamp}${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0')}`
  }

  // 基于输入时间增加指定天数。
  private addDays(input: Date, days: number) {
    const output = new Date(input)
    output.setDate(output.getDate() + days)
    return output
  }
}
