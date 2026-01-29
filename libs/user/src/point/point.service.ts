import type { AppPointRuleWhereInput } from '@libs/base/database'
import { BaseService } from '@libs/base/database'

import { BadRequestException, Injectable } from '@nestjs/common'
import {
  AddForumPointsDto,
  ConsumeForumPointsDto,
  QueryForumPointRecordDto,
} from './dto/point-record.dto'
import {
  CreateForumPointRuleDto,
  QueryForumPointRuleDto,
  UpdateForumPointRuleDto,
} from './dto/point-rule.dto'
import { ForumPointRuleTypeEnum } from './point.constant'

/**
 * 积分服务类
 * 提供论坛积分的增删改查等核心业务逻辑
 */
@Injectable()
export class ForumPointService extends BaseService {
  get forumPointRule() {
    return this.prisma.appPointRule
  }

  get forumPointRecord() {
    return this.prisma.appPointRecord
  }

  get appUser() {
    return this.prisma.appUser
  }

  /**
   * 创建积分规则
   * @param dto 创建规则的数据
   * @returns 创建的规则信息
   */
  async createPointRule(dto: CreateForumPointRuleDto) {
    return this.forumPointRule.create({
      data: dto,
    })
  }

  /**
   * 分页查询积分规则列表
   * @param queryPointRuleDto 查询条件
   * @returns 分页的规则列表
   */
  async getPointRulePage(queryPointRuleDto: QueryForumPointRuleDto) {
    const where: AppPointRuleWhereInput = queryPointRuleDto

    if (queryPointRuleDto.name) {
      where.name = {
        contains: queryPointRuleDto.name,
        mode: 'insensitive',
      }
    }

    return this.forumPointRule.findPagination({
      where,
    })
  }

  /**
   * 获取积分规则详情
   * @param id 规则ID
   * @returns 规则详情信息
   */
  async getPointRuleDetail(id: number) {
    const rule = await this.forumPointRule.findUnique({
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
  async updatePointRule(dto: UpdateForumPointRuleDto) {
    const { id, ...updateData } = dto

    return this.forumPointRule.update({
      where: { id },
      data: updateData,
    })
  }

  /**
   * 增加积分
   * @param addPointsDto 增加积分的数据
   * @returns 增加积分的结果
   */
  async addPoints(addPointsDto: AddForumPointsDto) {
    const { userId, ruleType, remark } = addPointsDto

    const user = await this.appUser.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new BadRequestException('用户不存在')
    }

    const rule = await this.forumPointRule.findUnique({
      where: {
        type: ruleType,
        isEnabled: true,
      },
    })

    if (!rule) {
      throw new BadRequestException('积分规则不存在')
    }

    if (rule.points <= 0) {
      throw new BadRequestException('积分规则配置错误')
    }

    if (rule.dailyLimit > 0) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const todayCount = await this.forumPointRecord.count({
        where: {
          userId,
          ruleId: rule.id,
          createdAt: {
            gte: today,
          },
        },
      })

      if (todayCount >= rule.dailyLimit) {
        throw new BadRequestException('今日积分已达上限')
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const beforePoints = user.points
      const afterPoints = beforePoints + rule.points

      const record = await tx.appPointRecord.create({
        data: {
          userId,
          ruleId: rule.id,
          points: rule.points,
          beforePoints,
          afterPoints,
          remark,
        },
      })

      await tx.appUser.update({
        where: { id: userId },
        data: {
          points: afterPoints,
        },
      })

      return record
    })
  }

  /**
   * 消费积分
   * @param consumePointsDto 消费积分的数据
   * @returns 消费积分的结果
   */
  async consumePoints(consumePointsDto: ConsumeForumPointsDto) {
    const { userId, points, remark } = consumePointsDto

    const user = await this.appUser.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new BadRequestException('用户不存在')
    }

    if (user.points < points) {
      throw new BadRequestException('积分不足')
    }

    return this.prisma.$transaction(async (tx) => {
      const beforePoints = user.points
      const afterPoints = beforePoints - points

      const record = await tx.appPointRecord.create({
        data: {
          userId,
          points: -points,
          beforePoints,
          afterPoints,
          remark,
        },
      })

      await tx.appUser.update({
        where: { id: userId },
        data: {
          points: afterPoints,
        },
      })

      return record
    })
  }

  /**
   * 分页查询积分记录列表
   * @param dto 查询条件
   * @returns 分页的记录列表
   */
  async getPointRecordPage(dto: QueryForumPointRecordDto) {
    const { userId, ruleId, ...otherDto } = dto
    return this.forumPointRecord.findPagination({
      where: {
        ...otherDto,
        rule: {
          id: ruleId,
        },
        user: {
          id: userId,
        },
      },
    })
  }

  /**
   * 获取用户积分记录详情
   * @param id 记录ID
   * @returns 记录详情信息
   */
  async getPointRecordDetail(id: number) {
    const record = await this.forumPointRecord.findUnique({
      where: { id },
      include: {
        user: true,
        rule: true,
      },
    })

    if (!record) {
      throw new BadRequestException('积分记录不存在')
    }

    return record
  }

  /**
   * 获取用户积分统计
   * @param userId 用户ID
   * @returns 积分统计信息
   */
  async getUserPointStats(userId: number) {
    const user = await this.appUser.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new BadRequestException('用户不存在')
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todayEarned = await this.forumPointRecord.aggregate({
      where: {
        userId,
        points: {
          gt: 0,
        },
        createdAt: {
          gte: today,
        },
      },
      _sum: {
        points: true,
      },
    })

    const todayConsumed = await this.forumPointRecord.aggregate({
      where: {
        userId,
        points: {
          lt: 0,
        },
        createdAt: {
          gte: today,
        },
      },
      _sum: {
        points: true,
      },
    })

    return {
      currentPoints: user.points,
      todayEarned: todayEarned._sum.points || 0,
      todayConsumed: Math.abs(todayConsumed._sum.points || 0),
    }
  }

  /**
   * 与漫画系统互通接口
   * @param userId 用户ID
   * @param points 积分数量
   * @param operation 操作类型（add=增加, consume=消费）
   * @returns 操作结果
   */
  async syncWithComicSystem(
    userId: number,
    points: number,
    operation: 'add' | 'consume',
  ) {
    const user = await this.appUser.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new BadRequestException('用户不存在')
    }

    if (operation === 'consume' && user.points < points) {
      throw new BadRequestException('积分不足')
    }

    return this.prisma.$transaction(async (tx) => {
      const beforePoints = user.points
      let afterPoints: number

      if (operation === 'add') {
        afterPoints = beforePoints + points
      } else {
        afterPoints = beforePoints - points
      }

      await tx.appUser.update({
        where: { id: userId },
        data: {
          points: afterPoints,
        },
      })

      return {
        success: true,
        beforePoints,
        afterPoints,
        points,
      }
    })
  }

  /**
   * 根据规则类型获取积分
   * @param userId 用户ID
   * @param ruleType 规则类型
   * @param remark 备注
   * @returns 操作结果
   */
  async addPointsByRuleType(
    userId: number,
    ruleType: ForumPointRuleTypeEnum,
    remark?: string,
  ) {
    return this.addPoints({
      userId,
      ruleType,
      remark,
    })
  }
}
