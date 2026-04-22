import type { SQL } from 'drizzle-orm'
import type {
  CheckInExecutedRowsResult,
  CheckInPublishEffectiveInput,
  CheckInRuleIdQuery,
  StreakRulePageOrderField,
  StreakRulePageOrderItem,
  StreakRulePageQuery,
  StreakRulePageRow,
  StreakRulePageStatus,
} from './check-in.type'
import type {
  PublishCheckInStreakRuleDto,
  QueryCheckInStreakRuleHistoryPageDto,
  QueryCheckInStreakRulePageDto,
  UpdateCheckInConfigDto,
  UpdateCheckInEnabledDto,
} from './dto/check-in-definition.dto'
import { DrizzleService } from '@db/core'
import { GrowthLedgerService } from '@libs/growth/growth-ledger/growth-ledger.service'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { startOfNextDayInAppTimeZone } from '@libs/platform/utils/time'
import { BadRequestException, Injectable } from '@nestjs/common'
import { eq, sql } from 'drizzle-orm'
import { CheckInRewardPolicyService } from './check-in-reward-policy.service'
import { CheckInStreakService } from './check-in-streak.service'
import {
  CheckInStreakConfigStatusEnum,
  CheckInStreakPublishStrategyEnum,
} from './check-in.constant'
import { CheckInServiceSupport } from './check-in.service.support'

const CHECK_IN_STREAK_MUTATION_LOCK_KEY = 1_048_102
const STREAK_RULE_PAGE_DEFAULT_ORDER = [
  { field: 'streakDays', direction: 'asc' },
  { field: 'version', direction: 'desc' },
  { field: 'id', direction: 'desc' },
] as const
const STREAK_RULE_PAGE_SORTABLE_FIELDS = new Set([
  'id',
  'ruleCode',
  'streakDays',
  'version',
  'status',
  'publishStrategy',
  'repeatable',
  'effectiveFrom',
  'effectiveTo',
  'createdAt',
  'updatedAt',
] as const)

/**
 * 签到定义管理服务。
 *
 * 负责全局签到配置与按连续天记录版本的后台写入、历史查询与终止操作。
 */
@Injectable()
export class CheckInDefinitionService extends CheckInServiceSupport {
  // 注入签到定义管理所需的数据库与账本依赖。
  constructor(
    drizzle: DrizzleService,
    growthLedgerService: GrowthLedgerService,
    private readonly checkInRewardPolicyService: CheckInRewardPolicyService,
    private readonly checkInStreakService: CheckInStreakService,
  ) {
    super(drizzle, growthLedgerService)
  }

  // 查询当前唯一有效的全局签到配置详情。
  async getConfigDetail() {
    const config = await this.getRequiredConfig()
    const rewardDefinition =
      this.checkInRewardPolicyService.parseRewardDefinition(config)

    return {
      id: config.id,
      isEnabled: config.isEnabled === 1,
      makeupPeriodType: config.makeupPeriodType,
      periodicAllowance: config.periodicAllowance,
      baseRewardItems: rewardDefinition.baseRewardItems,
      dateRewardRules: rewardDefinition.dateRewardRules,
      patternRewardRules: rewardDefinition.patternRewardRules,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    }
  }

  // 更新全局签到配置，并在缺失时自动创建首条配置。
  async updateConfig(dto: UpdateCheckInConfigDto, adminUserId: number) {
    const normalized = {
      isEnabled: dto.isEnabled ? 1 : 0,
      makeupPeriodType: dto.makeupPeriodType,
      periodicAllowance: dto.periodicAllowance,
      baseRewardItems: this.checkInRewardPolicyService.parseRewardItems(
        dto.baseRewardItems,
        {
          allowEmpty: true,
        },
      ),
      dateRewardRules:
        this.checkInRewardPolicyService.normalizeDateRewardRules(
          dto.dateRewardRules,
        ),
      patternRewardRules:
        this.checkInRewardPolicyService.normalizePatternRewardRules(
          dto.patternRewardRules,
          dto.makeupPeriodType,
        ),
      updatedById: adminUserId,
    }

    const current = await this.getCurrentConfig()
    if (!current) {
      await this.db.insert(this.checkInConfigTable).values(normalized)
      return true
    }

    await this.db
      .update(this.checkInConfigTable)
      .set(normalized)
      .where(eq(this.checkInConfigTable.id, current.id))

    return true
  }

