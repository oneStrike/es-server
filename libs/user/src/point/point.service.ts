import { BaseService } from '@libs/base/database'

import { BadRequestException, Injectable } from '@nestjs/common'
import { GrowthRuleTypeEnum } from '../growth-rule.constant'
import {
  AddUserPointsDto,
  ConsumeUserPointsDto,
  QueryUserPointRecordDto,
} from './dto/point-record.dto'
import { UserPointRuleService } from './point-rule.service'

/**
 * 积分服务类
 * 提供用户积分的增加、消费、记录查询等核心业务逻辑
 */
@Injectable()
export class UserPointService extends BaseService {
  get userPointRecord() {
    return this.prisma.userPointRecord
  }

  get appUser() {
    return this.prisma.appUser
  }

  constructor(private readonly pointRuleService: UserPointRuleService) {
    super()
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

    const rule = await this.pointRuleService.getEnabledRuleByType(ruleType)

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
  async consumePoints(
    consumePointsDto: ConsumeUserPointsDto,
    tx?: Parameters<Parameters<typeof this.prisma.$transaction>[0]>[0],
  ) {
    const { userId, points, remark, targetType, targetId, exchangeId } =
      consumePointsDto

    const user = await this.appUser.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new BadRequestException('用户不存在')
    }

    if (user.points < points) {
      throw new BadRequestException('积分不足')
    }

    if (tx) {
      const beforePoints = user.points
      const afterPoints = beforePoints - points

      const record = await tx.userPointRecord.create({
        data: {
          userId,
          points: -points,
          beforePoints,
          afterPoints,
          remark,
          targetType,
          targetId,
          exchangeId,
        },
      })

      await tx.appUser.update({
        where: { id: userId },
        data: {
          points: afterPoints,
        },
      })

      return record
    }

    return this.prisma.$transaction(async (transaction) => {
      // 检查余额并扣除
      const updateResult = await transaction.appUser.updateMany({
        where: {
          id: userId,
          points: {
            gte: points, // 确保积分足够
          },
        },
        data: {
          points: {
            decrement: points,
          },
        },
      })

      if (updateResult.count === 0) {
        throw new BadRequestException('积分不足或用户不存在')
      }

      // 获取更新后的积分用于记录
      const user = await transaction.appUser.findUniqueOrThrow({
        where: { id: userId },
      })

      const afterPoints = user.points
      const beforePoints = afterPoints + points

      const record = await transaction.userPointRecord.create({
        data: {
          userId,
          points: -points,
          beforePoints,
          afterPoints,
          remark,
          targetType,
          targetId,
          exchangeId,
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
    ruleType: GrowthRuleTypeEnum,
    remark?: string,
  ) {
    return this.addPoints({
      userId,
      ruleType,
      remark,
    })
  }
}
