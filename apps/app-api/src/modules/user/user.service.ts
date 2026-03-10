/**
 * 用户服务
 *
 * 提供用户中心相关的业务逻辑，包括：
 * - 用户基本信息的获取和更新
 * - 用户论坛资料的获取和更新
 * - 用户中心汇总信息
 * - 用户状态判断
 * - 用户资产统计（购买、下载、收藏、点赞等）
 * - 用户成长信息（积分、经验、等级、徽章）
 */
import type { QueryMyPointRecordDto } from './dto/user-point.dto'
import type {
  QueryMyBadgeDto,
  QueryMyExperienceRecordDto,
  UpdateMyForumProfileDto,
  UpdateMyProfileDto,
} from './dto/user.dto'
import { UserStatusEnum } from '@libs/base/constant'
import { BaseService, Prisma } from '@libs/base/database'
import { DownloadTargetTypeEnum } from '@libs/interaction'
import {
  PurchaseStatusEnum,
  PurchaseTargetTypeEnum,
} from '@libs/interaction/purchase/purchase.constant'
import { MessageInboxService } from '@libs/message'
import { UserExperienceService, UserPointService } from '@libs/user'
import { GrowthAssetTypeEnum } from '@libs/user/growth-ledger'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'

@Injectable()
export class UserService extends BaseService {
  constructor(
    private readonly userPointService: UserPointService,
    private readonly userExperienceService: UserExperienceService,
    private readonly messageInboxService: MessageInboxService,
  ) {
    super()
  }

