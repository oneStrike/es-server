import type {
  MembershipPageConfigSelect,
  MembershipPlanSelect,
  PaymentOrderSelect,
  UserMembershipSubscriptionSelect,
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
import { DrizzleService } from '@db/core'
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
import {
  CreateMembershipBenefitDefinitionDto,
  CreateMembershipPageConfigDto,
  CreateMembershipPlanDto,
  CreateVipSubscriptionOrderDto,
  MembershipPlanBenefitInputDto,
  QueryMembershipAutoRenewAgreementDto,
  QueryMembershipBenefitDefinitionDto,
  QueryMembershipPageConfigDto,
  QueryMembershipPlanDto,
  QueryVipSubscriptionPageDto,
  UpdateMembershipBenefitDefinitionDto,
  UpdateMembershipPageConfigDto,
  UpdateMembershipPlanDto,
} from '../membership/dto/membership.dto'
import {
  MembershipAutoRenewAgreementStatusEnum,
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
  ) {}

  // 获取当前请求使用的 Drizzle 查询实例。
  private get db() {
    return this.drizzle.db
  }

  // 获取会员自动续费协议表定义。
  private get membershipAutoRenewAgreement() {
    return this.drizzle.schema.membershipAutoRenewAgreement
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
        autoRenewEnabled: this.membershipPlan.autoRenewEnabled,
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
    const page = await this.drizzle.ext.findPagination(
      this.membershipPageConfig,
      {
        ...dto,
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: dto.orderBy ?? JSON.stringify({ sortOrder: 'asc', id: 'asc' }),
      },
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
      agreements: agreementsByPageConfigId.get(pageConfig.id) ?? [],
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

  // 校验套餐权益配置的目标存在性和 benefitValue 闭集结构，防止 admin 用展示文案替代实际发放事实。
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

  // 判断值是否为去空格后仍非空的字符串。
  private isNonEmptyString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0
  }

  // 判断值是否为非负整数。
  private isNonNegativeInteger(value: unknown) {
    return Number.isInteger(value) && Number(value) >= 0
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

  // 读取当前启用会员订阅页的已发布协议快照，供下单和自动续费事实冻结版本。
  private async resolveEnabledMembershipAgreementSnapshots(
    pageConfig: MembershipPageConfigSelect,
  ) {
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
    const agreements = await this.getMembershipPageAgreementItems(
      pageConfig.id,
      { publishedOnly: true },
    )
    const plans = await this.getEnabledMembershipPlanListForPage(pageConfig.id)
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

  // 读取启用套餐的权益项并携带权益定义，供 app 订阅页复用。
  private async getEnabledPlanBenefitItems(planIds: number[]) {
    return this.getPlanBenefitItems(planIds, true)
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

  // 支付成功后开通会员订阅和可选自动续费协议。
  async activatePaidOrder(
    tx: MembershipTx,
    order: PaymentOrderSelect,
    agreementNo?: string,
  ) {
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
    tx: MembershipTx,
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

  // 基于输入时间增加指定天数。
  private addDays(input: Date, days: number) {
    const output = new Date(input)
    output.setDate(output.getDate() + days)
    return output
  }
}
