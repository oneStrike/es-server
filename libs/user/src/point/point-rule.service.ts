import { BaseService } from '@libs/base/database'
import { BadRequestException, Injectable } from '@nestjs/common'
import { GrowthRuleTypeEnum } from '../growth-rule.constant'
import {
  CreateUserPointRuleDto,
  QueryUserPointRuleDto,
  UpdateUserPointRuleDto,
} from './dto/point-rule.dto'

@Injectable()
export class UserPointRuleService extends BaseService {
  get userPointRule() {
    return this.prisma.userPointRule
  }

  async createPointRule(dto: CreateUserPointRuleDto) {
    if (!Object.values(GrowthRuleTypeEnum).includes(dto.type)) {
      throw new BadRequestException('Invalid point rule type')
    }

    try {
      return await this.userPointRule.create({
        data: dto,
      })
    } catch (error) {
      this.handlePrismaError(error, {
        P2002: () => {
          throw new BadRequestException('Rule type already exists')
        },
      })
    }
  }

  async getPointRulePage(queryPointRuleDto: QueryUserPointRuleDto) {
    return this.userPointRule.findPagination({
      where: queryPointRuleDto,
    })
  }

  async getPointRuleDetail(id: number) {
    const rule = await this.userPointRule.findUnique({
      where: { id },
    })

    if (!rule) {
      throw new BadRequestException('Point rule not found')
    }

    return rule
  }

  async updatePointRule(dto: UpdateUserPointRuleDto) {
    if (!Object.values(GrowthRuleTypeEnum).includes(dto.type)) {
      throw new BadRequestException('Invalid point rule type')
    }

    const { id, ...updateData } = dto

    try {
      return await this.userPointRule.update({
        where: { id },
        data: updateData,
      })
    } catch (error) {
      this.handlePrismaError(error, {
        P2002: () => {
          throw new BadRequestException('Rule type already exists')
        },
        P2025: () => {
          throw new BadRequestException('Point rule not found')
        },
      })
    }
  }

  async getEnabledRuleByType(ruleType: GrowthRuleTypeEnum) {
    return this.userPointRule.findUnique({
      where: {
        type: ruleType,
        isEnabled: true,
      },
    })
  }
}
