import { BaseService } from '@libs/base/database'

import { BadRequestException, Injectable } from '@nestjs/common'
import {
  AddUserPointsDto,
  ConsumeUserPointsDto,
  QueryUserPointRecordDto,
} from './dto/point-record.dto'
import {
  CreateUserPointRuleDto,
  QueryUserPointRuleDto,
  UpdateUserPointRuleDto,
} from './dto/point-rule.dto'
import { UserPointRuleTypeEnum } from './point.constant'

/**
 * 积分服务类
 * 提供用户积分的增删改查等核心业务逻辑
 */
@Injectable()
export class UserPointService extends BaseService {
  get userPointRule() {
    return this.prisma.userPointRule
  }

  get userPointRecord() {
    return this.prisma.userPointRecord
  }

  get appUser() {
    return this.prisma.appUser
  }

  /**
   * 创建积分规则
   * @param dto 创建规则的数据
   * @returns 创建的规则信息
   */
  async createPointRule(dto: CreateUserPointRuleDto) {
    // 校验规则类型是否存在
    if (!Object.values(UserPointRuleTypeEnum).includes(dto.type)) {
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
    const { id, ...updateData } = dto

    return this.userPointRule.update({
      where: { id },
      data: updateData,
    })
  }

  /**
   * 增加积分
   * @param addPointsDto 增加积分的数据
   * @returns 增加积分的结果
   */
  async addPoints(addPointsDto: AddUserPointsDto) {
    const { userId, ruleType, remark } = addPointsDto

    const user = await this.appUser.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new BadRequestException('用户不存在')
    }

    const rule = await this.userPointRule.findUnique({
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

    // 按规则校验当日可获取次数
    if (rule.dailyLimit > 0) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const todayCount = await this.userPointRecord.count({
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

    // 记录变更与用户积分更新放在同一事务
    return this.prisma.$transaction(async (tx) => {
      const beforePoints = user.points
      const afterPoints = beforePoints + rule.points

      const record = await tx.userPointRecord.create({
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
  async consumePoints(consumePointsDto: ConsumeUserPointsDto) {
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

    // 消费积分需保证记录与余额一致
    return this.prisma.$transaction(async (tx) => {
      const beforePoints = user.points
      const afterPoints = beforePoints - points

      const record = await tx.userPointRecord.create({
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
  async getPointRecordPage(dto: QueryUserPointRecordDto) {
    const { userId, ruleId, ...otherDto } = dto
    return this.userPointRecord.findPagination({
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
    const record = await this.userPointRecord.findUnique({
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

    const todayEarned = await this.userPointRecord.aggregate({
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

    const todayConsumed = await this.userPointRecord.aggregate({
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
    ruleType: UserPointRuleTypeEnum,
    remark?: string,
  ) {
    return this.addPoints({
      userId,
      ruleType,
      remark,
    })
  }
}
