import type { ForumPointRecordWhereInput, ForumPointRuleWhereInput } from '@libs/base/database'
import { RepositoryService } from '@libs/base/database'

import { isNotNil } from '@libs/base/utils'
import { BadRequestException, Injectable } from '@nestjs/common'
import {
  AddPointsDto,
  ConsumePointsDto,
  QueryPointRecordDto,
  QueryPointRuleDto,
} from './dto/point.dto'
import { PointObjectTypeEnum, PointRuleTypeEnum } from './point.constant'

/**
 * 积分服务类
 * 提供论坛积分的增删改查等核心业务逻辑
 */
@Injectable()
export class PointService extends RepositoryService {
  get forumPointRule() {
    return this.prisma.forumPointRule
  }

  get forumPointRecord() {
    return this.prisma.forumPointRecord
  }

  get forumProfile() {
    return this.prisma.forumProfile
  }

  /**
   * 创建积分规则
   * @param createPointRuleDto 创建规则的数据
   * @returns 创建的规则信息
   */
  async createPointRule(createPointRuleDto: any) {
    const { type, name } = createPointRuleDto

    const existingRule = await this.forumPointRule.findFirst({
      where: {
        type,
        name,
      },
    })

    if (existingRule) {
      throw new BadRequestException('该类型的规则名称已存在')
    }

    return this.forumPointRule.create({
      data: createPointRuleDto,
    })
  }

  /**
   * 分页查询积分规则列表
   * @param queryPointRuleDto 查询条件
   * @returns 分页的规则列表
   */
  async getPointRulePage(queryPointRuleDto: QueryPointRuleDto) {
    const { name, type, isEnabled, ...otherDto } = queryPointRuleDto

    const where: ForumPointRuleWhereInput = {}

    if (isNotNil(name)) {
      where.name = {
        contains: name,
        mode: 'insensitive',
      }
    }

    if (isNotNil(type)) {
      where.type = type
    }

    if (isNotNil(isEnabled)) {
      where.isEnabled = isEnabled
    }

    return this.forumPointRule.findPagination({
      where,
      orderBy: {
        type: 'asc',
      },
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
   * @param updatePointRuleDto 更新规则的数据
   * @returns 更新后的规则信息
   */
  async updatePointRule(updatePointRuleDto: any) {
    const { id, ...updateData } = updatePointRuleDto

    const existingRule = await this.forumPointRule.findUnique({
      where: { id },
    })

    if (!existingRule) {
      throw new BadRequestException('积分规则不存在')
    }

    return this.forumPointRule.update({
      where: { id },
      data: updateData,
    })
  }

  /**
   * 删除积分规则
   * @param id 规则ID
   * @returns 删除结果
   */
  async deletePointRule(id: number) {
    const rule = await this.forumPointRule.findUnique({
      where: { id },
    })

    if (!rule) {
      throw new BadRequestException('积分规则不存在')
    }

    return this.forumPointRule.delete({
      where: { id },
    })
  }

  /**
   * 增加积分
   * @param addPointsDto 增加积分的数据
   * @returns 增加积分的结果
   */
  async addPoints(addPointsDto: AddPointsDto) {
    const { userId, ruleType, objectType, objectId, remark } = addPointsDto

    const profile = await this.forumProfile.findUnique({
      where: { id: userId },
    })

    if (!profile) {
      throw new BadRequestException('用户资料不存在')
    }

    const rule = await this.forumPointRule.findFirst({
      where: {
        type: ruleType,
        isEnabled: true,
      },
    })

    if (!rule) {
      throw new BadRequestException('积分规则不存在或已禁用')
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
          objectType,
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
      const beforePoints = profile.points
      const afterPoints = beforePoints + rule.points

      const record = await tx.forumPointRecord.create({
        data: {
          userId,
          ruleId: rule.id,
          points: rule.points,
          beforePoints,
          afterPoints,
          objectType,
          objectId,
          remark: remark || rule.remark,
        },
      })

      await tx.forumProfile.update({
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
  async consumePoints(consumePointsDto: ConsumePointsDto) {
    const { userId, points, objectType, objectId, remark } = consumePointsDto

    const profile = await this.forumProfile.findUnique({
      where: { id: userId },
    })

    if (!profile) {
      throw new BadRequestException('用户资料不存在')
    }

    if (profile.points < points) {
      throw new BadRequestException('积分不足')
    }

    return this.prisma.$transaction(async (tx) => {
      const beforePoints = profile.points
      const afterPoints = beforePoints - points

      const record = await tx.forumPointRecord.create({
        data: {
          userId,
          points: -points,
          beforePoints,
          afterPoints,
          objectType,
          objectId,
          remark,
        },
      })

      await tx.forumProfile.update({
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
   * @param queryPointRecordDto 查询条件
   * @returns 分页的记录列表
   */
  async getPointRecordPage(queryPointRecordDto: QueryPointRecordDto) {
    const { userId, ruleId, objectType, objectId, ...otherDto } =
      queryPointRecordDto

    const where: ForumPointRecordWhereInput = {}

    if (isNotNil(userId)) {
      where.userId = userId
    }

    if (isNotNil(ruleId)) {
      where.ruleId = ruleId
    }

    if (isNotNil(objectType)) {
      where.objectType = objectType
    }

    if (isNotNil(objectId)) {
      where.objectId = objectId
    }

    return this.forumPointRecord.findPagination({
      where,
      include: {
        profile: {
          include: {
            user: true,
          },
        },
        rule: true,
      },
      orderBy: {
        createdAt: 'desc',
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
        profile: {
          include: {
            user: true,
          },
        },
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
    const profile = await this.forumProfile.findUnique({
      where: { id: userId },
    })

    if (!profile) {
      throw new BadRequestException('用户资料不存在')
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
      currentPoints: profile.points,
      todayEarned: todayEarned._sum.points || 0,
      todayConsumed: Math.abs(todayConsumed._sum.points || 0),
    }
  }

  /**
   * 与漫画系统互通接口 - 预留
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
    const profile = await this.forumProfile.findUnique({
      where: { id: userId },
    })

    if (!profile) {
      throw new BadRequestException('用户资料不存在')
    }

    if (operation === 'consume' && profile.points < points) {
      throw new BadRequestException('积分不足')
    }

    return this.prisma.$transaction(async (tx) => {
      const beforePoints = profile.points
      let afterPoints: number

      if (operation === 'add') {
        afterPoints = beforePoints + points
      } else {
        afterPoints = beforePoints - points
      }

      await tx.forumProfile.update({
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
   * @param objectType 对象类型
   * @param objectId 对象ID
   * @param remark 备注
   * @returns 操作结果
   */
  async addPointsByRuleType(
    userId: number,
    ruleType: PointRuleTypeEnum,
    objectType: PointObjectTypeEnum,
    objectId: number,
    remark?: string,
  ) {
    return this.addPoints({
      userId,
      ruleType,
      objectType,
      objectId,
      remark,
    })
  }
}
