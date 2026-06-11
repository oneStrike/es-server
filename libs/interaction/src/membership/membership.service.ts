import type {
  MembershipPageConfigSelect,
  MembershipPlanSelect,
  PaymentOrderSelect,
} from '@db/schema'
import type { SQL } from 'drizzle-orm'
import type {
  BenefitValueRecord,
  MembershipAgreementSnapshot,
  MembershipPageAgreementQueryOptions,
  MembershipPlanUpdateData,
  MembershipTx,
  MembershipPageConfigIdentity as PageConfigIdentity,
} from '../membership/types/membership.type'
import { randomUUID } from 'node:crypto'
import { DrizzleService, toPageResult } from '@db/core'
import {
  MembershipSubscriptionSourceTypeEnum,
  MembershipSubscriptionStatusEnum,
} from '@libs/content/permission/content-entitlement.constant'
import {
  GrowthAssetTypeEnum,
  GrowthLedgerActionEnum,
} from '@libs/growth/growth-ledger/growth-ledger.constant'
import { GrowthLedgerService } from '@libs/growth/growth-ledger/growth-ledger.service'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable, Logger } from '@nestjs/common'
import { and, asc, desc, eq, gt, inArray, ne } from 'drizzle-orm'
import { CouponSourceTypeEnum } from '../coupon/coupon.constant'
import { CouponService } from '../coupon/coupon.service'
import {
  CreateMembershipBenefitDefinitionDto,
  CreateMembershipPageConfigDto,
  CreateMembershipPlanDto,
  CreateVipSubscriptionOrderDto,
  MembershipPlanBenefitInputDto,
  QueryMembershipBenefitDefinitionDto,
  QueryMembershipPageConfigDto,
  QueryMembershipPlanDto,
  QueryVipSubscriptionPageDto,
  UpdateMembershipBenefitDefinitionDto,
  UpdateMembershipPageConfigDto,
  UpdateMembershipPlanDto,
} from '../membership/dto/membership.dto'
import {
  MembershipBenefitGrantPolicyEnum,
  MembershipBenefitTypeEnum,
  MembershipPlanTierEnum,
} from '../membership/membership.constant'
import { PaymentOrderService } from '../payment/payment-order.service'
import {
  PaymentOrderTypeEnum,
  PaymentSubscriptionModeEnum,
} from '../payment/payment.constant'