  // 单独更新签到开关，避免覆盖其他配置字段。
  async updateEnabled(dto: UpdateCheckInEnabledDto, adminUserId: number) {
    const current = await this.getRequiredConfig()
    await this.db
      .update(this.checkInConfigTable)
      .set({
        isEnabled: dto.isEnabled ? 1 : 0,
        updatedById: adminUserId,
      })
      .where(eq(this.checkInConfigTable.id, current.id))
    return true
  }

  // 查询连续签到规则主列表，并按代表版本分页返回。
  async getStreakRulePage(query: QueryCheckInStreakRulePageDto) {
    const now = new Date()
    const selectedRules = this.sortStreakRulePageRows(
      await this.listStreakRulePageRows(query, now),
      query.orderBy,
      now,
    )

    const pageIndex = query.pageIndex ?? 1
    const pageSize = query.pageSize ?? 20
    const start = (pageIndex - 1) * pageSize
    const list = selectedRules.slice(start, start + pageSize)

    return {
      list: await this.buildStreakRuleDetailViews(list, now),
      pageIndex,
      pageSize,
      total: selectedRules.length,
    }
  }

  // 查询单条连续签到规则的详情视图。
  async getStreakRuleDetail(query: CheckInRuleIdQuery) {
    return this.getStreakRuleHistoryDetail(query)
  }

  // 查询某个连续签到规则编码下的全部历史版本。
  async getStreakRuleHistoryPage(query: QueryCheckInStreakRuleHistoryPageDto) {
    const ruleCode = this.checkInStreakService.buildStreakRuleCode(
      query.streakDays,
    )
    const rules = await this.checkInStreakService.listStreakRuleVersionsByCode(
      ruleCode,
    )
    const pageIndex = query.pageIndex ?? 1
    const pageSize = query.pageSize ?? 20
    const start = (pageIndex - 1) * pageSize
    const list = rules.slice(start, start + pageSize)

    return {
      list: await this.buildStreakRuleDetailViews(list),
      pageIndex,
      pageSize,
      total: rules.length,
    }
  }

