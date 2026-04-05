import type { SQL } from 'drizzle-orm'
import { DrizzleService } from '@db/core'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import { GrowthRuleTypeEnum } from '../growth-rule.constant'
import {
  CreateUserPointRuleDto,
  QueryUserPointRuleDto,
  UpdateUserPointRuleDto,
} from './dto/point-rule.dto'

@Injectable()
export class UserPointRuleService {
  constructor(private readonly drizzle: DrizzleService) {}

  /** 数据库连接实例。 */
  private get db() {
    return this.drizzle.db
  }

  /** 积分规则表。 */
  get userPointRule() {
    return this.drizzle.schema.userPointRule
  }

  /**
   * 创建积分规则。
   * 写入前统一校验业务语义，重复 rule type 通过 `withErrorHandling` 转换为稳定业务异常。
   */
  async createPointRule(dto: CreateUserPointRuleDto) {
    this.validatePointRuleWrite(dto)

    await this.drizzle.withErrorHandling(
      () => this.db.insert(this.userPointRule).values(dto),
      {
        duplicate: '积分规则类型已存在',
      },
    )
    return true
  }

  /**
   * 分页查询积分规则。
   * 支持按 rule type 与启用状态筛选，未命中筛选条件时返回全部规则。
   */
  async getPointRulePage(queryPointRuleDto: QueryUserPointRuleDto) {
    const conditions: SQL[] = []

    if (queryPointRuleDto.type !== undefined) {
      conditions.push(eq(this.userPointRule.type, queryPointRuleDto.type))
    }
    if (queryPointRuleDto.isEnabled !== undefined) {
      conditions.push(
        eq(this.userPointRule.isEnabled, queryPointRuleDto.isEnabled),
      )
    }

    return this.drizzle.ext.findPagination(this.userPointRule, {
      where: conditions.length > 0 ? and(...conditions) : undefined,
      ...queryPointRuleDto,
    })
  }

  /**
   * 获取积分规则详情。
   * 未命中时抛出业务异常，避免后台把空结果误当成可编辑规则。
   */
  async getPointRuleDetail(id: number) {
    const [rule] = await this.db
      .select()
      .from(this.userPointRule)
      .where(eq(this.userPointRule.id, id))
      .limit(1)

    if (!rule) {
      throw new BadRequestException('Point rule not found')
    }

    return rule
  }

  /**
   * 更新积分规则。
   * 更新前复用同一套业务校验；若命中重复 rule type，则返回稳定业务提示而非数据库异常。
   */
  async updatePointRule(dto: UpdateUserPointRuleDto) {
    this.validatePointRuleWrite(dto)

    const { id, ...updateData } = dto

    const result = await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.userPointRule)
          .set(updateData)
          .where(eq(this.userPointRule.id, id)),
      {
        duplicate: 'Rule type already exists',
      },
    )
    this.drizzle.assertAffectedRows(result, 'Point rule not found')
    return true
  }

  /**
   * 按规则类型获取已启用的积分规则。
   * 供积分发放主链路使用，只返回启用中的单条匹配规则。
   */
  async getEnabledRuleByType(ruleType: GrowthRuleTypeEnum) {
    const [rule] = await this.db
      .select()
      .from(this.userPointRule)
      .where(
        and(
          eq(this.userPointRule.type, ruleType),
          eq(this.userPointRule.isEnabled, true),
        ),
      )
      .limit(1)
    return rule
  }

  /**
   * 统一校验积分规则写入语义。
   *
   * point rule 只承载“发奖规则”，因此 points 必须是正整数，
   * dailyLimit / totalLimit 只允许非负整数。
   */
  private validatePointRuleWrite(
    dto: Pick<
      CreateUserPointRuleDto | UpdateUserPointRuleDto,
      'type' | 'points' | 'dailyLimit' | 'totalLimit'
    >,
  ) {
    if (
      dto.type !== undefined
      && !Object.values(GrowthRuleTypeEnum).includes(dto.type)
    ) {
      throw new BadRequestException('无效的积分规则类型')
    }
    if (dto.points !== undefined) {
      this.validatePositiveInteger(dto.points, '积分规则值')
    }
    if (dto.dailyLimit !== undefined) {
      this.validateNonNegativeInteger(dto.dailyLimit, '积分规则每日上限')
    }
    if (dto.totalLimit !== undefined) {
      this.validateNonNegativeInteger(dto.totalLimit, '积分规则总上限')
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
