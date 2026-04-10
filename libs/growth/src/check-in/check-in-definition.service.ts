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
  CheckInPatternRewardRuleTypeEnum,
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
        this.buildPlanSummary(plan.id, plan.version),
      ),
    )

    return {
      ...page,
      list: page.list.map((plan, index) => {
        return {
          ...plan,
          baseRewardConfig: this.parseStoredRewardConfig(
            plan.baseRewardConfig,
            {
              allowEmpty: true,
            },
          ),
          status: this.resolvePlanStatus(plan),
          ...summaries[index],
        }
      }),
    }
  }

  /** 读取单个签到计划详情及当前版本规则快照。 */
  async getPlanDetail(query: IdDto) {
    const plan = await this.getPlanById(query.id)
    const [dateRules, patternRules, streakRules, summary] = await Promise.all([
      this.getPlanDateRewardRules(plan.id, plan.version),
      this.getPlanPatternRewardRules(plan.id, plan.version),
      this.getPlanRules(plan.id, plan.version),
      this.buildPlanSummary(plan.id, plan.version),
    ])

    return {
      ...plan,
      baseRewardConfig: this.parseStoredRewardConfig(plan.baseRewardConfig, {
        allowEmpty: true,
      }),
      status: this.resolvePlanStatus(plan),
      ...summary,
      dateRewardRules: dateRules.map((rule) =>
        this.toDateRewardRuleView(rule),
      ),
      patternRewardRules: patternRules.map((rule) =>
        this.toPatternRewardRuleView(rule),
      ),
      streakRewardRules: streakRules.map((rule) => this.toStreakRuleView(rule)),
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
            baseRewardConfig: null,
            version: 1,
            createdById: adminUserId,
            updatedById: adminUserId,
          })
          .returning()

        return { id: createdPlan.id }
      },
      { duplicate: '签到计划编码已存在' },
    )
  }

  /** 创建计划奖励配置，并在变更时切到新版本。 */
  async createPlanRewardConfig(
    dto: CreateCheckInPlanRewardConfigDto,
    adminUserId: number,
  ) {
    return this.applyPlanRewardConfig(dto, adminUserId, 'create')
  }

  /**
   * 更新签到计划。
   *
   * 当改动会影响周期解释、补签规则或奖励语义时，自动递增版本并写入新版本规则。
   */
  async updatePlan(dto: UpdateCheckInPlanDto, adminUserId: number) {
    await this.drizzle.withTransaction(
      async (tx) => {
        await this.acquirePlanMutationLock(tx)

        const currentPlan = await this.getPlanById(dto.id, tx)
        const currentStatus = this.resolvePlanStatus(currentPlan)
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
          baseRewardConfig: this.parseStoredRewardConfig(
            currentPlan.baseRewardConfig,
            {
              allowEmpty: true,
            },
          ),
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

        const currentDateRules = await this.getPlanDateRewardRules(
          currentPlan.id,
          currentPlan.version,
          tx,
        )
        const currentPatternRules = await this.getPlanPatternRewardRules(
          currentPlan.id,
          currentPlan.version,
          tx,
        )
        const currentRules = await this.getPlanRules(
          currentPlan.id,
          currentPlan.version,
          tx,
        )
        const nextDateRules = this.buildDateRewardRuleDrafts(
          currentDateRules,
          currentPlan.id,
          currentPlan.version,
          nextPlan.startDate,
          nextPlan.endDate,
        )
        const nextPatternRules = this.buildPatternRewardRuleDrafts(
          currentPatternRules,
          currentPlan.id,
          currentPlan.version,
          nextPlan.cycleType,
        )
        const nextRules = this.buildStreakRewardRuleDrafts(
          currentRules,
          currentPlan.id,
          currentPlan.version,
        )

        const shouldBumpVersion = this.shouldBumpPlanVersion({
          currentPlan,
          nextPlan,
          currentDateRules,
          nextDateRules,
          currentPatternRules,
          nextPatternRules,
          currentRules,
          nextRules,
        })
        const nextVersion = shouldBumpVersion
          ? currentPlan.version + 1
          : currentPlan.version

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
            baseRewardConfig: nextPlan.baseRewardConfig,
            version: nextVersion,
            updatedById: adminUserId,
          })
          .where(
            and(
              eq(this.checkInPlanTable.id, dto.id),
              isNull(this.checkInPlanTable.deletedAt),
            ),
          )

        this.drizzle.assertAffectedRows(result, '签到计划不存在')

        if (shouldBumpVersion && nextDateRules.length > 0) {
          await tx.insert(this.checkInDateRewardRuleTable).values(
            nextDateRules.map((rule) => ({
              ...rule,
              planVersion: nextVersion,
            })),
          )
        }

        if (shouldBumpVersion && nextPatternRules.length > 0) {
          await tx.insert(this.checkInPatternRewardRuleTable).values(
            nextPatternRules.map((rule) => ({
              ...rule,
              planVersion: nextVersion,
            })),
          )
        }

        if (shouldBumpVersion && nextRules.length > 0) {
          await tx.insert(this.checkInStreakRewardRuleTable).values(
            nextRules.map((rule) => ({
              ...rule,
              planVersion: nextVersion,
            })),
          )
        }
      },
      { duplicate: '签到计划编码已存在' },
    )

    return true
  }

  /** 更新计划奖励配置，并继续复制未显式修改的现有奖励规则。 */
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
   * 奖励配置统一维护默认基础奖励、具体日期奖励、周期模式奖励和连续奖励。任一部分
   * 变更都会复制未显式修改的现有规则到新版本，保证历史周期继续使用旧解释。
   */
  private async applyPlanRewardConfig(
    dto: CreateCheckInPlanRewardConfigDto | UpdateCheckInPlanRewardConfigDto,
    adminUserId: number,
    mode: 'create' | 'update',
  ) {
    await this.drizzle.withTransaction(async (tx) => {
      await this.acquirePlanMutationLock(tx)

      const currentPlan = await this.getPlanById(dto.id, tx)
      const currentDateRules = await this.getPlanDateRewardRules(
        currentPlan.id,
        currentPlan.version,
        tx,
      )
      const currentPatternRules = await this.getPlanPatternRewardRules(
        currentPlan.id,
        currentPlan.version,
        tx,
      )
      const currentRules = await this.getPlanRules(
        currentPlan.id,
        currentPlan.version,
        tx,
      )
      const currentBaseRewardConfig = this.parseStoredRewardConfig(
        currentPlan.baseRewardConfig,
        { allowEmpty: true },
      )
      const hasCurrentConfig =
        currentBaseRewardConfig !== null ||
        currentDateRules.length > 0 ||
        currentPatternRules.length > 0 ||
        currentRules.length > 0

      if (mode === 'create' && hasCurrentConfig) {
        throw new ConflictException('签到计划奖励配置已存在')
      }
      if (mode === 'update' && !hasCurrentConfig) {
        throw new NotFoundException('签到计划奖励配置不存在')
      }

      const cycleType = this.parseCycleType(currentPlan.cycleType)
      const nextBaseRewardConfig =
        dto.baseRewardConfig !== undefined
          ? this.parseRewardConfig(dto.baseRewardConfig, {
              allowEmpty: true,
            })
          : currentBaseRewardConfig
      const nextDateRules =
        dto.dateRewardRules !== undefined
          ? this.normalizeDateRewardRules(
              dto.dateRewardRules,
              currentPlan.id,
              currentPlan.version,
              this.toDateOnlyValue(currentPlan.startDate),
              this.toDateOnlyValue(currentPlan.endDate) || null,
            )
          : this.buildDateRewardRuleDrafts(
              currentDateRules,
              currentPlan.id,
              currentPlan.version,
              this.toDateOnlyValue(currentPlan.startDate),
              this.toDateOnlyValue(currentPlan.endDate) || null,
            )
      const nextPatternRules =
        dto.patternRewardRules !== undefined
          ? this.normalizePatternRewardRules(
              dto.patternRewardRules,
              currentPlan.id,
              currentPlan.version,
              cycleType,
            )
          : this.buildPatternRewardRuleDrafts(
              currentPatternRules,
              currentPlan.id,
              currentPlan.version,
              cycleType,
            )
      const nextRules =
        dto.streakRewardRules !== undefined
          ? this.normalizeStreakRewardRules(
              dto.streakRewardRules,
              currentPlan.id,
              currentPlan.version,
            )
          : this.buildStreakRewardRuleDrafts(
              currentRules,
              currentPlan.id,
              currentPlan.version,
            )

      if (
        nextBaseRewardConfig === null &&
        nextDateRules.length === 0 &&
        nextPatternRules.length === 0 &&
        nextRules.length === 0
      ) {
        throw new BadRequestException('奖励配置不能为空')
      }

      const shouldBumpVersion = this.shouldBumpPlanVersion({
        currentPlan,
        nextPlan: {
          cycleType,
          startDate: this.toDateOnlyValue(currentPlan.startDate),
          endDate: this.toDateOnlyValue(currentPlan.endDate) || null,
          allowMakeupCountPerCycle: currentPlan.allowMakeupCountPerCycle,
          baseRewardConfig: nextBaseRewardConfig,
        },
        currentDateRules,
        nextDateRules,
        currentPatternRules,
        nextPatternRules,
        currentRules,
        nextRules,
      })
      const nextVersion = shouldBumpVersion
        ? currentPlan.version + 1
        : currentPlan.version

      const result = await tx
        .update(this.checkInPlanTable)
        .set({
          baseRewardConfig: nextBaseRewardConfig,
          version: nextVersion,
          updatedById: adminUserId,
        })
        .where(
          and(
            eq(this.checkInPlanTable.id, dto.id),
            isNull(this.checkInPlanTable.deletedAt),
          ),
        )

      this.drizzle.assertAffectedRows(result, '签到计划不存在')

      if (shouldBumpVersion && nextDateRules.length > 0) {
        await tx.insert(this.checkInDateRewardRuleTable).values(
          nextDateRules.map((rule) => ({
            ...rule,
            planVersion: nextVersion,
          })),
        )
      }

      if (shouldBumpVersion && nextPatternRules.length > 0) {
        await tx.insert(this.checkInPatternRewardRuleTable).values(
          nextPatternRules.map((rule) => ({
            ...rule,
            planVersion: nextVersion,
          })),
        )
      }

      if (shouldBumpVersion && nextRules.length > 0) {
        await tx.insert(this.checkInStreakRewardRuleTable).values(
          nextRules.map((rule) => ({
            ...rule,
            planVersion: nextVersion,
          })),
        )
      }
    })

    return true
  }

  /** 把当前版本的具体日期奖励规则重建为下一版本可复用的写表载荷。 */
  private buildDateRewardRuleDrafts(
    rules: Awaited<
      ReturnType<CheckInDefinitionService['getPlanDateRewardRules']>
    >,
    planId: number,
    planVersion: number,
    startDate: string,
    endDate?: string | null,
  ) {
    return this.normalizeDateRewardRules(
      rules.map((rule) => ({
        rewardDate: this.toDateOnlyValue(rule.rewardDate),
        rewardConfig: this.parseStoredRewardConfig(rule.rewardConfig, {
          allowEmpty: false,
        })!,
      })),
      planId,
      planVersion,
      startDate,
      endDate,
    )
  }

  /** 把当前版本的周期模式奖励规则重建为下一版本可复用的写表载荷。 */
  private buildPatternRewardRuleDrafts(
    rules: Awaited<
      ReturnType<CheckInDefinitionService['getPlanPatternRewardRules']>
    >,
    planId: number,
    planVersion: number,
    cycleType: ReturnType<CheckInDefinitionService['parseCycleType']>,
  ) {
    return this.normalizePatternRewardRules(
      rules.map((rule) => ({
        patternType: rule.patternType as CheckInPatternRewardRuleTypeEnum,
        weekday: rule.weekday,
        monthDay: rule.monthDay,
        rewardConfig: this.parseStoredRewardConfig(rule.rewardConfig, {
          allowEmpty: false,
        })!,
      })),
      planId,
      planVersion,
      cycleType,
    )
  }

  /** 把当前版本的连续奖励规则重建为下一版本可复用的写表载荷。 */
  private buildStreakRewardRuleDrafts(
    rules: Awaited<ReturnType<CheckInDefinitionService['getPlanRules']>>,
    planId: number,
    planVersion: number,
  ) {
    return this.normalizeStreakRewardRules(
      rules.map((rule) => ({
        ruleCode: rule.ruleCode,
        streakDays: rule.streakDays,
        rewardConfig: this.parseStoredRewardConfig(rule.rewardConfig, {
          allowEmpty: false,
        })!,
        repeatable: rule.repeatable,
        status: rule.status,
      })),
      planId,
      planVersion,
    )
  }

  /** 断言已发布计划窗口之间不存在重叠。 */
  private async assertPublishedPlanWindowAvailable(input: {
    planId?: number
    startDate: string
    endDate?: string | null
  }, db: Db = this.db) {
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
  private async buildPlanSummary(planId: number, planVersion: number) {
    const today = this.formatDateOnly(new Date())
    const [ruleRow, activeCycleRow, pendingRecordRow, pendingGrantRow] =
      await Promise.all([
        this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(this.checkInStreakRewardRuleTable)
          .where(
            and(
              eq(this.checkInStreakRewardRuleTable.planId, planId),
              eq(this.checkInStreakRewardRuleTable.planVersion, planVersion),
              isNull(this.checkInStreakRewardRuleTable.deletedAt),
            ),
          ),
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
      ruleCount: Number(ruleRow[0]?.count ?? 0),
      activeCycleCount: Number(activeCycleRow[0]?.count ?? 0),
      pendingRewardCount:
        Number(pendingRecordRow[0]?.count ?? 0) +
        Number(pendingGrantRow[0]?.count ?? 0),
    }
  }
}
