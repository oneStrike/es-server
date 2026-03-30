import type { SQL } from 'drizzle-orm'
import type {
  CreateUserPointRuleInput,
  QueryUserPointRulePageInput,
  UpdateUserPointRuleInput,
} from './point.type'
import { DrizzleService } from '@db/core'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import { GrowthRuleTypeEnum } from '../growth-rule.constant'

@Injectable()
export class UserPointRuleService {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  get userPointRule() {
    return this.drizzle.schema.userPointRule
  }

  async createPointRule(dto: CreateUserPointRuleInput) {
    this.validatePointRuleWrite(dto)

    await this.drizzle.withErrorHandling(
      () => this.db.insert(this.userPointRule).values(dto),
      {
        duplicate: '积分规则类型已存在',
      },
    )
    return true
  }

  async getPointRulePage(queryPointRuleDto: QueryUserPointRulePageInput) {
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

  async updatePointRule(dto: UpdateUserPointRuleInput) {
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
      CreateUserPointRuleInput,
      'type' | 'points' | 'dailyLimit' | 'totalLimit'
    >,
  ) {
    if (!Object.values(GrowthRuleTypeEnum).includes(dto.type)) {
      throw new BadRequestException('无效的积分规则类型')
    }
    this.validatePositiveInteger(dto.points, '积分规则值')
    this.validateNonNegativeInteger(dto.dailyLimit, '积分规则每日上限')
    this.validateNonNegativeInteger(dto.totalLimit, '积分规则总上限')
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
