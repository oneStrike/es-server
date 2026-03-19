import { DrizzleService } from '@db/core'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import { GrowthRuleTypeEnum } from '../growth-rule.constant'
import type {
  CreateUserPointRuleInput,
  QueryUserPointRulePageInput,
  UpdateUserPointRuleInput,
} from './point.type'

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
    if (!Object.values(GrowthRuleTypeEnum).includes(dto.type)) {
      throw new BadRequestException('无效的积分规则类型')
    }

    await this.drizzle.withErrorHandling(
      () => this.db.insert(this.userPointRule).values(dto),
      {
        duplicate: '积分规则类型已存在',
      },
    )
    return true
  }

  async getPointRulePage(queryPointRuleDto: QueryUserPointRulePageInput) {
    return this.drizzle.ext.findPagination(this.userPointRule, {
      where: this.drizzle.buildWhere(this.userPointRule, {
        and: queryPointRuleDto,
      }),
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
    if (!Object.values(GrowthRuleTypeEnum).includes(dto.type)) {
      throw new BadRequestException('Invalid point rule type')
    }

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
}
