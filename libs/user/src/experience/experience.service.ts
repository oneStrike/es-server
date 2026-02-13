import { UserStatusEnum } from '@libs/base/constant'

import { BaseService } from '@libs/base/database'
import { BadRequestException, Injectable } from '@nestjs/common'
import { UserLevelRuleService } from '../level-rule/level-rule.service'
import {
  AddUserExperienceDto,
  QueryUserExperienceRecordDto,
} from './dto/experience-record.dto'
import {
  CreateUserExperienceRuleDto,
  QueryUserExperienceRuleDto,
  UpdateUserExperienceRuleDto,
} from './dto/experience-rule.dto'

/**
 * 经验服务类
 * 提供用户经验的增删改查等核心业务逻辑
 */
@Injectable()
export class UserExperienceService extends BaseService {
  constructor(private readonly levelRuleService: UserLevelRuleService) {
    super()
  }

  /**
   * 获取经验规则数据库访问器
   */
  get userExperienceRule() {
    return this.prisma.userExperienceRule
  }

  /**
   * 获取经验记录数据库访问器
   */
  get userExperienceRecord() {
    return this.prisma.userExperienceRecord
  }

  /**
   * 获取用户资料数据库访问器
   */
  get appUser() {
    return this.prisma.appUser
  }

  /**
   * 创建经验规则
   * @param dto 创建规则的数据
   * @returns 创建的规则信息
   */
  async createExperienceRule(dto: CreateUserExperienceRuleDto) {
    if (
      await this.userExperienceRule.exists({ type: dto.type, isEnabled: true })
    ) {
      throw new BadRequestException('经验规则类型已存在')
    }
    return this.userExperienceRule.create({
      data: dto,
    })
  }

  /**
   * 分页查询经验规则列表
   * @param dto 查询条件
   * @returns 分页的规则列表
   */
  async getExperienceRulePage(dto: QueryUserExperienceRuleDto) {
    return this.userExperienceRule.findPagination({
      where: {
        ...dto,
        isEnabled: dto.isEnabled,
        type: dto.type,
      },
    })
  }

  /**
   * 获取经验规则详情
   * @param id 规则ID
   * @returns 规则详情信息
   */
  async getExperienceRuleDetail(id: number) {
    const rule = await this.userExperienceRule.findUnique({
      where: { id },
    })

    if (!rule) {
      throw new BadRequestException('经验规则不存在')
    }

    return rule
  }

  /**
   * 更新经验规则
   * @param dto 更新规则的数据
   * @returns 更新后的规则信息
   */
  async updateExperienceRule(dto: UpdateUserExperienceRuleDto) {
    const { id, ...updateData } = dto

    if (
      await this.userExperienceRule.exists({ type: dto.type, id: { not: id } })
    ) {
      throw new BadRequestException('经验规则类型已存在')
    }
    return this.userExperienceRule.update({
      where: { id },
      data: updateData,
    })
  }

  /**
   * 删除经验规则
   * @param id 规则ID
   * @returns 删除结果
   */
  async deleteExperienceRule(id: number) {
    const rule = await this.userExperienceRule.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            records: true,
          },
        },
      },
    })

    if (!rule) {
      throw new BadRequestException('经验规则不存在')
    }

    if (rule._count.records > 0) {
      throw new BadRequestException('该经验规则下已有记录，无法删除')
    }

    return this.userExperienceRule.delete({
      where: { id },
    })
  }

  /**
   * 增加经验
   * @param addExperienceDto 增加经验的数据
   * @returns 增加经验的结果
   */
  async addExperience(addExperienceDto: AddUserExperienceDto) {
    const { userId, ruleType, remark } = addExperienceDto

    const user = await this.appUser.findUnique({
      where: {
        id: userId,
        status: {
          not: UserStatusEnum.PERMANENT_BANNED,
        },
      },
    })

    if (!user) {
      throw new BadRequestException('用户不存在或已被永久封禁')
    }

    const rule = await this.userExperienceRule.findUnique({
      where: {
        type: ruleType,
        isEnabled: true,
      },
    })

    if (!rule) {
      throw new BadRequestException('经验规则不存在')
    }

    if (rule.experience <= 0) {
      throw new BadRequestException('经验规则配置错误')
    }

    // 按规则校验当日可获取次数
    if (rule.dailyLimit > 0) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const todayCount = await this.userExperienceRecord.count({
        where: {
          userId,
          ruleId: rule.id,
          createdAt: {
            gte: today,
          },
        },
      })

      if (todayCount >= rule.dailyLimit) {
        throw new BadRequestException('今日经验已达上限')
      }
    }

    // 记录变更、经验更新与等级升级放在同一事务
    return this.prisma.$transaction(async (tx) => {
      const beforeExperience = user.experience
      const afterExperience = beforeExperience + rule.experience

      const record = await tx.userExperienceRecord.create({
        data: {
          userId,
          ruleId: rule.id,
          experience: rule.experience,
          beforeExperience,
          afterExperience,
          remark,
        },
      })

      await tx.appUser.update({
        where: { id: userId },
        data: {
          experience: afterExperience,
        },
      })

      // 按经验值选择当前可达的最高等级
      const newLevelRule =
        await this.levelRuleService.getHighestLevelRuleByExperience(
          afterExperience,
          tx,
        )

      // 仅当等级变化时更新，避免重复写入
      if (newLevelRule && newLevelRule.id !== user.levelId) {
        await tx.appUser.update({
          where: { id: userId },
          data: {
            levelId: newLevelRule.id,
          },
        })
      }

      return record
    })
  }

  /**
   * 分页查询经验记录列表
   * @param dto 查询条件
   * @returns 分页的记录列表
   */
  async getExperienceRecordPage(dto: QueryUserExperienceRecordDto) {
    return this.userExperienceRecord.findPagination({
      where: {
        ...dto,
        rule: {
          id: dto.ruleId,
        },
        user: {
          id: dto.userId,
        },
      },
    })
  }

  /**
   * 获取用户经验记录详情
   * @param id 记录ID
   * @returns 记录详情信息
   */
  async getExperienceRecordDetail(id: number) {
    const record = await this.userExperienceRecord.findUnique({
      where: { id },
      include: {
        user: true,
        rule: true,
      },
    })

    if (!record) {
      throw new BadRequestException('经验记录不存在')
    }

    return record
  }

  /**
   * 获取用户经验统计
   * @param userId 用户ID
   * @returns 经验统计信息
   */
  async getUserExperienceStats(userId: number) {
    const user = await this.appUser.findUnique({
      where: { id: userId },
      include: {
        level: true,
      },
    })

    if (!user) {
      throw new BadRequestException('用户不存在')
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todayEarned = await this.userExperienceRecord.aggregate({
      where: {
        userId,
        createdAt: {
          gte: today,
        },
      },
      _sum: {
        experience: true,
      },
    })

    return {
      currentExperience: user.experience,
      todayEarned: todayEarned._sum.experience || 0,
      level: user.level,
    }
  }
}
