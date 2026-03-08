import { UserStatusEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import { BadRequestException, Injectable } from '@nestjs/common'
import { GrowthAssetTypeEnum } from '../growth-ledger/growth-ledger.constant'
import { GrowthLedgerService } from '../growth-ledger/growth-ledger.service'
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
 * 对外保留原方法，内部统一走 GrowthLedger。
 */
@Injectable()
export class UserExperienceService extends BaseService {
  constructor(
    private readonly levelRuleService: UserLevelRuleService,
    private readonly growthLedgerService: GrowthLedgerService,
  ) {
    super()
  }

  /**
   * 获取经验规则数据库访问器
   */
  get userExperienceRule() {
    return this.prisma.userExperienceRule
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
    try {
      return await this.userExperienceRule.create({
        data: dto,
      })
    } catch (error) {
      this.handlePrismaError(error, {
        P2002: () => {
          throw new BadRequestException('Experience rule type already exists')
        },
      })
    }
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

    try {
      return await this.userExperienceRule.update({
        where: { id },
        data: updateData,
      })
    } catch (error) {
      this.handlePrismaError(error, {
        P2002: () => {
          throw new BadRequestException('Experience rule type already exists')
        },
      })
    }
  }

  /**
   * 删除经验规则
   * @param id 规则ID
   * @returns 删除结果
   */
  async deleteExperienceRule(id: number) {
    const rule = await this.userExperienceRule.findUnique({
      where: { id },
    })

    if (!rule) {
      throw new BadRequestException('经验规则不存在')
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
  async addExperience(
    addExperienceDto: AddUserExperienceDto & {
      bizKey?: string
      source?: string
      targetType?: number
      targetId?: number
    },
  ) {
    const { userId, ruleType, remark } = addExperienceDto

    const user = await this.appUser.findUnique({
      where: {
        id: userId,
        status: {
          not: UserStatusEnum.PERMANENT_BANNED,
        },
      },
      select: { id: true },
    })

    if (!user) {
      throw new BadRequestException('用户不存在或已被永久封禁')
    }

    const bizKey =
      addExperienceDto.bizKey
      ?? this.buildBizKey(`experience:rule:${ruleType}`, userId)
    const source = addExperienceDto.source ?? 'experience_service'

    return this.prisma.$transaction(async (tx) => {
      const result = await this.growthLedgerService.applyByRule(tx, {
        userId,
        assetType: GrowthAssetTypeEnum.EXPERIENCE,
        ruleType,
        bizKey,
        source,
        remark,
        targetType: addExperienceDto.targetType,
        targetId: addExperienceDto.targetId,
      })

      if (!result.success && !result.duplicated) {
        throw new BadRequestException(this.mapRuleFailReason(result.reason))
      }

      // 经验变化后按最新经验值刷新等级
      const currentExperience = result.afterValue ?? (
        await tx.appUser.findUniqueOrThrow({
          where: { id: userId },
          select: { experience: true },
        })
      ).experience

      const newLevelRule =
        await this.levelRuleService.getHighestLevelRuleByExperience(
          currentExperience,
          tx,
        )

      if (newLevelRule) {
        await tx.appUser.update({
          where: { id: userId },
          data: {
            levelId: newLevelRule.id,
          },
        })
      }

      const recordId = result.recordId
      if (!recordId) {
        throw new BadRequestException('经验发放失败')
      }

      const record = await tx.growthLedgerRecord.findUniqueOrThrow({
        where: { id: recordId },
      })

      return this.toExperienceRecord(record)
    })
  }

  /**
   * 分页查询经验记录列表
   * @param dto 查询条件
   * @returns 分页的记录列表
   */
  async getExperienceRecordPage(dto: QueryUserExperienceRecordDto) {
    const page = await this.prisma.growthLedgerRecord.findPagination({
      where: {
        userId: dto.userId,
        ruleId: dto.ruleId,
        assetType: GrowthAssetTypeEnum.EXPERIENCE,
      },
      orderBy: { id: 'desc' },
    })

    return {
      ...page,
      list: page.list.map((item) => this.toExperienceRecord(item)),
    }
  }

  /**
   * 获取用户经验记录详情
   * @param id 记录ID
   * @returns 记录详情信息
   */
  async getExperienceRecordDetail(id: number) {
    const record = await this.prisma.growthLedgerRecord.findUnique({
      where: { id },
      include: {
        user: true,
      },
    })

    if (!record || record.assetType !== GrowthAssetTypeEnum.EXPERIENCE) {
      throw new BadRequestException('经验记录不存在')
    }

    return {
      ...this.toExperienceRecord(record),
      user: record.user,
    }
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

    const todayEarned = await this.prisma.growthLedgerRecord.aggregate({
      where: {
        userId,
        assetType: GrowthAssetTypeEnum.EXPERIENCE,
        delta: { gt: 0 },
        createdAt: {
          gte: today,
        },
      },
      _sum: {
        delta: true,
      },
    })

    return {
      currentExperience: user.experience,
      todayEarned: todayEarned._sum.delta || 0,
      level: user.level,
    }
  }

  private toExperienceRecord(record: {
    id: number
    userId: number
    ruleId: number | null
    delta: number
    beforeValue: number
    afterValue: number
    remark: string | null
    createdAt: Date
    updatedAt?: Date
  }) {
    return {
      id: record.id,
      userId: record.userId,
      ruleId: record.ruleId ?? undefined,
      experience: record.delta,
      beforeExperience: record.beforeValue,
      afterExperience: record.afterValue,
      remark: record.remark ?? undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  }

  private mapRuleFailReason(reason?: string) {
    const reasonMap: Record<string, string> = {
      rule_not_found: 'Experience rule not found',
      rule_disabled: 'Experience rule is disabled',
      rule_zero: 'Invalid experience rule config',
      daily_limit: 'Daily experience limit reached',
      total_limit: 'Total experience limit reached',
    }

    return reason ? (reasonMap[reason] ?? 'Experience grant failed') : 'Experience grant failed'
  }

  private buildBizKey(prefix: string, userId: number) {
    return `${prefix}:${userId}:${Date.now()}`
  }
}