@Injectable()
export class MembershipService {
  private readonly logger = new Logger(MembershipService.name)

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly growthLedgerService: GrowthLedgerService,
    private readonly paymentOrderService: PaymentOrderService,
    private readonly couponService: CouponService,
  ) {}

  // 获取当前请求使用的 Drizzle 查询实例。
  private get db() {
    return this.drizzle.db
  }

  // 获取会员订阅页配置表定义。
  private get membershipPageConfig() {
    return this.drizzle.schema.membershipPageConfig
  }

  // 获取会员订阅页套餐关联表定义。
  private get membershipPageConfigPlan() {
    return this.drizzle.schema.membershipPageConfigPlan
  }

  // 获取会员套餐表定义。
  private get membershipPlan() {
    return this.drizzle.schema.membershipPlan
  }

  // 获取会员订阅页协议关联表定义。
  private get membershipPageConfigAgreement() {
    return this.drizzle.schema.membershipPageConfigAgreement
  }

  // 获取应用协议表定义。
  private get appAgreement() {
    return this.drizzle.schema.appAgreement
  }

  // 获取会员权益定义表定义。
  private get membershipBenefitDefinition() {
    return this.drizzle.schema.membershipBenefitDefinition
  }

  // 获取会员套餐权益关联表定义。
  private get membershipPlanBenefit() {
    return this.drizzle.schema.membershipPlanBenefit
  }

  // 获取用户会员订阅事实表定义。
  private get userMembershipSubscription() {
    return this.drizzle.schema.userMembershipSubscription
  }

  // 启用或停用会员订阅页配置。
  async updateMembershipPageConfigStatus(id: number, isEnabled: boolean) {
    if (isEnabled) {
      await this.assertMembershipPageConfigHasPublishedAgreements(id)
      await this.assertMembershipPageConfigHasEnabledPlans(id)
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

  // 校验启用中的会员订阅页至少绑定一个启用套餐，避免展示页无可购套餐。
  private async assertMembershipPageConfigHasEnabledPlans(
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
    const plans = await this.getMembershipPagePlanItems(pageConfigId, true)
    this.assertMembershipPlanCount(plans)
  }

  // 检查启用配置的绑定套餐数量，供创建、更新和启用链路复用。
  private assertMembershipPlanCount(plans: unknown[]) {
    if (plans.length > 0) {
      return
    }
    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      '启用的会员订阅页必须绑定至少一个已启用套餐',
    )
  }

  // 读取会员订阅页绑定套餐，app 侧可只保留启用套餐。
  private async getMembershipPagePlanItems(
    pageConfigIds: number | number[],
    enabledOnly: boolean,
  ) {
    const ids = Array.isArray(pageConfigIds) ? pageConfigIds : [pageConfigIds]
    const conditions: SQL[] = [
      inArray(this.membershipPageConfigPlan.pageConfigId, ids),
    ]
    if (enabledOnly) {
      conditions.push(eq(this.membershipPlan.isEnabled, true))
    }

    return this.db
      .select({
        pageConfigId: this.membershipPageConfigPlan.pageConfigId,
        id: this.membershipPlan.id,
        name: this.membershipPlan.name,
        planKey: this.membershipPlan.planKey,
        tier: this.membershipPlan.tier,
        priceAmount: this.membershipPlan.priceAmount,
        originalPriceAmount: this.membershipPlan.originalPriceAmount,
        durationDays: this.membershipPlan.durationDays,
        displayTag: this.membershipPlan.displayTag,
        bonusPointAmount: this.membershipPlan.bonusPointAmount,
        sortOrder: this.membershipPageConfigPlan.sortOrder,
        isEnabled: this.membershipPlan.isEnabled,
        createdAt: this.membershipPlan.createdAt,
        updatedAt: this.membershipPlan.updatedAt,
      })
      .from(this.membershipPageConfigPlan)
      .innerJoin(
        this.membershipPlan,
        eq(this.membershipPlan.id, this.membershipPageConfigPlan.planId),
      )
      .where(and(...conditions))
      .orderBy(
        asc(this.membershipPageConfigPlan.pageConfigId),
        asc(this.membershipPageConfigPlan.sortOrder),
        asc(this.membershipPlan.tier),
        asc(this.membershipPlan.sortOrder),
        asc(this.membershipPlan.id),
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

  // 更新会员订阅页配置和可选协议、套餐关联。
  async updateMembershipPageConfig(dto: UpdateMembershipPageConfigDto) {
    const { id, agreementIds, planIds, ...data } = dto
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
          const normalizedPlanIds =
            planIds === undefined
              ? undefined
              : await this.assertMembershipPlanIdsWritable(tx, planIds)
          const nextEnabled = data.isEnabled ?? existing.isEnabled
          if (nextEnabled) {
            if (normalizedAgreementIds !== undefined) {
              this.assertMembershipAgreementCount(normalizedAgreementIds)
            } else {
              await this.assertMembershipPageConfigHasPublishedAgreements(id)
            }
            if (normalizedPlanIds !== undefined) {
              this.assertMembershipPlanCount(normalizedPlanIds)
            } else {
              await this.assertMembershipPageConfigHasEnabledPlans(id)
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
          if (normalizedPlanIds !== undefined) {
            await this.replaceMembershipPageConfigPlans(
              tx,
              id,
              normalizedPlanIds,
            )
          }
        }),
      {
        notFound: '会员订阅页配置不存在',
      },
    )
    return true
  }

  // 替换会员订阅页套餐关联，写入顺序即客户端展示顺序。
  private async replaceMembershipPageConfigPlans(
    tx: MembershipTx,
    pageConfigId: number,
    planIds: number[],
  ) {
    await tx
      .delete(this.membershipPageConfigPlan)
      .where(eq(this.membershipPageConfigPlan.pageConfigId, pageConfigId))
    if (planIds.length === 0) {
      return
    }
    await tx.insert(this.membershipPageConfigPlan).values(
      planIds.map((planId, sortOrder) => ({
        pageConfigId,
        planId,
        sortOrder,
      })),
    )
  }

  // 替换会员订阅页协议关联，写入顺序即客户端展示顺序。
  private async replaceMembershipPageConfigAgreements(
    tx: MembershipTx,
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

  // 校验套餐 ID 列表可写入会员订阅页配置，并保持输入顺序作为展示顺序。
  private async assertMembershipPlanIdsWritable(
    tx: MembershipTx,
    planIds?: number[] | null,
  ) {
    const normalizedPlanIds = this.normalizePlanIds(planIds)
    if (normalizedPlanIds.length === 0) {
      return normalizedPlanIds
    }

    const plans = await tx
      .select({
        id: this.membershipPlan.id,
        isEnabled: this.membershipPlan.isEnabled,
      })
      .from(this.membershipPlan)
      .where(inArray(this.membershipPlan.id, normalizedPlanIds))

    const planById = new Map(plans.map((plan) => [plan.id, plan]))
    const missingPlanId = normalizedPlanIds.find(
      (planId) => !planById.has(planId),
    )
    if (missingPlanId !== undefined) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '绑定套餐不存在',
      )
    }
    if (plans.some((plan) => !plan.isEnabled)) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '会员订阅页只能绑定已启用套餐',
      )
    }

    return normalizedPlanIds
  }

  // 将套餐 ID 列表收窄为去重后的正整数列表，重复 ID 视为错误配置。
  private normalizePlanIds(planIds?: number[] | null): number[] {
    if (!planIds) {
      return []
    }
    const normalizedPlanIds = planIds.map((planId) => Number(planId))
    if (normalizedPlanIds.some((planId) => !this.isPositiveInteger(planId))) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '绑定套餐 ID 必须是正整数',
      )
    }
    if (new Set(normalizedPlanIds).size !== normalizedPlanIds.length) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '绑定套餐不能重复',
      )
    }
    return normalizedPlanIds
  }

  // 判断值是否为正整数。
  private isPositiveInteger(value: unknown) {
    return Number.isInteger(value) && Number(value) > 0
  }

  // 校验协议 ID 列表可写入会员订阅页配置，并保持输入顺序作为展示顺序。
  private async assertMembershipAgreementIdsWritable(
    tx: MembershipTx,
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
  private normalizeAgreementIds(agreementIds?: number[] | null): number[] {
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

  // 创建会员订阅页配置并写入协议和套餐关联。
  async createMembershipPageConfig(dto: CreateMembershipPageConfigDto) {
    const { agreementIds, planIds, ...data } = dto
    await this.drizzle.withErrorHandling(
      async () =>
        this.drizzle.withTransaction(async (tx) => {
          const normalizedAgreementIds =
            await this.assertMembershipAgreementIdsWritable(tx, agreementIds)
          const normalizedPlanIds = await this.assertMembershipPlanIdsWritable(
            tx,
            planIds,
          )
          if ((data.isEnabled ?? true) && normalizedAgreementIds.length === 0) {
            throw new BusinessException(
              BusinessErrorCode.OPERATION_NOT_ALLOWED,
              '启用的会员订阅页必须关联至少一个已发布协议',
            )
          }
          if ((data.isEnabled ?? true) && normalizedPlanIds.length === 0) {
            throw new BusinessException(
              BusinessErrorCode.OPERATION_NOT_ALLOWED,
              '启用的会员订阅页必须绑定至少一个已启用套餐',
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
          await this.replaceMembershipPageConfigPlans(
            tx,
            pageConfig.id,
            normalizedPlanIds,
          )
        }),
      { duplicate: '会员订阅页配置生成业务键冲突，请重试' },
    )
    return true
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

  // 分页查询会员订阅页配置。
  async getMembershipPageConfigPage(dto: QueryMembershipPageConfigDto) {
    const conditions: SQL[] = []
    if (dto.pageKey !== undefined) {
      conditions.push(eq(this.membershipPageConfig.pageKey, dto.pageKey))
    }
    if (dto.isEnabled !== undefined) {
      conditions.push(eq(this.membershipPageConfig.isEnabled, dto.isEnabled))
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined
    const pageQuery = this.drizzle.buildPage(dto)
    const orderQuery = this.drizzle.buildOrderBy(
      dto.orderBy ?? { sortOrder: 'asc' as const, id: 'asc' as const },
      { table: this.membershipPageConfig },
    )
    const [list, total] = await Promise.all([
      this.db
        .select()
        .from(this.membershipPageConfig)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(pageQuery.limit)
        .offset(pageQuery.offset),
      this.db.$count(this.membershipPageConfig, where),
    ])
    const page = toPageResult(
      list.map((item) => this.toMembershipPageConfigOutput(item)),
      total,
      pageQuery,
    )
    const listWithAgreements = await this.withPageAgreements(page.list)
    return {
      ...page,
      list: await this.withPagePlans(listWithAgreements),
    }
  }

  // 按 pageConfigId 批量补全绑定套餐列表，admin 侧保留完整配置用于发现配置风险。
  private async withPagePlans<TPageConfig extends PageConfigIdentity>(
    pageConfigs: TPageConfig[],
  ) {
    if (pageConfigs.length === 0) {
      return pageConfigs.map((pageConfig) => ({
        ...pageConfig,
        plans: [],
      }))
    }
    const pageConfigIds = pageConfigs.map((pageConfig) => pageConfig.id)
    const plans = await this.getMembershipPagePlanItems(pageConfigIds, false)
    const plansByPageConfigId = new Map<number, typeof plans>()
    for (const plan of plans) {
      const list = plansByPageConfigId.get(plan.pageConfigId) ?? []
      list.push(plan)
      plansByPageConfigId.set(plan.pageConfigId, list)
    }
    return pageConfigs.map((pageConfig) => ({
      ...pageConfig,
      plans: (plansByPageConfigId.get(pageConfig.id) ?? []).map(
        ({ pageConfigId: _pageConfigId, ...plan }) => plan,
      ),
    }))
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
      agreements: (agreementsByPageConfigId.get(pageConfig.id) ?? []).map(
        (agreement) => this.toAgreementListItemOutput(agreement),
      ),
    }))
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

  // 更新会员权益定义。
  async updateMembershipBenefitDefinition(
    dto: UpdateMembershipBenefitDefinitionDto,
  ) {
    const { id, ...data } = dto
    if (data.benefitType === undefined) {
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
    this.assertSupportedBenefitType(data.benefitType)
    await this.drizzle.withErrorHandling(
      async () =>
        this.drizzle.withTransaction(async (tx) => {
          const existing = await tx.query.membershipBenefitDefinition.findFirst({
            where: { id },
          })
          if (!existing) {
            throw new BusinessException(
              BusinessErrorCode.RESOURCE_NOT_FOUND,
              '会员权益不存在',
            )
          }

          if (
            data.benefitType !== undefined &&
            data.benefitType !== existing.benefitType
          ) {
            await this.assertBenefitTypeChangeKeepsPlanBenefitsValid(
              tx,
              id,
              data.benefitType,
            )
          }

          await tx
            .update(this.membershipBenefitDefinition)
            .set(data)
            .where(eq(this.membershipBenefitDefinition.id, id))
        }),
      { notFound: '会员权益不存在' },
    )
    return true
  }

  // 创建会员权益定义。
  async createMembershipBenefitDefinition(
    dto: CreateMembershipBenefitDefinitionDto,
  ) {
    this.assertSupportedBenefitType(dto.benefitType)
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
    const where = conditions.length > 0 ? and(...conditions) : undefined
    const page = this.drizzle.buildPage(dto)
    const orderQuery = this.drizzle.buildOrderBy(
      dto.orderBy ?? { sortOrder: 'asc' as const, id: 'asc' as const },
      { table: this.membershipBenefitDefinition },
    )
    const [list, total] = await Promise.all([
      this.db
        .select()
        .from(this.membershipBenefitDefinition)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(page.limit)
        .offset(page.offset),
      this.db.$count(this.membershipBenefitDefinition, where),
    ])
    return toPageResult(list, total, page)
  }

  // 启用或停用会员套餐。
  async updateMembershipPlanStatus(id: number, isEnabled: boolean) {
    await this.drizzle.withErrorHandling(
      async () =>
        this.drizzle.withTransaction(async (tx) => {
          const existing = await tx.query.membershipPlan.findFirst({
            where: { id },
          })
          if (!existing) {
            throw new BusinessException(
              BusinessErrorCode.RESOURCE_NOT_FOUND,
              'VIP 套餐不存在',
            )
          }
          if (!isEnabled && existing.isEnabled) {
            await this.assertMembershipPlanDisableKeepsEnabledPagesPurchasable(
              tx,
              id,
            )
          }
          await tx
            .update(this.membershipPlan)
            .set({ isEnabled })
            .where(eq(this.membershipPlan.id, id))
        }),
      { notFound: 'VIP 套餐不存在' },
    )
    return true
  }

  // 禁用套餐前校验启用中的订阅页不会失去最后一个可购套餐。
  private async assertMembershipPlanDisableKeepsEnabledPagesPurchasable(
    tx: MembershipTx,
    planId: number,
  ) {
    const affectedPages = await tx
      .select({
        pageConfigId: this.membershipPageConfigPlan.pageConfigId,
      })
      .from(this.membershipPageConfigPlan)
      .innerJoin(
        this.membershipPageConfig,
        eq(
          this.membershipPageConfig.id,
          this.membershipPageConfigPlan.pageConfigId,
        ),
      )
      .where(
        and(
          eq(this.membershipPageConfigPlan.planId, planId),
          eq(this.membershipPageConfig.isEnabled, true),
        ),
      )

    const affectedPageConfigIds = [
      ...new Set(affectedPages.map((page) => page.pageConfigId)),
    ]
    if (affectedPageConfigIds.length === 0) {
      return
    }

    const remainingEnabledPlanLinks = await tx
      .select({
        pageConfigId: this.membershipPageConfigPlan.pageConfigId,
      })
      .from(this.membershipPageConfigPlan)
      .innerJoin(
        this.membershipPlan,
        eq(this.membershipPlan.id, this.membershipPageConfigPlan.planId),
      )
      .where(
        and(
          inArray(
            this.membershipPageConfigPlan.pageConfigId,
            affectedPageConfigIds,
          ),
          eq(this.membershipPlan.isEnabled, true),
          ne(this.membershipPlan.id, planId),
        ),
      )

    const pageConfigIdsWithRemainingPlan = new Set(
      remainingEnabledPlanLinks.map((link) => link.pageConfigId),
    )
    if (
      affectedPageConfigIds.some(
        (pageConfigId) => !pageConfigIdsWithRemainingPlan.has(pageConfigId),
      )
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '禁用该 VIP 套餐会导致启用中的会员订阅页无可用套餐，请先调整订阅页绑定或停用订阅页',
      )
    }
  }

  // 更新会员套餐基础信息和可选权益关联。
  async updateMembershipPlan(dto: UpdateMembershipPlanDto) {
    const { id, benefits, ...data } = dto
    if (benefits !== undefined) {
      this.assertMembershipPlanBenefitIdsDistinct(benefits)
    }
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

          if (benefits !== undefined) {
            await this.replaceMembershipPlanBenefits(tx, id, benefits)
          }
        }),
      { notFound: 'VIP 套餐不存在' },
    )
    return true
  }

  // 套餐表单以聚合方式提交完整权益列表，服务端按请求事实整体替换旧关联。
  private async replaceMembershipPlanBenefits(
    tx: MembershipTx,
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

  // 校验套餐权益配置的目标存在性和 v1 权益矩阵，防止 admin 配置服务端无法兑现的付费承诺。
  private async assertMembershipPlanBenefitWritable(
    dto: MembershipPlanBenefitInputDto & { planId: number },
    runner: MembershipTx = this.db,
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
    this.assertMembershipBenefitContract(
      benefit.benefitType,
      dto.grantPolicy,
      value,
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
    )
    if (benefit.benefitType === MembershipBenefitTypeEnum.COUPON_GRANT) {
      const couponDefinition = await runner.query.couponDefinition.findFirst({
        where: {
          id: Number(value?.couponDefinitionId),
          isEnabled: true,
        },
      })
      if (!couponDefinition) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_NOT_FOUND,
          '券发放权益关联的券定义不存在或未启用',
        )
      }
    }
  }

  // v1 会员权益只支持展示信息和开通自动发券，其他付费承诺必须等独立权益引擎再引入。
  private assertMembershipBenefitContract(
    benefitType: number,
    grantPolicy: number,
    value: BenefitValueRecord | null,
    errorCode: number = BusinessErrorCode.OPERATION_NOT_ALLOWED,
  ) {
    if (
      benefitType === MembershipBenefitTypeEnum.DISPLAY &&
      grantPolicy === MembershipBenefitGrantPolicyEnum.DISPLAY_ONLY
    ) {
      this.assertDisplayBenefitValue(value)
      return
    }
    if (
      benefitType === MembershipBenefitTypeEnum.COUPON_GRANT &&
      grantPolicy === MembershipBenefitGrantPolicyEnum.AUTO_GRANT_ON_SUBSCRIBE
    ) {
      this.assertCouponGrantBenefitValue(value, errorCode)
      return
    }

    throw new BusinessException(
      errorCode,
      '会员权益仅支持纯展示+仅展示、券发放+开通时自动发放',
    )
  }

  // 判断值为正整数或未填写，供可选有效期覆盖使用。
  private isPositiveIntegerOrEmpty(value: unknown) {
    return value === undefined || value === null || this.isPositiveInteger(value)
  }

  // 将开放权益配置字段收窄为正整数，便于发放链路只处理已校验事实。
  private readPositiveInteger(value: unknown, label: string) {
    if (!this.isPositiveInteger(value)) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        `${label}必须是正整数`,
      )
    }
    return Number(value)
  }

  // 读取可选有效期覆盖；未填写时保留券定义默认有效期。
  private readOptionalPositiveInteger(value: unknown, label: string) {
    if (value === undefined || value === null) {
      return undefined
    }
    return this.readPositiveInteger(value, label)
  }

  private assertSupportedBenefitType(benefitType: number) {
    if (
      benefitType === MembershipBenefitTypeEnum.DISPLAY ||
      benefitType === MembershipBenefitTypeEnum.COUPON_GRANT
    ) {
      return
    }

    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      '会员权益类型仅支持纯展示和券发放',
    )
  }

  private async assertBenefitTypeChangeKeepsPlanBenefitsValid(
    tx: MembershipTx,
    benefitId: number,
    nextBenefitType: number,
  ) {
    const linkedPlanBenefits = await tx
      .select({
        grantPolicy: this.membershipPlanBenefit.grantPolicy,
        benefitValue: this.membershipPlanBenefit.benefitValue,
      })
      .from(this.membershipPlanBenefit)
      .where(eq(this.membershipPlanBenefit.benefitId, benefitId))

    for (const linkedPlanBenefit of linkedPlanBenefits) {
      const value = this.asBenefitValueRecord(
        linkedPlanBenefit.benefitValue as BenefitValueRecord | null,
      )
      this.assertMembershipBenefitContract(
        nextBenefitType,
        linkedPlanBenefit.grantPolicy,
        value,
      )
      if (nextBenefitType === MembershipBenefitTypeEnum.COUPON_GRANT) {
        const couponDefinition = await tx.query.couponDefinition.findFirst({
          where: {
            id: Number(value?.couponDefinitionId),
            isEnabled: true,
          },
        })
        if (!couponDefinition) {
          throw new BusinessException(
            BusinessErrorCode.RESOURCE_NOT_FOUND,
            '券发放权益关联的券定义不存在或未启用',
          )
        }
      }
    }
  }

  // 校验开通自动发券需要的最小事实，validDays 留空时使用券定义默认有效期。
  private assertCouponGrantBenefitValue(
    value: BenefitValueRecord | null,
    errorCode: number,
  ) {
    if (
      !value ||
      !this.isPositiveInteger(value.couponDefinitionId) ||
      !this.isPositiveInteger(value.grantCount) ||
      !this.isPositiveIntegerOrEmpty(value.validDays)
    ) {
      throw new BusinessException(
        errorCode,
        '券发放权益必须配置 couponDefinitionId、grantCount；validDays 留空或配置正整数',
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

  // 将开放 JSON 权益值收窄为普通对象，数组和基础类型都视为无效配置。
  private asBenefitValueRecord(value?: BenefitValueRecord | null) {
    if (!value || Array.isArray(value)) {
      return null
    }
    return value
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

  // 标准化可选业务键，空值统一落为空字符串。
  private normalizeKey(input?: string | null) {
    return input?.trim() ?? ''
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

  // 创建套餐时补齐默认层级、划线价和积分，避免数据库 check 约束由默认值误触发。
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
    }
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
    const where = conditions.length > 0 ? and(...conditions) : undefined
    const pageQuery = this.drizzle.buildPage(dto)
    const orderQuery = this.drizzle.buildOrderBy(
      dto.orderBy ?? { sortOrder: 'asc' as const, id: 'asc' as const },
      { table: this.membershipPlan },
    )
    const [list, total] = await Promise.all([
      this.db
        .select()
        .from(this.membershipPlan)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(pageQuery.limit)
        .offset(pageQuery.offset),
      this.db.$count(this.membershipPlan, where),
    ])
    const page = toPageResult(list, total, pageQuery)
    return {
      ...page,
      list: await this.withMembershipPlanBenefits(page.list),
    }
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
  private async getPlanBenefitItems(
    planIds: number[],
    enabledOnly: boolean,
    runner: MembershipTx = this.db,
  ) {
    const conditions: SQL[] = [
      inArray(this.membershipPlanBenefit.planId, planIds),
    ]
    if (enabledOnly) {
      conditions.push(eq(this.membershipPlanBenefit.isEnabled, true))
      conditions.push(eq(this.membershipBenefitDefinition.isEnabled, true))
    }

    const rows = await runner
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

    return rows.map((row) => ({
      ...row,
      benefitValue: this.asBenefitValueRecord(
        row.benefitValue as BenefitValueRecord | null | undefined,
      ),
    }))
  }

  // 创建 VIP 订阅支付订单，并冻结下单时的购买上下文。
  async createVipSubscriptionOrder(
    userId: number,
    dto: CreateVipSubscriptionOrderDto,
  ) {
    const subscriptionMode =
      dto.subscriptionMode ?? PaymentSubscriptionModeEnum.ONE_TIME
    if (subscriptionMode !== PaymentSubscriptionModeEnum.ONE_TIME) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        'VIP 下单只支持一次性订阅',
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
    const pageConfig = await this.getEnabledMembershipPageConfig(dto.pageKey)
    await this.assertMembershipPageConfigPlanBound(pageConfig.id, plan.id)
    const agreements =
      await this.resolveEnabledMembershipAgreementSnapshots(pageConfig)

    return this.paymentOrderService.createPaymentOrder(userId, {
      ...dto,
      subscriptionMode,
      orderType: PaymentOrderTypeEnum.VIP_SUBSCRIPTION,
      targetId: plan.id,
      payableAmount: plan.priceAmount,
      targetSnapshot: {
        pageKey: pageConfig.pageKey,
        planKey: plan.planKey,
        tier: plan.tier,
        durationDays: plan.durationDays,
        bonusPointAmount: plan.bonusPointAmount,
        agreements,
      },
    })
  }

  // 读取当前启用会员订阅页的已发布协议快照，供下单冻结版本。
  private async resolveEnabledMembershipAgreementSnapshots(
    pageConfig: MembershipPageConfigSelect,
  ) {
    const agreements = (
      await this.getMembershipPageAgreementItems(pageConfig.id, {
        publishedOnly: true,
      })
    ).map((agreement) => this.toAgreementListItemOutput(agreement))
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

  // 从协议读取结果中提取订单需要冻结的最小快照字段。
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

  // 校验 App 下单套餐属于当前订阅页展示范围。
  private async assertMembershipPageConfigPlanBound(
    pageConfigId: number,
    planId: number,
  ) {
    const [link] = await this.db
      .select({ planId: this.membershipPageConfigPlan.planId })
      .from(this.membershipPageConfigPlan)
      .innerJoin(
        this.membershipPlan,
        eq(this.membershipPlan.id, this.membershipPageConfigPlan.planId),
      )
      .where(
        and(
          eq(this.membershipPageConfigPlan.pageConfigId, pageConfigId),
          eq(this.membershipPageConfigPlan.planId, planId),
          eq(this.membershipPlan.isEnabled, true),
        ),
      )
      .limit(1)

    if (!link) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '当前 VIP 套餐未绑定到会员订阅页',
      )
    }
  }

  // 获取当前启用的会员订阅页配置；未指定 pageKey 时按排序取默认页。
  private async getEnabledMembershipPageConfig(pageKey?: string) {
    const conditions: SQL[] = [eq(this.membershipPageConfig.isEnabled, true)]
    if (pageKey) {
      conditions.push(eq(this.membershipPageConfig.pageKey, pageKey))
    }
    const [pageConfig] = await this.db
      .select()
      .from(this.membershipPageConfig)
      .where(and(...conditions))
      .orderBy(
        asc(this.membershipPageConfig.sortOrder),
        asc(this.membershipPageConfig.id),
      )
      .limit(1)

    if (!pageConfig) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        pageKey
          ? '会员订阅页配置不存在或未启用'
          : '默认会员订阅页配置不存在或未启用',
      )
    }

    return pageConfig
  }

  // 聚合订阅页所需的套餐、权益、法务文案和当前用户订阅摘要，避免客户端硬编码截图页字段。
  async getVipSubscriptionPage(
    userId: number,
    dto: QueryVipSubscriptionPageDto = {},
  ) {
    const pageConfig = await this.getEnabledMembershipPageConfig(dto.pageKey)
    const agreements = (
      await this.getMembershipPageAgreementItems(pageConfig.id, {
        publishedOnly: true,
      })
    ).map((agreement) => this.toAgreementListItemOutput(agreement))
    const plans = await this.getEnabledMembershipPlanListForPage(pageConfig.id)
    const planIds = plans.map((plan) => plan.id)
    const benefits =
      planIds.length > 0 ? await this.getEnabledPlanBenefitItems(planIds) : []
    const currentSubscription =
      await this.resolveMembershipSubscriptionSummary(userId)

    const outputPageConfig = this.toMembershipPageConfigOutput(pageConfig)
    return {
      pageConfig: {
        ...outputPageConfig,
        agreements,
        plans,
      },
      plans,
      benefits,
      currentSubscription,
    }
  }

  // 汇总当前用户的有效订阅状态，订阅页只消费这一份摘要。
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

    return {
      isActive: !!subscription,
      tier: subscription?.tier ?? null,
      expiresAt: subscription?.expiresAt ?? null,
    }
  }

  // 读取启用套餐的权益项并携带权益定义，供 app 订阅页复用。
  private async getEnabledPlanBenefitItems(
    planIds: number[],
    runner: MembershipTx = this.db,
  ) {
    return this.getPlanBenefitItems(planIds, true, runner)
  }

  // 读取当前订阅页绑定且启用的套餐列表，供 app 订阅页展示。
  private async getEnabledMembershipPlanListForPage(pageConfigId: number) {
    const plans = await this.getMembershipPagePlanItems(pageConfigId, true)
    if (plans.length === 0) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '会员订阅页未绑定启用套餐',
      )
    }
    return plans.map(({ pageConfigId: _pageConfigId, ...plan }) => plan)
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

  // 支付成功后开通会员订阅。
  async activatePaidOrder(tx: MembershipTx, order: PaymentOrderSelect) {
    const plan = await tx.query.membershipPlan.findFirst({
      where: { id: order.targetId },
    })
    if (!plan) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        'VIP 套餐不存在',
      )
    }

    const now = new Date()
    const active = await tx.query.userMembershipSubscription.findFirst({
      where: {
        userId: order.userId,
        status: MembershipSubscriptionStatusEnum.ACTIVE,
      },
      orderBy: { endsAt: 'desc' },
    })
    const startsAt = active && active.endsAt > now ? active.endsAt : now
    await tx
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
    await this.grantAutoCouponBenefits(tx, order, plan.id)
  }

  // 会员支付开通后自动发放套餐配置的券权益，grantKey 保证支付回调重试不重复发券。
  private async grantAutoCouponBenefits(
    tx: MembershipTx,
    order: PaymentOrderSelect,
    planId: number,
  ) {
    const benefits = await this.getEnabledPlanBenefitItems([planId], tx)
    for (const benefit of benefits) {
      const value = this.asBenefitValueRecord(
        benefit.benefitValue as BenefitValueRecord | null | undefined,
      )
      this.assertMembershipBenefitContract(
        benefit.benefit.benefitType,
        benefit.grantPolicy,
        value,
        BusinessErrorCode.STATE_CONFLICT,
      )
      if (benefit.benefit.benefitType === MembershipBenefitTypeEnum.DISPLAY) {
        continue
      }

      const couponDefinitionId = this.readPositiveInteger(
        value?.couponDefinitionId,
        '券定义 ID',
      )
      const quantity = this.readPositiveInteger(value?.grantCount, '发券数量')
      const validDays = this.readOptionalPositiveInteger(
        value?.validDays,
        '发券有效天数',
      )
      const grantKeys = Array.from(
        { length: quantity },
        (_item, index) =>
          `membership:order:${order.id}:benefit:${benefit.id}:coupon:${couponDefinitionId}:index:${index}`,
      )

      await this.couponService.grantCouponsForSource(tx, {
        userId: order.userId,
        couponDefinitionId,
        sourceType: CouponSourceTypeEnum.MEMBERSHIP_BENEFIT,
        sourceId: order.id,
        quantity,
        ...(validDays === undefined ? {} : { validDays }),
        grantKeys,
      })
    }
  }

  // 基于输入时间增加指定天数。
  private addDays(input: Date, days: number) {
    const output = new Date(input)
    output.setDate(output.getDate() + days)
    return output
  }

  private toMembershipPageConfigOutput(config: MembershipPageConfigSelect) {
    return {
      ...config,
      memberNoticeItems: Array.isArray(config.memberNoticeItems)
        ? config.memberNoticeItems.map(String)
        : null,
    }
  }

  private toAgreementListItemOutput<
    TAgreement extends {
      pageConfigId?: number
      publishedAt?: Date | null
    },
  >(agreement: TAgreement) {
    const { pageConfigId: _pageConfigId, publishedAt, ...output } = agreement
    return {
      ...output,
      publishedAt: publishedAt ?? null,
    }
  }
}
