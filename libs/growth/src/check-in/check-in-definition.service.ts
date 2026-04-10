import type { IdDto } from '@libs/platform/dto/base.dto'
import type { Db } from '@db/core'
import type {
  CreateCheckInPlanDto,
  CreateCheckInPlanRewardConfigDto,
  QueryCheckInPlanDto,
  UpdateCheckInPlanDto,
  UpdateCheckInPlanRewardConfigDto,
  UpdateCheckInPlanStatusDto,
} from './dto/check-in-definition.dto'
import { buildILikeCondition, DrizzleService } from '@db/core'
import { GrowthLedgerService } from '@libs/growth/growth-ledger/growth-ledger.service'
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, eq, gte, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm'
import {
  CheckInPlanStatusEnum,
  CheckInRewardStatusEnum,
} from './check-in.constant'
import { CheckInServiceSupport } from './check-in.service.support'

const CHECK_IN_PLAN_MUTATION_LOCK_KEY = 1_048_101

/**
 * 签到定义服务。
 *
 * 负责任务模板式的配置层能力，包括计划创建、更新、状态流转与后台读模型。
 */
@Injectable()
export class CheckInDefinitionService extends CheckInServiceSupport {
  constructor(
    drizzle: DrizzleService,
    growthLedgerService: GrowthLedgerService,
  ) {
    super(drizzle, growthLedgerService)
  }

  /**
   * 分页读取签到计划列表，并补齐规则数、活跃周期数和待补偿奖励数摘要。
   */
  async getPlanPage(query: QueryCheckInPlanDto) {
    const conditions = [
      isNull(this.checkInPlanTable.deletedAt),
      buildILikeCondition(this.checkInPlanTable.planCode, query.planCode),
      buildILikeCondition(this.checkInPlanTable.planName, query.planName),
    ]
    if (query.status !== undefined) {
      conditions.push(eq(this.checkInPlanTable.status, query.status))
    }

    const page = await this.drizzle.ext.findPagination(this.checkInPlanTable, {
      where: and(...conditions),
      ...query,
      orderBy: query.orderBy?.trim()
        ? query.orderBy
        : { updatedAt: 'desc', id: 'desc' },
    })

    const summaries = await Promise.all(
      page.list.map(async (plan) =>
        this.buildPlanSummary(
          plan.id,
          this.getPlanRewardDefinition(plan, { allowEmpty: true }),
        ),
      ),
    )

    return {
      ...page,
      list: page.list.map((plan, index) => {
        const rewardDefinition = this.getPlanRewardDefinition(plan, {
          allowEmpty: true,
        })
        const { rewardDefinition: _rewardDefinition, ...rest } = plan
        return {
          ...rest,
          baseRewardConfig: rewardDefinition?.baseRewardConfig ?? null,
          status: this.resolvePlanStatus(plan),
          ...summaries[index],
        }
      }),
    }
  }

  /** 读取单个签到计划详情及当前奖励定义。 */
  async getPlanDetail(query: IdDto) {
    const plan = await this.getPlanById(query.id)
    const rewardDefinition = this.getPlanRewardDefinition(plan, {
      allowEmpty: true,
    })
    const summary = await this.buildPlanSummary(plan.id, rewardDefinition)
    const { rewardDefinition: _rewardDefinition, ...rest } = plan

    return {
      ...rest,
      baseRewardConfig: rewardDefinition?.baseRewardConfig ?? null,
      status: this.resolvePlanStatus(plan),
      ...summary,
      dateRewardRules: (rewardDefinition?.dateRewardRules ?? []).map((rule) =>
        this.toDateRewardRuleView(rule),
      ),
      patternRewardRules: (rewardDefinition?.patternRewardRules ?? []).map(
        (rule) => this.toPatternRewardRuleView(rule),
      ),
      streakRewardRules: (rewardDefinition?.streakRewardRules ?? []).map((rule) =>
        this.toStreakRuleView(rule),
      ),
    }
  }

