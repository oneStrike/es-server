import type { GrowthRewardRuleSelect } from '@db/schema'
import type { SQL } from 'drizzle-orm'
import { DrizzleService, toPageResult } from '@db/core'
import { EventDefinitionService } from '@libs/growth/event-definition/event-definition.service'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import { GrowthRuleTypeEnum } from '../growth-rule.constant'
import {
  ArchiveGrowthRewardRuleDto,
  CreateGrowthRewardRuleDto,
  GrowthRewardRuleArchiveStatusEnum,
  QueryGrowthRewardRuleDto,
  UpdateGrowthRewardRuleDto,
} from './dto/reward-rule.dto'
import { GrowthRewardRuleAssetTypeEnum } from './reward-rule.constant'

@Injectable()
export class GrowthRewardRuleService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly eventDefinitionService: EventDefinitionService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  private get growthRewardRule() {
    return this.drizzle.schema.growthRewardRule
  }

  async createRewardRule(dto: CreateGrowthRewardRuleDto) {
    const normalizedDto = this.normalizeWriteDto(dto)
    this.validateRewardRuleWrite(normalizedDto)
    await this.drizzle.withErrorHandling(
      () => this.db.insert(this.growthRewardRule).values(normalizedDto),
      {
        duplicate: '成长奖励规则已存在',
      },
    )
    return true
  }

  async getRewardRulePage(dto: QueryGrowthRewardRuleDto) {
    const conditions: SQL[] = []

    if (dto.type !== undefined) {
      conditions.push(eq(this.growthRewardRule.type, dto.type))
    }
    if (dto.assetType !== undefined) {
      conditions.push(eq(this.growthRewardRule.assetType, dto.assetType))
    }
    if (dto.isEnabled !== undefined) {
      conditions.push(eq(this.growthRewardRule.isEnabled, dto.isEnabled))
    }
    const archiveStatus =
      dto.status ?? GrowthRewardRuleArchiveStatusEnum.ACTIVE
    if (archiveStatus === GrowthRewardRuleArchiveStatusEnum.ACTIVE) {
      conditions.push(isNull(this.growthRewardRule.archivedAt))
    } else if (archiveStatus === GrowthRewardRuleArchiveStatusEnum.ARCHIVED) {
      conditions.push(isNotNull(this.growthRewardRule.archivedAt))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined
    const page = this.drizzle.buildPage(dto)
    const orderQuery = this.drizzle.buildOrderBy(dto.orderBy, {
      table: this.growthRewardRule,
    })
    const [list, total] = await Promise.all([
      this.db
        .select()
        .from(this.growthRewardRule)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(page.limit)
        .offset(page.offset),
      this.db.$count(this.growthRewardRule, where),
    ])

    return toPageResult(
      list.map((item) => this.toRewardRuleOutputDto(item)),
      total,
      page,
    )
  }

  async getRewardRuleDetail(id: number) {
    const [rule] = await this.db
      .select()
      .from(this.growthRewardRule)
      .where(eq(this.growthRewardRule.id, id))
      .limit(1)

    if (!rule) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '成长奖励规则不存在',
      )
    }

    return this.toRewardRuleOutputDto(rule)
  }

  async updateRewardRule(dto: UpdateGrowthRewardRuleDto) {
    const existingRule = await this.getRewardRuleDetail(dto.id)
    this.assertRewardRuleActive(existingRule.archivedAt)
    const { id, ...rest } = dto
    const normalizedRest = this.normalizeWriteDto(rest)
    this.validateRewardRuleWrite({
      type: normalizedRest.type ?? existingRule.type,
      assetType: normalizedRest.assetType ?? existingRule.assetType,
      assetKey: normalizedRest.assetKey ?? existingRule.assetKey,
      delta: normalizedRest.delta ?? existingRule.delta,
      dailyLimit: normalizedRest.dailyLimit ?? existingRule.dailyLimit,
      totalLimit: normalizedRest.totalLimit ?? existingRule.totalLimit,
    })
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.growthRewardRule)
          .set(normalizedRest)
          .where(eq(this.growthRewardRule.id, id)),
      {
        duplicate: '成长奖励规则已存在',
        notFound: '成长奖励规则不存在',
      },
    )
    return true
  }

  async archiveRewardRule(
    dto: ArchiveGrowthRewardRuleDto,
    adminUserId?: number,
  ) {
    const existingRule = await this.getRewardRuleDetail(dto.id)
    if (existingRule.archivedAt) {
      return true
    }

    const now = new Date()
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.growthRewardRule)
          .set({
            isEnabled: false,
            archivedAt: now,
            archivedBy: adminUserId ?? null,
            archiveReasonCode: 'OPERATOR_ARCHIVE',
            archiveReason: dto.archiveReason?.trim() || '运营归档成长奖励规则',
            updatedAt: now,
          })
          .where(
            and(
              eq(this.growthRewardRule.id, dto.id),
              isNull(this.growthRewardRule.archivedAt),
            ),
          ),
      {
        notFound: '成长奖励规则不存在',
      },
    )
    return true
  }

  private normalizeWriteDto<T extends Partial<CreateGrowthRewardRuleDto>>(dto: T) {
    return {
      ...dto,
      assetKey:
        typeof dto.assetKey === 'string' ? dto.assetKey.trim() : undefined,
    }
  }

  private validateRewardRuleWrite(
    dto: Partial<CreateGrowthRewardRuleDto>,
  ) {
    if (
      dto.type !== undefined &&
      !Object.values(GrowthRuleTypeEnum).includes(dto.type)
    ) {
      throw new BadRequestException('成长奖励规则类型无效')
    }
    if (
      dto.assetType !== undefined &&
      !Object.values(GrowthRewardRuleAssetTypeEnum).includes(dto.assetType)
    ) {
      throw new BadRequestException('成长奖励资产类型无效')
    }
    if (dto.delta !== undefined) {
      if (!Number.isInteger(dto.delta) || dto.delta <= 0) {
        throw new BadRequestException('成长奖励规则 delta 必须是正整数')
      }
    }
    if (dto.dailyLimit !== undefined) {
      if (!Number.isInteger(dto.dailyLimit) || dto.dailyLimit < 0) {
        throw new BadRequestException('成长奖励规则每日上限必须是大于等于 0 的整数')
      }
    }
    if (dto.totalLimit !== undefined) {
      if (!Number.isInteger(dto.totalLimit) || dto.totalLimit < 0) {
        throw new BadRequestException('成长奖励规则总上限必须是大于等于 0 的整数')
      }
    }
    if (
      dto.assetKey !== undefined &&
      (typeof dto.assetKey !== 'string' || dto.assetKey.length > 64)
    ) {
      throw new BadRequestException('成长奖励规则 assetKey 非法')
    }

    if (dto.assetType === undefined) {
      return
    }

    const normalizedAssetKey = dto.assetKey ?? ''
    if (
      (
        dto.assetType === GrowthRewardRuleAssetTypeEnum.POINTS
        || dto.assetType === GrowthRewardRuleAssetTypeEnum.EXPERIENCE
      )
      && normalizedAssetKey !== ''
    ) {
      throw new BadRequestException(
        '积分/经验成长奖励规则 assetKey 必须为空字符串',
      )
    }

    if (
      (
        dto.assetType === GrowthRewardRuleAssetTypeEnum.ITEM
        || dto.assetType === GrowthRewardRuleAssetTypeEnum.CURRENCY
        || dto.assetType === GrowthRewardRuleAssetTypeEnum.LEVEL
      )
      && normalizedAssetKey === ''
    ) {
      throw new BadRequestException(
        '扩展成长奖励规则必须提供非空 assetKey',
      )
    }

    this.assertExperienceRewardRuleEventConfigurable(dto)
  }

  private assertExperienceRewardRuleEventConfigurable(
    dto: Partial<CreateGrowthRewardRuleDto>,
  ) {
    if (
      dto.assetType !== GrowthRewardRuleAssetTypeEnum.EXPERIENCE ||
      dto.type === undefined
    ) {
      return
    }

    const disabledReason =
      this.eventDefinitionService.getRuleConfigDisabledReason(dto.type)
    if (disabledReason === null) {
      return
    }

    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      `该成长事件暂不支持经验奖励规则配置：${disabledReason}`,
    )
  }

  private assertRewardRuleActive(archivedAt: Date | null) {
    if (!archivedAt) {
      return
    }

    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      '已归档的成长奖励规则不可编辑',
    )
  }

  private toRewardRuleOutputDto(rule: GrowthRewardRuleSelect) {
    return {
      ...rule,
      remark: rule.remark ?? null,
      archivedAt: rule.archivedAt ?? null,
      archivedBy: rule.archivedBy ?? null,
      archiveReasonCode: rule.archiveReasonCode ?? null,
      archiveReason: rule.archiveReason ?? null,
    }
  }
}