  // 查询某个历史规则版本详情，不存在时返回业务异常。
  async getStreakRuleHistoryDetail(query: CheckInRuleIdQuery) {
    const rule = await this.db.query.checkInStreakRule.findFirst({
      where: { id: query.id },
    })
    if (!rule) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '连续签到记录不存在',
      )
    }
    return this.buildStreakRuleDetailView(rule)
  }

  // 发布新的连续签到规则版本，并桥接旧版本的生效窗口。
  async publishStreakRule(
    dto: PublishCheckInStreakRuleDto,
    adminUserId: number,
  ) {
    if (!Number.isInteger(dto.streakDays) || dto.streakDays <= 0) {
      throw new BadRequestException('连续奖励阈值必须为正整数')
    }

    const rewardItems = this.checkInRewardPolicyService.parseRewardItems(
      dto.rewardItems,
      {
        allowEmpty: false,
      },
    )!
    const now = new Date()
    const effectiveFrom = this.resolvePublishEffectiveFrom(dto, now)
    const ruleCode = this.checkInStreakService.buildStreakRuleCode(
      dto.streakDays,
    )

    await this.drizzle.withTransaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(${CHECK_IN_STREAK_MUTATION_LOCK_KEY})`,
      )

      const latest = await this.checkInStreakService.findLatestStreakRuleVersion(
        ruleCode,
        tx,
      )
      const existing = await this.checkInStreakService.listStreakRuleVersionsByCode(
        ruleCode,
        tx,
      )

      for (const rule of existing.filter(
        (item) =>
          item.status !== CheckInStreakConfigStatusEnum.DRAFT &&
          item.status !== CheckInStreakConfigStatusEnum.TERMINATED &&
          item.effectiveFrom < effectiveFrom &&
          (item.effectiveTo === null || item.effectiveTo > effectiveFrom),
      )) {
        await tx
          .update(this.checkInStreakRuleTable)
          .set({
            effectiveTo: effectiveFrom,
            status: this.checkInStreakService.resolveStreakRuleStatus(
              {
                status: rule.status,
                effectiveFrom: rule.effectiveFrom,
                effectiveTo: effectiveFrom,
              },
              now,
            ),
            updatedById: adminUserId,
          })
          .where(eq(this.checkInStreakRuleTable.id, rule.id))
      }

      for (const rule of existing.filter(
        (item) =>
          item.status !== CheckInStreakConfigStatusEnum.DRAFT &&
          item.status !== CheckInStreakConfigStatusEnum.TERMINATED &&
          item.effectiveFrom >= effectiveFrom,
      )) {
        await tx
          .update(this.checkInStreakRuleTable)
          .set({
            status: CheckInStreakConfigStatusEnum.TERMINATED,
            updatedById: adminUserId,
          })
          .where(eq(this.checkInStreakRuleTable.id, rule.id))
      }

      const [insertedRule] = await tx
        .insert(this.checkInStreakRuleTable)
        .values({
          effectiveFrom,
          effectiveTo: null,
          publishStrategy: dto.publishStrategy,
          repeatable: dto.repeatable ?? false,
          ruleCode,
          status: this.resolvePublishedRuleStatus(effectiveFrom),
          streakDays: dto.streakDays,
          updatedById: adminUserId,
          version: (latest?.version ?? 0) + 1,
        })
        .returning({ id: this.checkInStreakRuleTable.id })

      await tx.insert(this.checkInStreakRuleRewardItemTable).values(
        rewardItems.map((item, sortOrder) => ({
          amount: item.amount,
          assetKey: item.assetKey,
          assetType: item.assetType,
          ruleId: insertedRule.id,
          sortOrder,
        })),
      )
    })

    return true
  }

  // 终止指定规则版本，并在排期版本场景下回补前驱窗口。
  async terminateStreakRule(query: CheckInRuleIdQuery, adminUserId: number) {
    await this.drizzle.withTransaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(${CHECK_IN_STREAK_MUTATION_LOCK_KEY})`,
      )

      const current = await tx.query.checkInStreakRule.findFirst({
        where: { id: query.id },
      })
      if (!current) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_NOT_FOUND,
          '连续签到记录不存在',
        )
      }

      const now = new Date()
      const status = this.checkInStreakService.resolveStreakRuleStatus(
        current,
        now,
      )
      if (
        status !== CheckInStreakConfigStatusEnum.SCHEDULED &&
        status !== CheckInStreakConfigStatusEnum.ACTIVE
      ) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '仅支持终止未过期的连续签到记录',
        )
      }

      await tx
        .update(this.checkInStreakRuleTable)
        .set({
          ...(status === CheckInStreakConfigStatusEnum.ACTIVE
            ? { effectiveTo: now }
            : {}),
          status: CheckInStreakConfigStatusEnum.TERMINATED,
          updatedById: adminUserId,
        })
        .where(eq(this.checkInStreakRuleTable.id, current.id))

      if (status === CheckInStreakConfigStatusEnum.SCHEDULED) {
        const candidates = (
          await this.checkInStreakService.listStreakRuleVersionsByCode(
            current.ruleCode,
            tx,
          )
        ).filter(
          (rule) =>
            rule.id !== current.id &&
            rule.status !== CheckInStreakConfigStatusEnum.DRAFT &&
            rule.status !== CheckInStreakConfigStatusEnum.TERMINATED,
        )
        const predecessor = [...candidates]
          .filter((rule) => rule.effectiveFrom < current.effectiveFrom)
          .sort((left, right) => {
            const diff =
              right.effectiveFrom.getTime() - left.effectiveFrom.getTime()
            return diff !== 0 ? diff : right.id - left.id
          })[0]
        const successor = [...candidates]
          .filter((rule) => rule.effectiveFrom > current.effectiveFrom)
          .sort((left, right) => {
            const diff =
              left.effectiveFrom.getTime() - right.effectiveFrom.getTime()
            return diff !== 0 ? diff : left.id - right.id
          })[0]

        if (!predecessor) {
          return
        }

        const bridgedEffectiveTo = successor?.effectiveFrom ?? null
        await tx
          .update(this.checkInStreakRuleTable)
          .set({
            effectiveTo: bridgedEffectiveTo,
            status: this.checkInStreakService.resolveStreakRuleStatus(
              {
                status: predecessor.status,
                effectiveFrom: predecessor.effectiveFrom,
                effectiveTo: bridgedEffectiveTo,
              },
              now,
            ),
            updatedById: adminUserId,
          })
          .where(eq(this.checkInStreakRuleTable.id, predecessor.id))
      }
    })

    return true
  }

  // 构建单条规则详情；若规则缺失则统一转成资源不存在异常。
  private async buildStreakRuleDetailView(
    rule: StreakRulePageRow,
    at = new Date(),
  ) {
    const [detail] = await this.buildStreakRuleDetailViews([rule], at)
    if (!detail) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '连续签到记录不存在',
      )
    }

    return detail
  }

  // 查询连续签到主页面的代表行。
  // 通过窗口函数在数据库侧为每个 ruleCode 只保留一条代表版本，避免在应用层重复分组。
  private async listStreakRulePageRows(
    query: StreakRulePageQuery,
    at: Date,
  ) {
    const rowsResult = await this.db.execute(sql`
      WITH base_rules AS (
        SELECT
          id,
          rule_code,
          streak_days,
          version,
          status,
          publish_strategy,
          effective_from,
          effective_to,
          repeatable,
          updated_by_id,
          created_at,
          updated_at,
          ${this.buildResolvedStreakRuleStatusSql(at)} AS resolved_status
        FROM check_in_streak_rule
        WHERE 1 = 1
          ${
            query.streakDays !== undefined
              ? sql`AND streak_days = ${query.streakDays}`
              : sql.empty()
          }
      ),
      filtered_rules AS (
        SELECT *
        FROM base_rules
        ${
          query.status !== undefined
            ? sql`WHERE resolved_status = ${query.status}`
            : sql.empty()
        }
      ),
      ranked_rules AS (
        SELECT
          *,
          ROW_NUMBER() OVER (
            PARTITION BY rule_code
            ORDER BY ${this.buildRepresentativeRowOrderBySql(query.status)}
          ) AS representative_rank
        FROM filtered_rules
      )
      SELECT
        id,
        rule_code AS "ruleCode",
        streak_days AS "streakDays",
        version,
        status,
        publish_strategy AS "publishStrategy",
        effective_from AS "effectiveFrom",
        effective_to AS "effectiveTo",
        repeatable,
        updated_by_id AS "updatedById",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM ranked_rules
      WHERE representative_rank = 1
    `)

    return this.extractExecutedRows<StreakRulePageRow>(rowsResult)
  }

  // 按解析后的排序项对规则代表行做应用层二次排序。
  private sortStreakRulePageRows(
    rows: StreakRulePageRow[],
    orderBy: string | undefined,
    at: Date,
  ) {
    const orderItems = this.parseStreakRulePageOrderBy(orderBy)
    return [...rows].sort((left, right) => {
      for (const item of orderItems) {
        const diff = this.compareStreakRulePageField(
          left,
          right,
          item.field,
          at,
        )
        if (diff !== 0) {
          return item.direction === 'asc' ? diff : -diff
        }
      }
      return 0
    })
  }

  // 解析分页排序参数，并限制在允许的字段和方向集合内。
  private parseStreakRulePageOrderBy(
    orderBy?: string,
  ): StreakRulePageOrderItem[] {
    if (!orderBy?.trim()) {
      return [...STREAK_RULE_PAGE_DEFAULT_ORDER]
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(orderBy)
    } catch {
      throw new BadRequestException('排序字段非法')
    }

    const records = Array.isArray(parsed) ? parsed : [parsed]
    return records.map((record) => {
      if (!record || typeof record !== 'object' || Array.isArray(record)) {
        throw new BadRequestException('排序字段非法')
      }

      const entries = Object.entries(record)
      if (entries.length !== 1) {
        throw new BadRequestException('排序字段非法')
      }

      const [field, direction] = entries[0]
      if (
        !STREAK_RULE_PAGE_SORTABLE_FIELDS.has(field as StreakRulePageOrderField)
      ) {
        throw new BadRequestException(`不支持的排序字段：${field}`)
      }
      if (direction !== 'asc' && direction !== 'desc') {
        throw new BadRequestException('排序方向非法')
      }

      return {
        direction,
        field: field as StreakRulePageOrderField,
      }
    })
  }

  // 比较两条规则在指定排序字段下的先后顺序。
  private compareStreakRulePageField(
    left: StreakRulePageRow,
    right: StreakRulePageRow,
    field: StreakRulePageOrderField,
    at: Date,
  ) {
    const leftValue = this.getStreakRulePageSortValue(left, field, at)
    const rightValue = this.getStreakRulePageSortValue(right, field, at)

    if (leftValue == null && rightValue == null) {
      return 0
    }
    if (leftValue == null) {
      return 1
    }
    if (rightValue == null) {
      return -1
    }
    if (typeof leftValue === 'string' && typeof rightValue === 'string') {
      return leftValue.localeCompare(rightValue)
    }
    if (leftValue < rightValue) {
      return -1
    }
    if (leftValue > rightValue) {
      return 1
    }
    return 0
  }

  // 读取指定排序字段的可比较值，并对状态字段做动态状态换算。
  private getStreakRulePageSortValue(
    rule: StreakRulePageRow,
    field: StreakRulePageOrderField,
    at: Date,
  ) {
    switch (field) {
      case 'id':
        return rule.id
      case 'ruleCode':
        return rule.ruleCode
      case 'streakDays':
        return rule.streakDays
      case 'version':
        return rule.version
      case 'status':
        return this.checkInStreakService.resolveStreakRuleStatus(rule, at)
      case 'publishStrategy':
        return rule.publishStrategy
      case 'repeatable':
        return rule.repeatable ? 1 : 0
      case 'effectiveFrom':
        return rule.effectiveFrom.getTime()
      case 'effectiveTo':
        return rule.effectiveTo?.getTime() ?? null
      case 'createdAt':
        return rule.createdAt.getTime()
      case 'updatedAt':
        return rule.updatedAt.getTime()
    }
  }

  // 生成用于 SQL 侧解析动态状态的 CASE 表达式。
  private buildResolvedStreakRuleStatusSql(at: Date): SQL {
    return sql`
      CASE
        WHEN status = ${CheckInStreakConfigStatusEnum.DRAFT}
          THEN ${CheckInStreakConfigStatusEnum.DRAFT}
        WHEN status = ${CheckInStreakConfigStatusEnum.TERMINATED}
          THEN ${CheckInStreakConfigStatusEnum.TERMINATED}
        WHEN effective_from > ${at}
          THEN ${CheckInStreakConfigStatusEnum.SCHEDULED}
        WHEN effective_to IS NOT NULL AND effective_to <= ${at}
          THEN ${CheckInStreakConfigStatusEnum.EXPIRED}
        ELSE ${CheckInStreakConfigStatusEnum.ACTIVE}
      END
    `
  }

  // 生成代表行窗口函数的排序表达式。
  private buildRepresentativeRowOrderBySql(status: StreakRulePageStatus): SQL {
    if (status === CheckInStreakConfigStatusEnum.SCHEDULED) {
      return sql`effective_from ASC, version DESC, id ASC`
    }

    if (status === undefined) {
      return sql`
        CASE
          WHEN resolved_status = ${CheckInStreakConfigStatusEnum.ACTIVE}
            THEN 0
          ELSE 1
        END ASC,
        version DESC,
        id DESC
      `
    }

    return sql`version DESC, id DESC`
  }

  // 统一把 Drizzle execute 结果收敛成强类型行数组。
  private extractExecutedRows<T>(result: CheckInExecutedRowsResult<T>) {
    if (!result || typeof result !== 'object' || !('rows' in result)) {
      return []
    }

    const rows = (result as { rows?: T[] | null }).rows
    return Array.isArray(rows) ? rows : []
  }

  // 批量构建规则详情视图。
  // 这里一次性补齐奖励项和动态状态，避免列表页按行重复查询。
  private async buildStreakRuleDetailViews(
    rules: StreakRulePageRow[],
    at = new Date(),
  ) {
    if (rules.length === 0) {
      return []
    }

    const loadedRules = await this.checkInStreakService.loadStreakRewardRuleRowsByIds(
      rules.map((rule) => rule.id),
    )
    const loadedRuleMap = new Map(loadedRules.map((rule) => [rule.id, rule]))

    return rules.map((rule) => {
      const ruleWithItems = loadedRuleMap.get(rule.id)
      if (!ruleWithItems) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_NOT_FOUND,
          '连续签到记录不存在',
        )
      }

      const definition = this.checkInRewardPolicyService.parseStreakRuleDefinition(
        {
        ...ruleWithItems,
        rewardItems: this.checkInRewardPolicyService.parseRewardItems(
          ruleWithItems.rewardItems.map((item) => ({
            amount: item.amount,
            assetKey: item.assetKey,
            assetType: item.assetType,
          })),
          {
            allowEmpty: false,
          },
        )!,
      },
      )
      const status = this.checkInStreakService.resolveStreakRuleStatus(
        ruleWithItems,
        at,
      )

      return {
        id: rule.id,
        ruleCode: definition.ruleCode,
        streakDays: definition.streakDays,
        version: definition.version,
        status,
        publishStrategy: definition.publishStrategy,
        isCurrent: status === CheckInStreakConfigStatusEnum.ACTIVE,
        effectiveFrom: definition.effectiveFrom,
        effectiveTo: definition.effectiveTo,
        rewardItems: definition.rewardItems,
        repeatable: definition.repeatable,
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt,
      }
    })
  }

  // 根据发布策略解析规则真正的生效时间。
  private resolvePublishEffectiveFrom(
    dto: CheckInPublishEffectiveInput,
    now: Date,
  ) {
    if (dto.publishStrategy === CheckInStreakPublishStrategyEnum.IMMEDIATE) {
      return now
    }

    if (dto.publishStrategy === CheckInStreakPublishStrategyEnum.NEXT_DAY) {
      return startOfNextDayInAppTimeZone(now)
    }

    if (!dto.effectiveFrom) {
      throw new BadRequestException('指定生效时间不能为空')
    }

    const effectiveFrom = new Date(dto.effectiveFrom)
    if (Number.isNaN(effectiveFrom.getTime())) {
      throw new BadRequestException('指定生效时间非法')
    }
    if (effectiveFrom <= now) {
      throw new BadRequestException('指定生效时间必须晚于当前时间')
    }
    return effectiveFrom
  }

  // 根据生效时间推导新发布规则的初始状态。
  private resolvePublishedRuleStatus(effectiveFrom: Date) {
    return effectiveFrom > new Date()
      ? CheckInStreakConfigStatusEnum.SCHEDULED
      : CheckInStreakConfigStatusEnum.ACTIVE
  }
}
