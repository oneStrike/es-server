import type { SQL } from 'drizzle-orm'
/**
 * 用户服务
 *
 * 提供用户中心相关的业务逻辑，包括：
 * - 用户基本信息的获取和更新
 * - 用户中心汇总信息
 * - 用户状态判断
 * - 用户资产统计（购买、下载、收藏、点赞等）
 * - 用户成长信息（积分、经验、等级、徽章）
 */
import { buildILikeCondition, DrizzleService } from '@db/core'
import { UserExperienceService } from '@libs/growth/experience/experience.service';
import { GrowthAssetTypeEnum } from '@libs/growth/growth-ledger/growth-ledger.constant';
import { UserPointService } from '@libs/growth/point/point.service';
import { TaskService } from '@libs/growth/task/task.service';
import { UserAssetsService } from '@libs/interaction/user-assets/user-assets.service';
import { MessageInboxService } from '@libs/message/inbox/inbox.service';
import { formatDateOnlyInAppTimeZone, startOfTodayInAppTimeZone } from '@libs/platform/utils/time';
import { ChangeMyPhoneDto, QueryMyBadgeDto, QueryMyExperienceRecordDto, QueryMyPointRecordDto, UpdateMyProfileDto } from '@libs/user/dto/user-self.dto';
import { UserService as UserCoreService } from '@libs/user/user.service';
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq, gt, gte, inArray, sql } from 'drizzle-orm'
import { AppAuthErrorMessages } from '../auth/auth.constant'
import { SmsService } from '../auth/sms.service'