  /**
   * 创建签到计划。
   *
   * 会在写入前校验补签额度、计划起止日期以及“当前只允许一个生效计划”的运营约束。
   */
  async createPlan(dto: CreateCheckInPlanDto, adminUserId: number) {
    const cycleType = this.parseCycleType(dto.cycleType)
    const startDate = this.parseDateOnly(dto.startDate, '计划开始日期')
    const endDate = dto.endDate
      ? this.parseDateOnly(dto.endDate, '计划结束日期')
      : null
    const allowMakeupCountPerCycle = dto.allowMakeupCountPerCycle ?? 0
    if (
      !Number.isInteger(allowMakeupCountPerCycle) ||
      allowMakeupCountPerCycle < 0
    ) {
      throw new BadRequestException('每周期补签次数必须为非负整数')
    }
    this.ensurePlanDateRange(startDate, endDate)
    this.ensurePlanBoundaryAligned(cycleType, startDate, endDate)

    return this.drizzle.withTransaction(
      async (tx) => {
        await this.acquirePlanMutationLock(tx)

        if (dto.status === CheckInPlanStatusEnum.PUBLISHED) {
          const now = new Date()
          await this.assertPublishedPlanWindowAvailable(
            {
              startDate,
              endDate,
            },
            tx,
          )
          await this.assertNoImmediateSwitch(startDate, now, undefined, tx)
        }

        const [createdPlan] = await tx
          .insert(this.checkInPlanTable)
          .values({
            planCode: dto.planCode.trim(),
            planName: dto.planName.trim(),
            ...this.buildPlanStatusPersistence(dto.status),
            cycleType,
            startDate,
            endDate,
            allowMakeupCountPerCycle,
            rewardDefinition: null,
            createdById: adminUserId,
            updatedById: adminUserId,
          })
          .returning()

        return { id: createdPlan.id }
      },
      { duplicate: '签到计划编码已存在' },
    )
  }

  /** 创建计划奖励配置。 */
  async createPlanRewardConfig(
    dto: CreateCheckInPlanRewardConfigDto,
    adminUserId: number,
  ) {
    return this.applyPlanRewardConfig(dto, adminUserId, 'create')
  }

  /**
   * 更新签到计划。
   *
   * 基础字段直接覆盖当前计划；奖励定义继续沿用当前生效值。
   */
  async updatePlan(dto: UpdateCheckInPlanDto, adminUserId: number) {
    await this.drizzle.withTransaction(
      async (tx) => {
        await this.acquirePlanMutationLock(tx)

        const currentPlan = await this.getPlanById(dto.id, tx)
        const currentStatus = this.resolvePlanStatus(currentPlan)
        const currentRewardDefinition = this.getPlanRewardDefinition(currentPlan, {
          allowEmpty: true,
        })
        const nextPlan = {
          planCode: dto.planCode?.trim() ?? currentPlan.planCode,
          planName: dto.planName?.trim() ?? currentPlan.planName,
          status: dto.status ?? currentStatus,
          cycleType:
            dto.cycleType !== undefined
              ? this.parseCycleType(dto.cycleType)
              : this.parseCycleType(currentPlan.cycleType),
          startDate:
            dto.startDate !== undefined
              ? this.parseDateOnly(dto.startDate, '计划开始日期')
              : this.toDateOnlyValue(currentPlan.startDate),
          endDate:
            dto.endDate !== undefined
              ? dto.endDate
                ? this.parseDateOnly(dto.endDate, '计划结束日期')
                : null
              : this.toDateOnlyValue(currentPlan.endDate) || null,
          allowMakeupCountPerCycle:
            dto.allowMakeupCountPerCycle !== undefined
              ? dto.allowMakeupCountPerCycle
              : currentPlan.allowMakeupCountPerCycle,
        }

        if (
          !Number.isInteger(nextPlan.allowMakeupCountPerCycle) ||
          nextPlan.allowMakeupCountPerCycle < 0
        ) {
          throw new BadRequestException('每周期补签次数必须为非负整数')
        }
        this.ensurePlanDateRange(nextPlan.startDate, nextPlan.endDate)
        this.ensurePlanBoundaryAligned(
          nextPlan.cycleType,
          nextPlan.startDate,
          nextPlan.endDate,
        )

        if (nextPlan.status === CheckInPlanStatusEnum.PUBLISHED) {
          await this.assertPublishedPlanWindowAvailable(
            {
              planId: currentPlan.id,
              startDate: nextPlan.startDate,
              endDate: nextPlan.endDate,
            },
            tx,
          )
          await this.assertNoImmediateSwitch(
            nextPlan.startDate,
            new Date(),
            currentPlan.id,
            tx,
          )
        }

        const normalizedRewardDefinition = currentRewardDefinition
          ? this.buildRewardDefinition({
              cycleType: nextPlan.cycleType,
              startDate: nextPlan.startDate,
              endDate: nextPlan.endDate,
              baseRewardConfig: currentRewardDefinition.baseRewardConfig,
              dateRewardRules: currentRewardDefinition.dateRewardRules,
              patternRewardRules: currentRewardDefinition.patternRewardRules,
              streakRewardRules: currentRewardDefinition.streakRewardRules,
            })
          : null

        const result = await tx
          .update(this.checkInPlanTable)
          .set({
            planCode: nextPlan.planCode,
            planName: nextPlan.planName,
            ...this.buildPlanStatusPersistence(nextPlan.status),
            cycleType: nextPlan.cycleType,
            startDate: nextPlan.startDate,
            endDate: nextPlan.endDate,
            allowMakeupCountPerCycle: nextPlan.allowMakeupCountPerCycle,
            rewardDefinition: normalizedRewardDefinition,
            updatedById: adminUserId,
          })
          .where(
            and(
              eq(this.checkInPlanTable.id, dto.id),
              isNull(this.checkInPlanTable.deletedAt),
            ),
          )

        this.drizzle.assertAffectedRows(result, '签到计划不存在')
      },
      { duplicate: '签到计划编码已存在' },
    )

    return true
  }

