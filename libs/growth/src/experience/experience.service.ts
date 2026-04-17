import type { SQL } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { DrizzleService } from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { startOfTodayInAppTimeZone } from '@libs/platform/utils/time'
import { UserStatusEnum } from '@libs/user/app-user.constant'
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common'
import { and, eq, gt, gte, isNull, sql } from 'drizzle-orm'
import {
  GrowthAssetTypeEnum,
  GrowthLedgerFailReasonLabel,
  GrowthLedgerSourceEnum,
} from '../growth-ledger/growth-ledger.constant'
import { GrowthLedgerService } from '../growth-ledger/growth-ledger.service'
import { GrowthRuleTypeEnum } from '../growth-rule.constant'
import { UserGrowthRuleActionDto } from '../growth/dto/growth-shared.dto'
import {
  QueryUserExperienceRecordDto,
  UserExperienceRecordDto,
} from './dto/experience-record.dto'
import {
  CreateUserExperienceRuleDto,
  QueryUserExperienceRuleDto,
  UpdateUserExperienceRuleDto,
} from './dto/experience-rule.dto'

const UUID_HYPHEN_REGEX = /-/g

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
    this.validateExperienceRuleWrite(dto)
    await this.drizzle.withErrorHandling(
      () => this.db.insert(this.userExperienceRule).values(dto),
      {
        duplicate: 'Experience rule type already exists',
      },
    )
    return true
  }

  /**
   * 分页查询经验规则列表
   * @param dto 查询条件
   * @returns 分页的规则列表
   */
  async getExperienceRulePage(dto: QueryUserExperienceRuleDto) {
    const conditions: SQL[] = []

    if (dto.isEnabled !== undefined) {
      conditions.push(eq(this.userExperienceRule.isEnabled, dto.isEnabled))
    }
    if (dto.type !== undefined) {
      conditions.push(eq(this.userExperienceRule.type, dto.type))
    }

    return this.drizzle.ext.findPagination(this.userExperienceRule, {
      where: conditions.length > 0 ? and(...conditions) : undefined,
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
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '经验规则不存在',
      )
    }

    return rule
  }

  /**
   * 更新经验规则
   * @param dto 更新规则的数据
   * @returns 更新后的规则信息
   */
  async updateExperienceRule(dto: UpdateUserExperienceRuleDto) {
    this.validateExperienceRuleWrite(dto)
    const { id, ...updateData } = dto
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.userExperienceRule)
          .set(updateData)
          .where(eq(this.userExperienceRule.id, id)),
      {
        duplicate: 'Experience rule type already exists',
        notFound: '经验规则不存在',
      },
    )
    return true
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
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '经验规则不存在',
      )
    }

    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .delete(this.userExperienceRule)
          .where(eq(this.userExperienceRule.id, id)),
      { notFound: '经验规则不存在' },
    )
    return true
  }

  /**
   * 增加经验
   * @param addExperienceDto 增加经验的数据
   * @returns 增加经验的结果
   */
  async addExperience(
    addExperienceDto: UserGrowthRuleActionDto & {
      bizKey?: string
      source?: string
      targetType?: number
      targetId?: number
      context?: Record<string, unknown>
      adminUserId?: number
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
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '用户不存在或已被永久封禁',
      )
    }

    const source = addExperienceDto.source ?? GrowthLedgerSourceEnum.GROWTH_RULE
    const context = this.buildAddExperienceContext(addExperienceDto)
    const bizKey =
      addExperienceDto.bizKey ??
      this.buildAddExperienceBizKey({
        userId,
        ruleType,
        targetType: addExperienceDto.targetType,
        targetId: addExperienceDto.targetId,
        remark,
        source,
        adminUserId: addExperienceDto.adminUserId,
      })

    await this.drizzle.withTransaction(async (tx) => {
      const result = await this.growthLedgerService.applyByRule(tx, {
        userId,
        assetType: GrowthAssetTypeEnum.EXPERIENCE,
        ruleType,
        bizKey,
        source,
        remark,
        targetType: addExperienceDto.targetType,
        targetId: addExperienceDto.targetId,
        context,
      })

      if (!result.success && !result.duplicated) {
        this.throwExperienceGrantFailure(result.reason)
      }

      const recordId = result.recordId
      if (!recordId) {
        throw new InternalServerErrorException('经验发放失败')
      }

      const record = await tx.query.growthLedgerRecord.findFirst({
        where: { id: recordId },
      })
      if (!record) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_NOT_FOUND,
          '经验记录不存在',
        )
      }
    })
    return true
  }

  /**
   * 分页查询经验记录列表
   * @param dto 查询条件
   * @returns 分页的记录列表
   */
  async getExperienceRecordPage(dto: QueryUserExperienceRecordDto) {
    const conditions: SQL[] = [
      eq(this.growthLedgerRecord.userId, dto.userId),
      eq(this.growthLedgerRecord.assetType, GrowthAssetTypeEnum.EXPERIENCE),
    ]

    if (dto.ruleId !== undefined) {
      conditions.push(
        dto.ruleId === null
          ? isNull(this.growthLedgerRecord.ruleId)
          : eq(this.growthLedgerRecord.ruleId, dto.ruleId),
      )
    }
    // 历史上这里走 JSON 字符串默认排序，现统一收口为字面量对象，减少调用层分支。
    const orderBy = dto.orderBy?.trim() ? dto.orderBy : { id: 'desc' as const }

    const page = await this.drizzle.ext.findPagination(
      this.growthLedgerRecord,
      {
        where: and(...conditions),
        ...dto,
        orderBy,
      },
    )

    return {
      ...page,
      list: page.list.map((item) =>
        this.toExperienceRecord(
          item as typeof item & { context?: Record<string, unknown> | null },
        ),
      ),
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
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '经验记录不存在',
      )
    }

    return {
      ...this.toExperienceRecord(
        record as typeof record & { context?: Record<string, unknown> | null },
      ),
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
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '用户不存在',
      )
    }

    const today = startOfTodayInAppTimeZone()

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
    ruleType?: number | null
    source?: string | null
    targetType?: number | null
    targetId?: number | null
    delta: number
    beforeValue: number
    afterValue: number
    bizKey?: string
    remark: string | null
    context?: Record<string, unknown> | null
    createdAt: Date
    updatedAt?: Date
  }): UserExperienceRecordDto {
    return {
      id: record.id,
      userId: record.userId,
      ruleId: record.ruleId ?? undefined,
      ruleType: record.ruleType ?? undefined,
      source: record.source ?? undefined,
      targetType: record.targetType ?? undefined,
      targetId: record.targetId ?? undefined,
      bizKey: record.bizKey ?? '',
      context: this.growthLedgerService.sanitizePublicContext(record.context),
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
      rule_zero: 'Experience rule value must be greater than 0',
      daily_limit: 'Daily experience limit reached',
      total_limit: 'Total experience limit reached',
    }

    return reason
      ? (reasonMap[reason] ?? 'Experience grant failed')
      : 'Experience grant failed'
  }

  /** 按成长账本拒绝原因映射经验发放失败语义。 */
  private throwExperienceGrantFailure(
    reason?: keyof typeof GrowthLedgerFailReasonLabel,
  ): never {
    if (!reason) {
      throw new InternalServerErrorException('经验发放失败')
    }

    if (reason === 'rule_not_found') {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        this.mapRuleFailReason(reason),
      )
    }

    if (reason === 'daily_limit' || reason === 'total_limit') {
      throw new BusinessException(
        BusinessErrorCode.QUOTA_NOT_ENOUGH,
        this.mapRuleFailReason(reason),
      )
    }

    if (reason === 'rule_disabled' || reason === 'cooldown') {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        this.mapRuleFailReason(reason),
      )
    }

    throw new InternalServerErrorException(this.mapRuleFailReason(reason))
  }

  private buildStableBizKey(prefix: string, payload: Record<string, unknown>) {
    const serializedPayload = Object.entries(payload)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}=${String(value)}`)
      .sort()
      .join('|')
    return `${prefix}:${serializedPayload}`
  }

  private buildAddExperienceBizKey(params: {
    userId: number
    ruleType: GrowthRuleTypeEnum
    targetType?: number
    targetId?: number
    remark?: string
    source: string
    adminUserId?: number
  }) {
    if (this.isAdminManualGrantSource(params.source)) {
      return this.buildManualGrantBizKey(params.userId, params.adminUserId)
    }

    return this.buildStableBizKey('experience:rule', {
      userId: params.userId,
      ruleType: params.ruleType,
      targetType: params.targetType,
      targetId: params.targetId,
      remark: params.remark,
      source: params.source,
    })
  }

  private buildManualGrantBizKey(userId: number, adminUserId?: number) {
    return `experience:manual-grant:user:${userId}:admin:${adminUserId ?? 0}:ts:${Date.now()}:rand:${randomUUID().replace(UUID_HYPHEN_REGEX, '')}`
  }

  private buildAddExperienceContext(
    addExperienceDto: Pick<UserGrowthRuleActionDto, never> & {
      context?: Record<string, unknown>
      adminUserId?: number
    },
  ) {
    if (
      !addExperienceDto.context &&
      addExperienceDto.adminUserId === undefined
    ) {
      return undefined
    }

    return {
      ...(addExperienceDto.context ?? {}),
      actorUserId: addExperienceDto.adminUserId,
    }
  }

  private isAdminManualGrantSource(source: string) {
    return source === 'admin_experience_rule_grant'
  }

  /**
   * 统一校验经验规则写入语义。
   *
   * experience rule 只承载“发奖规则”，因此 experience 必须是正整数，
   * dailyLimit / totalLimit 只允许非负整数。
   */
  private validateExperienceRuleWrite(
    dto: Pick<
      UpdateUserExperienceRuleDto,
      'type' | 'experience' | 'dailyLimit' | 'totalLimit'
    >,
  ) {
    if (
      dto.type !== undefined &&
      !Object.values(GrowthRuleTypeEnum).includes(dto.type)
    ) {
      throw new BadRequestException('经验规则类型无效')
    }
    if (dto.experience !== undefined) {
      this.validatePositiveInteger(dto.experience, '经验规则值')
    }
    if (dto.dailyLimit !== undefined) {
      this.validateNonNegativeInteger(dto.dailyLimit, '经验规则每日上限')
    }
    if (dto.totalLimit !== undefined) {
      this.validateNonNegativeInteger(dto.totalLimit, '经验规则总上限')
    }
  }

  /**
   * 校验必须为正整数的数值字段。
   */
  private validatePositiveInteger(value: number, fieldLabel: string) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new BadRequestException(`${fieldLabel}必须是大于0的整数`)
    }
  }

  /**
   * 校验必须为非负整数的数值字段。
   */
  private validateNonNegativeInteger(value: number, fieldLabel: string) {
    if (!Number.isInteger(value) || value < 0) {
      throw new BadRequestException(`${fieldLabel}必须是大于等于0的整数`)
    }
  }
}
