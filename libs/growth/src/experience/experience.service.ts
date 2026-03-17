import { DrizzleService } from '@db/core'
import { UserStatusEnum } from '@libs/platform/constant'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq, gt, gte, sql } from 'drizzle-orm'
import { GrowthAssetTypeEnum } from '../growth-ledger/growth-ledger.constant'
import { GrowthLedgerService } from '../growth-ledger/growth-ledger.service'
import {
  AddUserExperienceDto,
  QueryUserExperienceRecordDto,
} from './dto/experience-record.dto'
import {
  CreateUserExperienceRuleDto,
  QueryUserExperienceRuleDto,
  UpdateUserExperienceRuleDto,
} from './dto/experience-rule.dto'

/**
 * 经验服务类
 * 对外保留原方法，内部统一走 GrowthLedger。
 */
@Injectable()
export class UserExperienceService {
  constructor(
    private readonly growthLedgerService: GrowthLedgerService,
    private readonly drizzle: DrizzleService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  private get growthLedgerRecord() {
    return this.drizzle.schema.growthLedgerRecord
  }

  /**
   * 获取经验规则数据库访问器
   */
  get userExperienceRule() {
    return this.drizzle.schema.userExperienceRule
  }

  /**
   * 获取用户资料数据库访问器
   */
  get appUser() {
    return this.drizzle.schema.appUser
  }

  /**
   * 创建经验规则
   * @param dto 创建规则的数据
   * @returns 创建的规则信息
   */
  async createExperienceRule(dto: CreateUserExperienceRuleDto) {
    const rows = await this.drizzle.withErrorHandling(
      () => this.db.insert(this.userExperienceRule).values(dto).returning(),
      {
        duplicate: 'Experience rule type already exists',
      },
    )
    return rows[0]
  }

  /**
   * 分页查询经验规则列表
   * @param dto 查询条件
   * @returns 分页的规则列表
   */
  async getExperienceRulePage(dto: QueryUserExperienceRuleDto) {
    return this.drizzle.ext.findPagination(this.userExperienceRule, {
      where: this.drizzle.buildWhere(this.userExperienceRule, {
        and: {
          isEnabled: dto.isEnabled,
          type: dto.type,
        },
      }),
      ...dto,
    })
  }

  /**
   * 获取经验规则详情
   * @param id 规则ID
   * @returns 规则详情信息
   */
  async getExperienceRuleDetail(id: number) {
    const [rule] = await this.db
      .select()
      .from(this.userExperienceRule)
      .where(eq(this.userExperienceRule.id, id))
      .limit(1)

    if (!rule) {
      throw new BadRequestException('经验规则不存在')
    }

    return rule
  }

  /**
   * 更新经验规则
   * @param dto 更新规则的数据
   * @returns 更新后的规则信息
   */
  async updateExperienceRule(dto: UpdateUserExperienceRuleDto) {
    const { id, ...updateData } = dto
    const rows = await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.userExperienceRule)
          .set(updateData)
          .where(eq(this.userExperienceRule.id, id))
          .returning(),
      {
        duplicate: 'Experience rule type already exists',
      },
    )
    this.drizzle.assertAffectedRows(rows, '经验规则不存在')
    return rows[0]
  }

  /**
   * 删除经验规则
   * @param id 规则ID
   * @returns 删除结果
   */
  async deleteExperienceRule(id: number) {
    const [rule] = await this.db
      .select({ id: this.userExperienceRule.id })
      .from(this.userExperienceRule)
      .where(eq(this.userExperienceRule.id, id))
      .limit(1)

    if (!rule) {
      throw new BadRequestException('经验规则不存在')
    }

    const rows = await this.db
      .delete(this.userExperienceRule)
      .where(eq(this.userExperienceRule.id, id))
      .returning()
    return rows[0]
  }

  /**
   * 增加经验
   * @param addExperienceDto 增加经验的数据
   * @returns 增加经验的结果
   */
  async addExperience(
    addExperienceDto: AddUserExperienceDto & {
      bizKey?: string
      source?: string
      targetType?: number
      targetId?: number
    },
  ) {
    const { userId, ruleType, remark } = addExperienceDto

    const user = await this.db.query.appUser.findFirst({
      where: {
        id: userId,
      },
      columns: { id: true, status: true },
    })

    if (!user || user.status === UserStatusEnum.PERMANENT_BANNED) {
      throw new BadRequestException('用户不存在或已被永久封禁')
    }

    const bizKey =
      addExperienceDto.bizKey
      ?? this.buildStableBizKey('experience:rule', {
        userId,
        ruleType,
        targetType: addExperienceDto.targetType,
        targetId: addExperienceDto.targetId,
        remark,
        source: addExperienceDto.source,
      })

    return this.db.transaction(async (tx) => {
      const result = await this.growthLedgerService.applyByRule(tx, {
        userId,
        assetType: GrowthAssetTypeEnum.EXPERIENCE,
        ruleType,
        bizKey,
        remark,
        targetType: addExperienceDto.targetType,
        targetId: addExperienceDto.targetId,
      })

      if (!result.success && !result.duplicated) {
        throw new BadRequestException(this.mapRuleFailReason(result.reason))
      }

      const recordId = result.recordId
      if (!recordId) {
        throw new BadRequestException('经验发放失败')
      }

      const record = await tx.query.growthLedgerRecord.findFirst({
        where: { id: recordId },
      })
      if (!record) {
        throw new BadRequestException('经验记录不存在')
      }

      return this.toExperienceRecord(record)
    })
  }

  /**
   * 分页查询经验记录列表
   * @param dto 查询条件
   * @returns 分页的记录列表
   */
  async getExperienceRecordPage(dto: QueryUserExperienceRecordDto) {
    const page = await this.drizzle.ext.findPagination(this.growthLedgerRecord, {
      where: this.drizzle.buildWhere(this.growthLedgerRecord, {
        and: {
          userId: dto.userId,
          ruleId: dto.ruleId,
          assetType: GrowthAssetTypeEnum.EXPERIENCE,
        },
      }),
      ...dto,
      orderBy: dto.orderBy ?? JSON.stringify([{ id: 'desc' }]),
    })

    return {
      ...page,
      list: page.list.map((item) => this.toExperienceRecord(item)),
    }
  }

  /**
   * 获取用户经验记录详情
   * @param id 记录ID
   * @returns 记录详情信息
   */
  async getExperienceRecordDetail(id: number) {
    const record = await this.db.query.growthLedgerRecord.findFirst({
      where: {
        id,
        assetType: GrowthAssetTypeEnum.EXPERIENCE,
      },
      with: {
        user: true,
      },
    })

    if (!record) {
      throw new BadRequestException('经验记录不存在')
    }

    return {
      ...this.toExperienceRecord(record),
      user: record.user,
    }
  }

  /**
   * 获取用户经验统计
   * @param userId 用户ID
   * @returns 经验统计信息
   */
  async getUserExperienceStats(userId: number) {
    const user = await this.db.query.appUser.findFirst({
      where: { id: userId },
      with: {
        level: true,
      },
    })

    if (!user) {
      throw new BadRequestException('用户不存在')
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [todayEarned] = await this.db
      .select({
        total: sql<number>`coalesce(sum(${this.growthLedgerRecord.delta}), 0)`,
      })
      .from(this.growthLedgerRecord)
      .where(
        and(
          eq(this.growthLedgerRecord.userId, userId),
          eq(this.growthLedgerRecord.assetType, GrowthAssetTypeEnum.EXPERIENCE),
          gt(this.growthLedgerRecord.delta, 0),
          gte(this.growthLedgerRecord.createdAt, today),
        ),
      )

    return {
      currentExperience: user.experience,
      todayEarned: Number(todayEarned?.total ?? 0),
      level: user.level,
    }
  }

  private toExperienceRecord(record: {
    id: number
    userId: number
    ruleId: number | null
    delta: number
    beforeValue: number
    afterValue: number
    remark: string | null
    createdAt: Date
    updatedAt?: Date
  }) {
    return {
      id: record.id,
      userId: record.userId,
      ruleId: record.ruleId ?? undefined,
      experience: record.delta,
      beforeExperience: record.beforeValue,
      afterExperience: record.afterValue,
      remark: record.remark ?? undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  }

  private mapRuleFailReason(reason?: string) {
    const reasonMap: Record<string, string> = {
      rule_not_found: 'Experience rule not found',
      rule_disabled: 'Experience rule is disabled',
      rule_zero: 'Invalid experience rule config',
      daily_limit: 'Daily experience limit reached',
      total_limit: 'Total experience limit reached',
    }

    return reason ? (reasonMap[reason] ?? 'Experience grant failed') : 'Experience grant failed'
  }

  private buildStableBizKey(
    prefix: string,
    payload: Record<string, unknown>,
  ) {
    const serializedPayload = Object.entries(payload)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}=${String(value)}`)
      .sort()
      .join('|')
    return `${prefix}:${serializedPayload}`
  }
}