  /** 更新计划奖励配置。 */
  async updatePlanRewardConfig(
    dto: UpdateCheckInPlanRewardConfigDto,
    adminUserId: number,
  ) {
    return this.applyPlanRewardConfig(dto, adminUserId, 'update')
  }

  /** 更新计划状态，并拦截会破坏单生效计划合同的配置。 */
  async updatePlanStatus(dto: UpdateCheckInPlanStatusDto, adminUserId: number) {
    await this.drizzle.withTransaction(async (tx) => {
      await this.acquirePlanMutationLock(tx)

      const plan = await this.getPlanById(dto.id, tx)
      const nextStatus = dto.status ?? this.resolvePlanStatus(plan)

      if (nextStatus === CheckInPlanStatusEnum.PUBLISHED) {
        await this.assertPublishedPlanWindowAvailable(
          {
            planId: plan.id,
            startDate: this.toDateOnlyValue(plan.startDate),
            endDate: plan.endDate ? this.toDateOnlyValue(plan.endDate) : null,
          },
          tx,
        )
        await this.assertNoImmediateSwitch(
          this.toDateOnlyValue(plan.startDate),
          new Date(),
          plan.id,
          tx,
        )
      }

      const result = await tx
        .update(this.checkInPlanTable)
        .set({
          ...this.buildPlanStatusPersistence(nextStatus),
          updatedById: adminUserId,
        })
        .where(
          and(
            eq(this.checkInPlanTable.id, dto.id),
            isNull(this.checkInPlanTable.deletedAt),
          ),
        )

      this.drizzle.assertAffectedRows(result, '签到计划不存在')
    })
    return true
  }

