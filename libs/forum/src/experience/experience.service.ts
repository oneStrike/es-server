import type { ForumExperienceRuleWhereInput } from '@libs/base/database'
import { BaseService } from '@libs/base/database'

import { BadRequestException, Injectable } from '@nestjs/common'
import { LevelRuleService } from '../level-rule/level-rule.service'
import { ProfileStatusEnum } from '../user/user.constant'
import {
  AddExperienceDto,
  QueryExperienceRecordDto,
} from './dto/experience-record.dto'
import {
  CreateExperienceRuleDto,
  QueryExperienceRuleDto,
  UpdateExperienceRuleDto,
} from './dto/experience-rule.dto'
import { ExperienceRuleTypeEnum } from './experience.constant'

/**
 * 经验服务类
 * 提供论坛经验的增删改查等核心业务逻辑
 */
@Injectable()
export class ExperienceService extends BaseService {
  constructor(private readonly levelRuleService: LevelRuleService) {
    super()
  }

  get forumExperienceRule() {
    return this.prisma.forumExperienceRule
  }

  get forumExperienceRecord() {
    return this.prisma.forumExperienceRecord
  }

  get forumProfile() {
    return this.prisma.forumProfile
  }

  /**
   * 创建经验规则
   * @param dto 创建规则的数据
   * @returns 创建的规则信息
   */
  async createExperienceRule(dto: CreateExperienceRuleDto) {
    return this.forumExperienceRule.create({
      data: dto,
    })
  }

  /**
   * 分页查询经验规则列表
   * @param queryExperienceRuleDto 查询条件
   * @returns 分页的规则列表
   */
  async getExperienceRulePage(queryExperienceRuleDto: QueryExperienceRuleDto) {
    const where: ForumExperienceRuleWhereInput = queryExperienceRuleDto

    if (queryExperienceRuleDto.name) {
      where.name = {
        contains: queryExperienceRuleDto.name,
        mode: 'insensitive',
      }
    }

    return this.forumExperienceRule.findPagination({
      where,
    })
  }

  /**
   * 获取经验规则详情
   * @param id 规则ID
   * @returns 规则详情信息
   */
  async getExperienceRuleDetail(id: number) {
    return this.forumExperienceRule.findUnique({
      where: { id },
    })
  }

  /**
   * 更新经验规则
   * @param dto 更新规则的数据
   * @returns 更新后的规则信息
   */
  async updateExperienceRule(dto: UpdateExperienceRuleDto) {
    const { id, ...updateData } = dto

    return this.forumExperienceRule.update({
      where: { id },
      data: updateData,
    })
  }

  async deleteExperienceRule(id: number) {
    const rule = await this.forumExperienceRule.findUnique({
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

    return this.forumExperienceRule.delete({
      where: { id },
    })
  }

  /**
   * 增加经验
   * @param addExperienceDto 增加经验的数据
   * @returns 增加经验的结果
   */
  async addExperience(addExperienceDto: AddExperienceDto) {
    const { profileId, ruleType, remark } = addExperienceDto

    const profile = await this.forumProfile.findUnique({
      where: {
        id: profileId,
        status: {
          not: ProfileStatusEnum.PERMANENT_BANNED,
        },
      },
    })

    if (!profile) {
      throw new BadRequestException('用户不存在或已被永久封禁')
    }

    const rule = await this.forumExperienceRule.findUnique({
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

    if (rule.dailyLimit > 0) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const todayCount = await this.forumExperienceRecord.count({
        where: {
          profileId,
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

    return this.prisma.$transaction(async (tx) => {
      const beforeExperience = profile.experience
      const afterExperience = beforeExperience + rule.experience

      const record = await tx.forumExperienceRecord.create({
        data: {
          profileId,
          ruleId: rule.id,
          experience: rule.experience,
          beforeExperience,
          afterExperience,
          remark,
        },
      })

      await tx.forumProfile.update({
        where: { id: profileId },
        data: {
          experience: afterExperience,
        },
      })

      const newLevelRule = await tx.forumLevelRule.findFirst({
        where: {
          isEnabled: true,
          requiredExperience: {
            lte: afterExperience,
          },
        },
        orderBy: {
          requiredExperience: 'desc',
        },
      })

      if (newLevelRule && newLevelRule.id !== profile.levelId) {
        await tx.forumProfile.update({
          where: { id: profileId },
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
  async getExperienceRecordPage(dto: QueryExperienceRecordDto) {
    const { profileId, ruleId, ...otherDto } = dto
    const where: any = {
      ...otherDto,
    }

    if (ruleId !== undefined) {
      where.rule = {
        id: ruleId,
      }
    }

    if (profileId !== undefined) {
      where.profile = {
        id: profileId,
      }
    }

    return this.forumExperienceRecord.findPagination({
      where,
    })
  }

  /**
   * 获取用户经验记录详情
   * @param id 记录ID
   * @returns 记录详情信息
   */
  async getExperienceRecordDetail(id: number) {
    const record = await this.forumExperienceRecord.findUnique({
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
      throw new BadRequestException('经验记录不存在')
    }

    return record
  }

  /**
   * 获取用户经验统计
   * @param profileId 用户ID
   * @returns 经验统计信息
   */
  async getUserExperienceStats(profileId: number) {
    const profile = await this.forumProfile.findUnique({
      where: { id: profileId },
      include: {
        level: true,
      },
    })

    if (!profile) {
      throw new BadRequestException('用户资料不存在')
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todayEarned = await this.forumExperienceRecord.aggregate({
      where: {
        profileId,
        createdAt: {
          gte: today,
        },
      },
      _sum: {
        experience: true,
      },
    })

    return {
      currentExperience: profile.experience,
      todayEarned: todayEarned._sum.experience || 0,
      level: profile.level,
    }
  }

  /**
   * 根据规则类型获取经验
   * @param profileId 用户ID
   * @param ruleType 规则类型
   * @param remark 备注
   * @returns 操作结果
   */
  async addExperienceByRuleType(
    profileId: number,
    ruleType: ExperienceRuleTypeEnum,
    remark?: string,
  ) {
    return this.addExperience({
      profileId,
      ruleType,
      remark,
    })
  }
}