@Injectable()
export class UserService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly userCoreService: UserCoreService,
    private readonly smsService: SmsService,
    private readonly userAssetsService: UserAssetsService,
    private readonly userPointService: UserPointService,
    private readonly userExperienceService: UserExperienceService,
    private readonly taskService: TaskService,
    private readonly messageInboxService: MessageInboxService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  private get appUser() {
    return this.drizzle.schema.appUser
  }

  private get appUserBadgeAssignment() {
    return this.drizzle.schema.appUserBadgeAssignment
  }

  private get appBadge() {
    return this.drizzle.schema.appBadge
  }

  private get appUserLevelRule() {
    return this.drizzle.schema.appUserLevelRule
  }

  private get growthLedgerRecord() {
    return this.drizzle.schema.growthLedgerRecord
  }

  /**
   * 获取用户资料
   */
  async getUserProfile(userId: number) {
    const user = await this.userCoreService.ensureUserExists(userId)
    return this.userCoreService.mapBaseUser(user)
  }

  /**
   * 更新用户资料
   */
  async updateUserProfile(userId: number, dto: UpdateMyProfileDto) {
    await this.userCoreService.ensureUserExists(userId)

    try {
      const result = await this.drizzle.withErrorHandling(() =>
        this.db
          .update(this.appUser)
          .set({
            nickname: dto.nickname,
            avatarUrl: dto.avatarUrl,
            emailAddress: dto.emailAddress,
            genderType: dto.genderType,
            signature: dto.signature,
            bio: dto.bio,
            birthDate: dto.birthDate
              ? formatDateOnlyInAppTimeZone(dto.birthDate)
              : undefined,
          })
          .where(eq(this.appUser.id, userId)),
      )
      this.drizzle.assertAffectedRows(result, '用户不存在')
      return true
    } catch (error) {
      if (this.drizzle.isUniqueViolation(error)) {
        throw new BadRequestException('邮箱已被使用')
      }
      throw error
    }
  }

  /**
   * 换绑当前用户手机号。
   *
   * 该操作要求用户先校验旧手机号，再校验新手机号，避免高风险账号标识被未授权篡改。
   * 新手机号占用冲突统一翻译为稳定业务文案，不直接暴露数据库唯一约束错误。
   *
   * @param userId 当前用户ID
   * @param dto 换绑手机号入参
   * @returns 是否换绑成功
   */
  async changeMyPhone(userId: number, dto: ChangeMyPhoneDto) {
    const user = await this.userCoreService.ensureUserExists(userId)

    if (!user.phoneNumber) {
      throw new BadRequestException('当前账号未绑定手机号')
    }
    if (dto.currentPhone !== user.phoneNumber) {
      throw new BadRequestException('当前手机号与已绑定手机号不一致')
    }
    if (dto.newPhone === user.phoneNumber) {
      throw new BadRequestException('新手机号不能与当前手机号相同')
    }

    await this.smsService.validateVerifyCode({
      phone: dto.currentPhone,
      code: dto.currentCode,
    })
    await this.smsService.validateVerifyCode({
      phone: dto.newPhone,
      code: dto.newCode,
    })

    try {
      const result = await this.drizzle.withErrorHandling(() =>
        this.db
          .update(this.appUser)
          .set({
            phoneNumber: dto.newPhone,
          })
          .where(eq(this.appUser.id, userId)),
      )
      this.drizzle.assertAffectedRows(result, '用户不存在')
      return true
    } catch (error) {
      if (this.drizzle.isUniqueViolation(error)) {
        throw new BadRequestException(AppAuthErrorMessages.PHONE_EXISTS)
      }
      throw error
    }
  }

  /**
   * 获取用户中心汇总信息
   */
  async getUserCenter(userId: number) {
    const [user, counts, badgeCount, assets, messageSummary, taskSummary] =
      await Promise.all([
        this.userCoreService.ensureUserExists(userId),
        this.userCoreService.getUserCounts(userId),
        this.userCoreService.getBadgeCount(userId),
        this.getUserAssetsSummary(userId),
        this.messageInboxService.getSummary(userId),
        this.taskService.getUserTaskSummary(userId),
      ])

    const level = user.levelId
      ? await this.userCoreService.getLevelInfo(user.levelId)
      : undefined

    return {
      user: {
        id: user.id,
        account: user.account,
        phoneNumber: user.phoneNumber ?? undefined,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl ?? undefined,
        emailAddress: user.emailAddress ?? undefined,
        genderType: user.genderType,
        birthDate: user.birthDate ?? undefined,
      },
      growth: {
        points: user.points,
        experience: user.experience,
        levelId: user.levelId ?? undefined,
        levelName: level?.name ?? undefined,
        badgeCount,
      },
      profile: {
        signature: user.signature ?? undefined,
        bio: user.bio ?? undefined,
        status: user.status,
        banReason: user.banReason ?? undefined,
        banUntil: user.banUntil ?? undefined,
        counts,
      },
      assets,
      message: {
        notificationUnreadCount: messageSummary.notificationUnreadCount,
        totalUnreadCount: messageSummary.totalUnreadCount,
      },
      task: taskSummary,
    }
  }

  /**
   * 获取用户状态信息
   */
  async getUserStatus(userId: number) {
    const user = await this.userCoreService.ensureUserExists(userId)
    return this.userCoreService.buildUserStatus(user)
  }

  /**
   * 获取用户积分统计
   *
   * @param userId 用户ID
   * @returns 用户积分统计
   */
  async getUserPointStats(userId: number) {
    return this.userPointService.getUserPointStats(userId)
  }

  /**
   * 获取用户积分记录
   *
   * @param userId 用户ID
   * @param query 查询条件
   * @returns 积分记录分页数据
   */
  async getUserPointRecords(userId: number, query: QueryMyPointRecordDto) {
    return this.userPointService.getPointRecordPage({
      ...query,
      userId,
    })
  }

  /**
   * 获取用户经验统计
   *
   * @param userId 用户ID
   * @returns 用户经验统计
   */
  async getUserExperienceStats(userId: number) {
    const user = await this.userCoreService.ensureUserExists(userId)

    // 获取今日开始时间
    const today = startOfTodayInAppTimeZone()

    const [todayEarnedRows, levelRows, nextLevelRows] = await Promise.all([
      this.db
        .select({
          sum: sql<number>`COALESCE(SUM(${this.growthLedgerRecord.delta}), 0)::int`,
        })
        .from(this.growthLedgerRecord)
        .where(
          and(
            eq(this.growthLedgerRecord.userId, userId),
            eq(
              this.growthLedgerRecord.assetType,
              GrowthAssetTypeEnum.EXPERIENCE,
            ),
            gt(this.growthLedgerRecord.delta, 0),
            gte(this.growthLedgerRecord.createdAt, today),
          ),
        ),
      user.levelId
        ? this.db
            .select({
              id: this.appUserLevelRule.id,
              name: this.appUserLevelRule.name,
              requiredExperience: this.appUserLevelRule.requiredExperience,
            })
            .from(this.appUserLevelRule)
            .where(eq(this.appUserLevelRule.id, user.levelId))
        : [],
      this.db
        .select({
          id: this.appUserLevelRule.id,
          name: this.appUserLevelRule.name,
          requiredExperience: this.appUserLevelRule.requiredExperience,
        })
        .from(this.appUserLevelRule)
        .where(
          and(
            eq(this.appUserLevelRule.isEnabled, true),
            gt(this.appUserLevelRule.requiredExperience, user.experience),
          ),
        )
        .orderBy(this.appUserLevelRule.requiredExperience)
        .limit(1),
    ])
    const todayEarned = Number(todayEarnedRows[0]?.sum ?? 0)
    const level = levelRows[0]
    const nextLevel = nextLevelRows[0]

    return {
      currentExperience: user.experience,
      todayEarned,
      level: level
        ? {
            id: level.id,
            name: level.name,
            requiredExperience: level.requiredExperience,
          }
        : undefined,
      nextLevel: nextLevel
        ? {
            id: nextLevel.id,
            name: nextLevel.name,
            requiredExperience: nextLevel.requiredExperience,
          }
        : undefined,
      gapToNextLevel: nextLevel
        ? Math.max(nextLevel.requiredExperience - user.experience, 0)
        : undefined,
    }
  }

  /**
   * 获取用户经验记录
   *
   * @param userId 用户ID
   * @param query 查询条件
   * @returns 经验记录分页数据
   */
  async getUserExperienceRecords(
    userId: number,
    query: QueryMyExperienceRecordDto,
  ) {
    return this.userExperienceService.getExperienceRecordPage({
      ...query,
      userId,
    })
  }

  /**
   * 获取用户徽章列表
   *
   * @param userId 用户ID
   * @param query 查询条件
   * @returns 徽章列表分页数据
   */
  async getUserBadges(userId: number, query: QueryMyBadgeDto) {
    await this.userCoreService.ensureUserExists(userId)

    const { name, type, isEnabled, ...pageQuery } = query
    const badgeConditions: SQL[] = []

    if (name) {
      badgeConditions.push(
        buildILikeCondition(this.appBadge.name, name)!,
      )
    }
    if (type !== undefined) {
      badgeConditions.push(eq(this.appBadge.type, type))
    }
    if (isEnabled !== undefined) {
      badgeConditions.push(eq(this.appBadge.isEnabled, isEnabled))
    }

    const badgeWhere =
      badgeConditions.length > 0 ? and(...badgeConditions) : undefined
    const badges = await this.db
      .select({ id: this.appBadge.id })
      .from(this.appBadge)
      .where(badgeWhere)
    const badgeIds = badges.map((item) => item.id)
    if (badgeIds.length === 0) {
      return {
        list: [],
        total: 0,
        pageIndex: pageQuery.pageIndex,
        pageSize: pageQuery.pageSize,
        totalPages: 0,
      }
    }

    const page = await this.drizzle.ext.findPagination(
      this.appUserBadgeAssignment,
      {
        where: and(
          eq(this.appUserBadgeAssignment.userId, userId),
          inArray(this.appUserBadgeAssignment.badgeId, badgeIds),
        ),
        ...pageQuery,
        orderBy: pageQuery.orderBy ?? [
          { createdAt: 'desc' as const },
          { badgeId: 'asc' as const },
        ],
      },
    )
    const pageBadgeIds = page.list.map((item) => item.badgeId)
    const pageBadges = pageBadgeIds.length
      ? await this.db
          .select()
          .from(this.appBadge)
          .where(inArray(this.appBadge.id, pageBadgeIds))
      : []
    const badgeMap = new Map(
      pageBadges.map((item) => [
        item.id,
        {
          id: item.id,
          name: item.name,
          description: item.description ?? undefined,
          icon: item.icon ?? undefined,
          type: item.type,
          isEnabled: item.isEnabled,
        },
      ]),
    )

    return {
      ...page,
      list: page.list.map((item) => {
        const badge = badgeMap.get(item.badgeId)

        if (!badge) {
          throw new BadRequestException('徽章不存在')
        }

        return {
          createdAt: item.createdAt,
          badge,
        }
      }),
    }
  }

  /**
   * 获取用户资产统计
   *
   * 包括购买、下载、收藏、点赞、浏览、评论等统计数据
   *
   * @param userId 用户ID
   * @returns 用户资产统计
   */
  async getUserAssetsSummary(userId: number) {
    await this.userCoreService.ensureUserExists(userId)
    return this.userAssetsService.getUserAssetsSummary(userId)
  }
}
