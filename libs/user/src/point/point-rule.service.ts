import { BaseService } from '@libs/base/database'

import { BadRequestException, Injectable } from '@nestjs/common'
import { GrowthRuleTypeEnum } from '../growth-rule.constant'
import {
  CreateUserPointRuleDto,
  QueryUserPointRuleDto,
  UpdateUserPointRuleDto,
} from './dto/point-rule.dto'

/**
 * 积分规则服务类
 * 提供积分规则的增删改查等配置管理功能
 */
@Injectable()
export class UserPointRuleService extends BaseService {
  get userPointRule() {
    return this.prisma.userPointRule
  }

  /**
   * 创建积分规则
   * @param dto 创建规则的数据
   * @returns 创建的规则信息
   */
  async createPointRule(dto: CreateUserPointRuleDto) {
    // 校验规则类型是否存在
    if (!Object.values(GrowthRuleTypeEnum).includes(dto.type)) {
      throw new BadRequestException('积分规则类型不存在')
    }
    // 校验是否已存在相同类型规则
    if (await this.userPointRule.exists({ type: dto.type })) {
      throw new BadRequestException('已存在相同类型的积分规则')
    }
    return this.userPointRule.create({
      data: dto,
    })
  }

  /**
   * 分页查询积分规则列表
   * @param queryPointRuleDto 查询条件
   * @returns 分页的规则列表
   */
  async getPointRulePage(queryPointRuleDto: QueryUserPointRuleDto) {
    return this.userPointRule.findPagination({
      where: queryPointRuleDto,
    })
  }

  /**
   * 获取积分规则详情
   * @param id 规则ID
   * @returns 规则详情信息
   */
  async getPointRuleDetail(id: number) {
    const rule = await this.userPointRule.findUnique({
      where: { id },
    })

    if (!rule) {
      throw new BadRequestException('积分规则不存在')
    }

    return rule
  }

  /**
   * 更新积分规则
   * @param dto 更新规则的数据
   * @returns 更新后的规则信息
   */
  async updatePointRule(dto: UpdateUserPointRuleDto) {
    // 校验规则类型是否存在
    if (!Object.values(GrowthRuleTypeEnum).includes(dto.type)) {
      throw new BadRequestException('积分规则类型不存在')
    }

    const rule = await this.userPointRule.findUnique({
      where: { id: dto.id },
    })

    if (!rule) {
      throw new BadRequestException('积分规则不存在')
    }

    // 如果类型有变更，检查新类型是否已存在
    if (rule.type !== dto.type) {
      if (
        await this.userPointRule.exists({ type: dto.type, isEnabled: true })
      ) {
        throw new BadRequestException('已存在相同类型的积分规则')
      }
    }
    const { id, ...updateData } = dto

    return this.userPointRule.update({
      where: { id },
      data: updateData,
    })
  }

  /**
   * 根据规则类型获取启用的规则
   * @param ruleType 规则类型
   * @returns 规则信息或 null
   */
  async getEnabledRuleByType(ruleType: GrowthRuleTypeEnum) {
    return this.userPointRule.findUnique({
      where: {
        type: ruleType,
        isEnabled: true,
      },
    })
  }
}