  /**
   * 获取用户资料
   *
   * @param userId 用户ID
   * @returns 用户资料信息
   */
  async getUserProfile(userId: number) {
    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
      select: this.userProfileSelect,
    })

    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    return user
  }

  /**
   * 更新用户资料
   *
   * @param userId 用户ID
   * @param dto 更新数据
   * @returns 更新后的用户资料
   */
  async updateUserProfile(userId: number, dto: UpdateMyProfileDto) {
    await this.ensureUserExists(userId)

    try {
      return await this.prisma.appUser.update({
        where: { id: userId },
        data: {
          nickname: dto.nickname,
          avatar: dto.avatar,
          email: dto.email,
          gender: dto.gender,
          birthDate: dto.birthDate,
        },
        select: this.userProfileSelect,
      })
    } catch (error) {
      this.handlePrismaError(error, {
        P2002: () => {
          throw new BadRequestException('邮箱已被使用')
        },
      })
    }
  }

  /**
   * 获取用户论坛资料
   *
   * @param userId 用户ID
   * @returns 用户论坛资料
   */
  async getUserForumProfile(userId: number) {
    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
      select: {
        status: true,
        banReason: true,
        banUntil: true,
        forumProfile: {
          select: {
            signature: true,
            bio: true,
            topicCount: true,
            replyCount: true,
            likeCount: true,
            favoriteCount: true,
          },
        },
      },
    })

    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    return {
      signature: user.forumProfile?.signature ?? '',
      bio: user.forumProfile?.bio ?? '',
      topicCount: user.forumProfile?.topicCount ?? 0,
      replyCount: user.forumProfile?.replyCount ?? 0,
      likeCount: user.forumProfile?.likeCount ?? 0,
      favoriteCount: user.forumProfile?.favoriteCount ?? 0,
      status: user.status,
      banReason: user.banReason ?? undefined,
      banUntil: user.banUntil ?? undefined,
    }
  }

  /**
   * 更新用户论坛资料
   *
   * @param userId 用户ID
   * @param dto 更新数据
   * @returns 更新后的用户论坛资料
   */
  async updateUserForumProfile(userId: number, dto: UpdateMyForumProfileDto) {
    await this.ensureUserExists(userId)

    await this.prisma.forumProfile.upsert({
      where: { userId },
      create: {
        userId,
        signature: dto.signature ?? '',
        bio: dto.bio ?? '',
      },
      update: {
        signature: dto.signature,
        bio: dto.bio,
      },
    })

    return this.getUserForumProfile(userId)
  }

  /**
   * 获取用户中心汇总信息
   *
   * @param userId 用户ID
   * @returns 用户中心汇总信息
   */
  async getUserCenter(userId: number) {
    const [user, assets, messageSummary] = await Promise.all([
      this.prisma.appUser.findUnique({
        where: { id: userId },
        select: {
          id: true,
          account: true,
          phone: true,
          nickname: true,
          avatar: true,
          email: true,
          gender: true,
          birthDate: true,
          points: true,
          experience: true,
          levelId: true,
          status: true,
          banReason: true,
          banUntil: true,
          level: {
            select: {
              id: true,
              name: true,
            },
          },
          forumProfile: {
            select: {
              topicCount: true,
              replyCount: true,
              likeCount: true,
              favoriteCount: true,
            },
          },
          _count: {
            select: {
              userBadges: true,
            },
          },
        },
      }),
      this.getUserAssetsSummary(userId),
      this.messageInboxService.getSummary(userId),
    ])

    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    return {
      user: {
        id: user.id,
        account: user.account,
        phone: user.phone ?? undefined,
        nickname: user.nickname,
        avatar: user.avatar ?? undefined,
        email: user.email ?? undefined,
        gender: user.gender,
        birthDate: user.birthDate ?? undefined,
      },
      growth: {
        points: user.points,
        experience: user.experience,
        levelId: user.levelId ?? undefined,
        levelName: user.level?.name ?? undefined,
        badgeCount: user._count.userBadges,
      },
      community: {
        status: user.status,
        banReason: user.banReason ?? undefined,
        banUntil: user.banUntil ?? undefined,
        topicCount: user.forumProfile?.topicCount ?? 0,
        replyCount: user.forumProfile?.replyCount ?? 0,
        likeCount: user.forumProfile?.likeCount ?? 0,
        favoriteCount: user.forumProfile?.favoriteCount ?? 0,
      },
      assets,
      message: {
        notificationUnreadCount: messageSummary.notificationUnreadCount,
        totalUnreadCount: messageSummary.totalUnreadCount,
      },
    }
  }

  /**
   * 获取用户状态信息
   *
   * @param userId 用户ID
   * @returns 用户状态信息
   */
  async getUserStatus(userId: number) {
    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
      select: {
        isEnabled: true,
        status: true,
        banReason: true,
        banUntil: true,
      },
    })

    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    return this.buildUserStatus(user)
  }

  /**
   * 获取用户成长汇总
   *
   * @param userId 用户ID
   * @returns 用户成长汇总信息
   */
  async getUserGrowthSummary(userId: number) {
    const [user, pointStats, experienceStats, badgeCount] = await Promise.all([
      this.prisma.appUser.findUnique({
        where: { id: userId },
        select: {
          points: true,
          experience: true,
          levelId: true,
          level: {
            select: {
              name: true,
            },
          },
        },
      }),
      this.userPointService.getUserPointStats(userId),
      this.getUserExperienceStats(userId),
      this.prisma.userBadgeAssignment.count({
        where: { userId },
      }),
    ])

    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    return {
      points: user.points,
      experience: user.experience,
      levelId: user.levelId ?? undefined,
      levelName: user.level?.name ?? undefined,
      badgeCount,
      todayPointEarned: pointStats.todayEarned,
      todayExperienceEarned: experienceStats.todayEarned,
    }
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
    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
      select: {
        experience: true,
        level: {
          select: {
            id: true,
            name: true,
            requiredExperience: true,
          },
        },
      },
    })

    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    // 获取今日开始时间
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [todayEarned, nextLevel] = await Promise.all([
      // 查询今日获得的经验值
      this.prisma.growthLedgerRecord.aggregate({
        where: {
          userId,
          assetType: GrowthAssetTypeEnum.EXPERIENCE,
          delta: { gt: 0 },
          createdAt: { gte: today },
        },
        _sum: {
          delta: true,
        },
      }),
      // 查询下一个等级
      this.prisma.userLevelRule.findFirst({
        where: {
          isEnabled: true,
          requiredExperience: {
            gt: user.experience,
          },
        },
        orderBy: {
          requiredExperience: 'asc',
        },
        select: {
          id: true,
          name: true,
          requiredExperience: true,
        },
      }),
    ])

    return {
      currentExperience: user.experience,
      todayEarned: todayEarned._sum.delta || 0,
      level: user.level
        ? {
            id: user.level.id,
            name: user.level.name,
            requiredExperience: user.level.requiredExperience,
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
    await this.ensureUserExists(userId)

    const { name, type, isEnabled, business, eventKey, ...pageQuery } = query
    const badgeWhere: Prisma.UserBadgeWhereInput = {}

    // 构建徽章筛选条件
    if (name) {
      badgeWhere.name = {
        contains: name,
      }
    }
    if (type !== undefined) {
      badgeWhere.type = type
    }
    if (isEnabled !== undefined) {
      badgeWhere.isEnabled = isEnabled
    }
    if (business) {
      badgeWhere.business = business
    }
    if (eventKey) {
      badgeWhere.eventKey = eventKey
    }

    const page = await this.prisma.userBadgeAssignment.findPagination({
      where: {
        userId,
        ...pageQuery,
        ...(Object.keys(badgeWhere).length > 0 ? { badge: badgeWhere } : {}),
      } as any,
      include: {
        badge: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return {
      ...page,
      list: page.list.map((item: any) => ({
        id: item.id,
        createdAt: item.createdAt,
        badge: item.badge,
      })),
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
    await this.ensureUserExists(userId)

    const [
      commentCount,
      likeCount,
      favoriteCount,
      viewCount,
      purchasedChapterCount,
      downloadedChapterCount,
      purchasedWorkRows,
      downloadedWorkRows,
    ] = await Promise.all([
      // 评论数
      this.prisma.userComment.count({
        where: {
          userId,
          deletedAt: null,
        },
      }),
      // 点赞数
      this.prisma.userLike.count({
        where: { userId },
      }),
      // 收藏数
      this.prisma.userFavorite.count({
        where: { userId },
      }),
      // 浏览数
      this.prisma.userBrowseLog.count({
        where: { userId },
      }),
      // 已购买章节数
      this.prisma.userPurchaseRecord.count({
        where: {
          userId,
          status: PurchaseStatusEnum.SUCCESS,
          targetType: {
            in: [
              PurchaseTargetTypeEnum.COMIC_CHAPTER,
              PurchaseTargetTypeEnum.NOVEL_CHAPTER,
            ],
          },
        },
      }),
      // 已下载章节数
      this.prisma.userDownloadRecord.count({
        where: {
          userId,
          targetType: {
            in: [
              DownloadTargetTypeEnum.COMIC_CHAPTER,
              DownloadTargetTypeEnum.NOVEL_CHAPTER,
            ],
          },
        },
      }),
      // 已购买作品数（去重）
      this.prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
        SELECT COUNT(DISTINCT wc.work_id)::bigint AS "total"
        FROM user_purchase_record upr
        INNER JOIN work_chapter wc ON wc.id = upr.target_id
        WHERE upr.user_id = ${userId}
          AND upr.status = ${PurchaseStatusEnum.SUCCESS}
          AND upr.target_type IN (${PurchaseTargetTypeEnum.COMIC_CHAPTER}, ${PurchaseTargetTypeEnum.NOVEL_CHAPTER})
      `),
      // 已下载作品数（去重）
      this.prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
        SELECT COUNT(DISTINCT wc.work_id)::bigint AS "total"
        FROM user_download_record udr
        INNER JOIN work_chapter wc ON wc.id = udr.target_id
        WHERE udr.user_id = ${userId}
          AND udr.target_type IN (${DownloadTargetTypeEnum.COMIC_CHAPTER}, ${DownloadTargetTypeEnum.NOVEL_CHAPTER})
      `),
    ])

    return {
      purchasedWorkCount: Number(purchasedWorkRows[0]?.total ?? 0n),
      purchasedChapterCount,
      downloadedWorkCount: Number(downloadedWorkRows[0]?.total ?? 0n),
      downloadedChapterCount,
      favoriteCount,
      likeCount,
      viewCount,
      commentCount,
    }
  }

  /**
   * 确保用户存在
   *
   * @param userId 用户ID
   * @throws NotFoundException 用户不存在时抛出异常
   */
  private async ensureUserExists(userId: number) {
    if (!(await this.prisma.appUser.exists({ id: userId }))) {
      throw new NotFoundException('用户不存在')
    }
  }

  /**
   * 构建用户状态信息
   *
   * @param user 用户数据对象
   * @param user.isEnabled 账号是否可用
   * @param user.status 社区状态码
   * @param user.banReason 封禁/禁言原因
   * @param user.banUntil 封禁/禁言到期时间
   * @returns 用户状态信息
   */
  private buildUserStatus(user: {
    isEnabled: boolean
    status: number
    banReason: string | null
    banUntil: Date | null
  }) {
    // 被禁止互动的状态集合
    const interactionBlockedStatuses = new Set<number>([
      UserStatusEnum.MUTED,
      UserStatusEnum.PERMANENT_MUTED,
      UserStatusEnum.BANNED,
      UserStatusEnum.PERMANENT_BANNED,
    ])

    const canLogin = user.isEnabled
    const canInteract =
      user.isEnabled && !interactionBlockedStatuses.has(user.status)
    const reason = !user.isEnabled
      ? user.banReason || '账号已被禁用'
      : user.banReason || undefined

    return {
      isEnabled: user.isEnabled,
      status: user.status,
      canLogin,
      canPost: canInteract,
      canReply: canInteract,
      canLike: canInteract,
      canFavorite: canInteract,
      reason,
      until: user.banUntil ?? undefined,
    }
  }

  /**
   * 用户资料查询字段
   */
  private readonly userProfileSelect = {
    id: true,
    createdAt: true,
    updatedAt: true,
    account: true,
    phone: true,
    nickname: true,
    avatar: true,
    email: true,
    isEnabled: true,
    gender: true,
    birthDate: true,
    lastLoginAt: true,
    lastLoginIp: true,
    points: true,
    experience: true,
    levelId: true,
    status: true,
    banReason: true,
    banUntil: true,
  } as const
}