  /**
   * 后台计划写入统一加事务级 advisory lock。
   *
   * 这样可以把生效窗口校验和最终写入收拢到同一串行临界区内，
   * 避免并发发布时多个计划同时通过“单生效计划”检查。
   */
  private async acquirePlanMutationLock(tx: Db) {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${CHECK_IN_PLAN_MUTATION_LOCK_KEY})`)
  }

  /**
   * 应用计划奖励配置。
   *
   * 奖励配置统一维护默认基础奖励、具体日期奖励、周期模式奖励和连续奖励；
   * 一旦计划已产生签到事实，配置立即锁定，不允许继续修改。
   */
  private async applyPlanRewardConfig(
    dto: CreateCheckInPlanRewardConfigDto | UpdateCheckInPlanRewardConfigDto,
    adminUserId: number,
    mode: 'create' | 'update',
  ) {
    await this.drizzle.withTransaction(async (tx) => {
      await this.acquirePlanMutationLock(tx)

      const currentPlan = await this.getPlanById(dto.id, tx)
      await this.assertPlanRewardConfigMutable(currentPlan.id, tx)

      const currentRewardDefinition = this.getPlanRewardDefinition(currentPlan, {
        allowEmpty: true,
      })
      const hasCurrentConfig = currentRewardDefinition !== null

      if (mode === 'create' && hasCurrentConfig) {
        throw new ConflictException('签到计划奖励配置已存在')
      }
      if (mode === 'update' && !hasCurrentConfig) {
        throw new NotFoundException('签到计划奖励配置不存在')
      }

      const cycleType = this.parseCycleType(currentPlan.cycleType)
      const nextRewardDefinition = this.buildRewardDefinition({
        cycleType,
        startDate: this.toDateOnlyValue(currentPlan.startDate),
        endDate: this.toDateOnlyValue(currentPlan.endDate) || null,
        baseRewardConfig:
          dto.baseRewardConfig !== undefined
            ? dto.baseRewardConfig
            : currentRewardDefinition?.baseRewardConfig ?? null,
        dateRewardRules:
          dto.dateRewardRules !== undefined
            ? dto.dateRewardRules
            : currentRewardDefinition?.dateRewardRules ?? [],
        patternRewardRules:
          dto.patternRewardRules !== undefined
            ? dto.patternRewardRules
            : currentRewardDefinition?.patternRewardRules ?? [],
        streakRewardRules:
          dto.streakRewardRules !== undefined
            ? dto.streakRewardRules
            : currentRewardDefinition?.streakRewardRules ?? [],
      })

      if (
        nextRewardDefinition.baseRewardConfig === null &&
        nextRewardDefinition.dateRewardRules.length === 0 &&
        nextRewardDefinition.patternRewardRules.length === 0 &&
        nextRewardDefinition.streakRewardRules.length === 0
      ) {
        throw new BadRequestException('奖励配置不能为空')
      }

      const result = await tx
        .update(this.checkInPlanTable)
        .set({
          rewardDefinition: nextRewardDefinition,
          updatedById: adminUserId,
        })
        .where(
          and(
            eq(this.checkInPlanTable.id, dto.id),
            isNull(this.checkInPlanTable.deletedAt),
          ),
        )

      this.drizzle.assertAffectedRows(result, '签到计划不存在')
    })

    return true
  }

  /** 断言指定计划尚未产生签到记录，仍允许修改奖励配置。 */
  private async assertPlanRewardConfigMutable(planId: number, db: Db = this.db) {
    const [record] = await db
      .select({ id: this.checkInRecordTable.id })
      .from(this.checkInRecordTable)
      .where(eq(this.checkInRecordTable.planId, planId))
      .limit(1)

    if (record) {
      throw new ConflictException('计划已产生签到数据，不允许修改奖励配置')
    }
  }

  /** 断言已发布计划窗口之间不存在重叠。 */
  private async assertPublishedPlanWindowAvailable(
    input: {
      planId?: number
      startDate: string
      endDate?: string | null
    },
    db: Db = this.db,
  ) {
    const conditions = [
      isNull(this.checkInPlanTable.deletedAt),
      eq(this.checkInPlanTable.status, CheckInPlanStatusEnum.PUBLISHED),
      lte(this.checkInPlanTable.startDate, input.endDate ?? '9999-12-31'),
      or(
        isNull(this.checkInPlanTable.endDate),
        gte(this.checkInPlanTable.endDate, input.startDate),
      ),
    ]

    if (input.planId !== undefined) {
      conditions.push(ne(this.checkInPlanTable.id, input.planId))
    }

    const [conflictedPlan] = await db
      .select({ id: this.checkInPlanTable.id })
      .from(this.checkInPlanTable)
      .where(and(...conditions))
      .limit(1)

    if (conflictedPlan) {
      throw new ConflictException('已发布签到计划窗口不能重叠')
    }
  }

  /** 断言新计划不会在当前自然周期内立即切换生效。 */
  private async assertNoImmediateSwitch(
    startDate: string,
    now: Date,
    currentPlanId?: number,
    db: Db = this.db,
  ) {
    const activePlan = await this.findCurrentActivePlan(now, db)
    if (!activePlan) {
      return
    }
    if (currentPlanId && activePlan.id === currentPlanId) {
      return
    }

    const currentCycle = this.buildCycleFrame(activePlan, now)
    if (startDate <= currentCycle.cycleEndDate) {
      throw new ConflictException('当前周期内不允许立即切换签到计划')
    }
  }

  /** 聚合单个计划在后台列表页展示所需的运行态摘要。 */
  private async buildPlanSummary(
    planId: number,
    rewardDefinition: ReturnType<CheckInDefinitionService['getPlanRewardDefinition']>,
  ) {
    const today = this.formatDateOnly(new Date())
    const [activeCycleRow, pendingRecordRow, pendingGrantRow] = await Promise.all([
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(this.checkInCycleTable)
        .where(
          and(
            eq(this.checkInCycleTable.planId, planId),
            gte(this.checkInCycleTable.cycleEndDate, today),
          ),
        ),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(this.checkInRecordTable)
        .where(
          and(
            eq(this.checkInRecordTable.planId, planId),
            inArray(this.checkInRecordTable.rewardStatus, [
              CheckInRewardStatusEnum.PENDING,
              CheckInRewardStatusEnum.FAILED,
            ]),
          ),
        ),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(this.checkInStreakRewardGrantTable)
        .where(
          and(
            eq(this.checkInStreakRewardGrantTable.planId, planId),
            inArray(this.checkInStreakRewardGrantTable.grantStatus, [
              CheckInRewardStatusEnum.PENDING,
              CheckInRewardStatusEnum.FAILED,
            ]),
          ),
        ),
    ])

    return {
      ruleCount: rewardDefinition?.streakRewardRules.length ?? 0,
      activeCycleCount: Number(activeCycleRow[0]?.count ?? 0),
      pendingRewardCount:
        Number(pendingRecordRow[0]?.count ?? 0) +
        Number(pendingGrantRow[0]?.count ?? 0),
    }
  }
}
