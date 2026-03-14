import type {
  AddAdminAppUserExperienceDto,
  AddAdminAppUserPointsDto,
  AssignAdminAppUserBadgeDto,
  ConsumeAdminAppUserPointsDto,
  QueryAdminAppUserBadgeDto,
  QueryAdminAppUserExperienceRecordDto,
  QueryAdminAppUserPageDto,
  QueryAdminAppUserPointRecordDto,
  UpdateAdminAppUserEnabledDto,
  UpdateAdminAppUserProfileDto,
  UpdateAdminAppUserStatusDto,
} from './dto/app-user.dto'
import { UserStatusEnum } from '@libs/platform/constant'
import { PlatformService, Prisma } from '@libs/platform/database'
import {
  GrowthAssetTypeEnum,
  UserBadgeService,
  UserExperienceService,
UserPointService
} from '@libs/growth'

import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { UserRoleEnum } from '../user/user.constant'

/**
 * APP 用户管理服务
 * 负责管理端 APP 用户的查询、资料维护、状态维护与成长资产管理
 */
@Injectable()
export class AppUserService extends PlatformService {
  constructor(
    private readonly userPointService: UserPointService,
    private readonly userExperienceService: UserExperienceService,
    private readonly userBadgeService: UserBadgeService,
  ) {
    super()
  }

  /**
   * 获取 APP 用户分页列表
   */
  async getAppUserPage(query: QueryAdminAppUserPageDto) {
    const {
      id,
      account,
      phone,
      nickname,
      email,
      isEnabled,
      status,
      levelId,
      lastLoginStartDate,
      lastLoginEndDate,
      pageIndex,
      pageSize,
      startDate,
      endDate,
      orderBy,
    } = query

    const where: Record<string, unknown> = {
      deletedAt: null,
      pageIndex,
      pageSize,
      startDate,
      endDate,
      orderBy,
    }

    if (id !== undefined) {
      where.id = id
    }
    if (account) {
      where.account = { contains: account }
    }
    if (phone) {
      where.phone = { contains: phone }
    }
    if (nickname) {
      where.nickname = { contains: nickname }
    }
    if (email) {
      where.email = { contains: email }
    }
    if (isEnabled !== undefined) {
      where.isEnabled = isEnabled
    }
    if (status !== undefined) {
      where.status = status
    }
    if (levelId !== undefined) {
      where.levelId = levelId
    }

    const lastLoginAt = this.buildDateRange(
      lastLoginStartDate,
      lastLoginEndDate,
    )
    if (lastLoginAt) {
      where.lastLoginAt = lastLoginAt
    }

    const page = await this.prisma.appUser.findPagination({
      where: where as any,
      select: {
        ...this.baseUserSelect,
        level: {
          select: {
            name: true,
          },
        },
        forumProfile: {
          select: {
            topicCount: true,
            replyCount: true,
          },
        },
      },
    })

    return {
      ...page,
      list: page.list.map((item) => ({
        ...this.mapBaseUser(item),
        levelName: item.level?.name ?? undefined,
        topicCount: item.forumProfile?.topicCount ?? 0,
        replyCount: item.forumProfile?.replyCount ?? 0,
      })),
    }
  }

  /**
   * 获取 APP 用户详情
   */
  async getAppUserDetail(userId: number) {
    const user = await this.prisma.appUser.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        ...this.baseUserSelect,
        level: {
          select: {
            id: true,
            name: true,
            requiredExperience: true,
          },
        },
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
        _count: {
          select: {
            userBadges: true,
          },
        },
      },
    })

    if (!user) {
      throw new NotFoundException('应用用户不存在')
    }

    const [pointStats, experienceStats] = await Promise.all([
      this.userPointService.getUserPointStats(userId),
      this.getAppUserExperienceStats(userId),
    ])

    return {
      ...this.mapBaseUser(user),
      level: user.level
        ? {
            id: user.level.id,
            name: user.level.name,
            requiredExperience: user.level.requiredExperience,
          }
        : undefined,
      forumProfile: {
        signature: user.forumProfile?.signature ?? '',
        bio: user.forumProfile?.bio ?? '',
        topicCount: user.forumProfile?.topicCount ?? 0,
        replyCount: user.forumProfile?.replyCount ?? 0,
        likeCount: user.forumProfile?.likeCount ?? 0,
        favoriteCount: user.forumProfile?.favoriteCount ?? 0,
      },
      badgeCount: user._count.userBadges,
      pointStats,
      experienceStats,
    }
  }

  /**
   * 更新 APP 用户基础资料
   */
  async updateAppUserProfile(
    adminUserId: number,
    dto: UpdateAdminAppUserProfileDto,
  ) {
    await this.ensureSuperAdmin(adminUserId)
    await this.ensureAppUserExists(dto.id)

    const userData: Prisma.AppUserUpdateInput = {}
    if (dto.nickname !== undefined) {
      userData.nickname = dto.nickname
    }
    if (dto.avatar !== undefined) {
      userData.avatar = dto.avatar
    }
    if (dto.phone !== undefined) {
      userData.phone = dto.phone
    }
    if (dto.email !== undefined) {
      userData.email = dto.email
    }
    if (dto.gender !== undefined) {
      userData.gender = dto.gender
    }
    if (dto.birthDate !== undefined) {
      userData.birthDate = dto.birthDate
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        if (Object.keys(userData).length > 0) {
          await tx.appUser.update({
            where: { id: dto.id },
            data: userData,
          })
        }

        if (dto.signature !== undefined || dto.bio !== undefined) {
          const forumProfileData: Record<string, string | null> = {}
          if (dto.signature !== undefined) {
            forumProfileData.signature = dto.signature
          }
          if (dto.bio !== undefined) {
            forumProfileData.bio = dto.bio
          }

          await tx.forumProfile.upsert({
            where: { userId: dto.id },
            create: {
              userId: dto.id,
              signature: dto.signature ?? '',
              bio: dto.bio ?? '',
            },
            update: forumProfileData,
          })
        }
      })
    } catch (error) {
      this.handlePrismaError(error, {
        P2002: () => {
          throw new BadRequestException('手机号或邮箱已存在')
        },
      })
    }

    return this.getAppUserDetail(dto.id)
  }

  /**
   * 更新 APP 用户账号启用状态
   */
  async updateAppUserEnabled(
    adminUserId: number,
    dto: UpdateAdminAppUserEnabledDto,
  ) {
    await this.ensureSuperAdmin(adminUserId)
    await this.ensureAppUserExists(dto.id)

    await this.prisma.appUser.update({
      where: { id: dto.id },
      data: {
        isEnabled: dto.isEnabled,
      },
    })

    return this.getAppUserDetail(dto.id)
  }

  /**
   * 更新 APP 用户社区状态
   */
  async updateAppUserStatus(
    adminUserId: number,
    dto: UpdateAdminAppUserStatusDto,
  ) {
    await this.ensureSuperAdmin(adminUserId)
    await this.ensureAppUserExists(dto.id)

    const isNormal = dto.status === UserStatusEnum.NORMAL
    const isPermanent =
      dto.status === UserStatusEnum.PERMANENT_MUTED
      || dto.status === UserStatusEnum.PERMANENT_BANNED

    await this.prisma.appUser.update({
      where: { id: dto.id },
      data: {
        status: dto.status,
        banReason: isNormal ? null : (dto.banReason ?? null),
        banUntil: isNormal || isPermanent ? null : (dto.banUntil ?? null),
      },
    })

    return this.getAppUserDetail(dto.id)
  }

  /**
   * 获取 APP 用户积分统计
   */
  async getAppUserPointStats(userId: number) {
    await this.ensureAppUserExists(userId)
    return this.userPointService.getUserPointStats(userId)
  }

  /**
   * 获取 APP 用户积分记录分页
   */
  async getAppUserPointRecords(query: QueryAdminAppUserPointRecordDto) {
    await this.ensureAppUserExists(query.userId)
    return this.userPointService.getPointRecordPage(query)
  }

  /**
   * 手动增加 APP 用户积分
   */
  async addAppUserPoints(adminUserId: number, dto: AddAdminAppUserPointsDto) {
    await this.ensureSuperAdmin(adminUserId)

    return this.userPointService.addPoints({
      ...dto,
      bizKey: this.buildAuditBizKey(
        'app-user:points:add',
        adminUserId,
        dto.userId,
      ),
      source: 'admin_app_user_module',
    })
  }

  /**
   * 手动扣减 APP 用户积分
   */
  async consumeAppUserPoints(
    adminUserId: number,
    dto: ConsumeAdminAppUserPointsDto,
  ) {
    await this.ensureSuperAdmin(adminUserId)

    return this.userPointService.consumePoints({
      ...dto,
      bizKey: this.buildAuditBizKey(
        'app-user:points:consume',
        adminUserId,
        dto.userId,
      ),
      source: 'admin_app_user_module',
    })
  }

  /**
   * 获取 APP 用户经验统计
   */
  async getAppUserExperienceStats(userId: number) {
    const user = await this.prisma.appUser.findFirst({
      where: { id: userId, deletedAt: null },
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
      throw new NotFoundException('应用用户不存在')
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [todayEarned, nextLevel] = await Promise.all([
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
   * 获取 APP 用户经验记录分页
   */
  async getAppUserExperienceRecords(
    query: QueryAdminAppUserExperienceRecordDto,
  ) {
    await this.ensureAppUserExists(query.userId)
    return this.userExperienceService.getExperienceRecordPage(query)
  }

  /**
   * 手动增加 APP 用户经验
   */
  async addAppUserExperience(
    adminUserId: number,
    dto: AddAdminAppUserExperienceDto,
  ) {
    await this.ensureSuperAdmin(adminUserId)

    return this.userExperienceService.addExperience({
      ...dto,
      bizKey: this.buildAuditBizKey(
        'app-user:experience:add',
        adminUserId,
        dto.userId,
      ),
      source: 'admin_app_user_module',
    })
  }

  /**
   * 获取 APP 用户徽章分页
   */
  async getAppUserBadges(query: QueryAdminAppUserBadgeDto) {
    await this.ensureAppUserExists(query.userId)

    const {
      userId,
      name,
      type,
      isEnabled,
      business,
      eventKey,
      ...pageQuery
    } = query

    const badgeWhere: Prisma.UserBadgeWhereInput = {}
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
   * 为 APP 用户分配徽章
   */
  async assignAppUserBadge(
    adminUserId: number,
    dto: AssignAdminAppUserBadgeDto,
  ) {
    await this.ensureSuperAdmin(adminUserId)

    await this.userBadgeService.assignBadge(dto)
    return {
      userId: dto.userId,
      badgeId: dto.badgeId,
    }
  }

  /**
   * 撤销 APP 用户徽章
   */
  async revokeAppUserBadge(
    adminUserId: number,
    dto: AssignAdminAppUserBadgeDto,
  ) {
    await this.ensureSuperAdmin(adminUserId)

    await this.userBadgeService.revokeBadge(dto)
    return {
      userId: dto.userId,
      badgeId: dto.badgeId,
    }
  }

  /**
   * 校验当前管理端用户是否为超级管理员
   */
  private async ensureSuperAdmin(adminUserId: number) {
    const adminUser = await this.prisma.adminUser.findUnique({
      where: { id: adminUserId },
      select: { role: true },
    })

    if (!adminUser) {
      throw new NotFoundException('管理端用户不存在')
    }

    if (adminUser.role !== UserRoleEnum.SUPER_ADMIN) {
      throw new UnauthorizedException('权限不足')
    }
  }

  /**
   * 校验 APP 用户是否存在
   */
  private async ensureAppUserExists(userId: number) {
    if (!(await this.prisma.appUser.exists({ id: userId, deletedAt: null }))) {
      throw new NotFoundException('应用用户不存在')
    }
  }

  /**
   * 映射 APP 用户基础字段
   */
  private mapBaseUser(user: {
    id: number
    createdAt: Date
    updatedAt: Date
    account: string
    phone: string | null
    nickname: string
    avatar: string | null
    email: string | null
    isEnabled: boolean
    gender: number
    birthDate: Date | null
    points: number
    experience: number
    levelId: number | null
    status: number
    banReason: string | null
    banUntil: Date | null
    lastLoginAt: Date | null
    lastLoginIp: string | null
  }) {
    return {
      id: user.id,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      account: user.account,
      phone: user.phone ?? undefined,
      nickname: user.nickname,
      avatar: user.avatar ?? undefined,
      email: user.email ?? undefined,
      isEnabled: user.isEnabled,
      gender: user.gender,
      birthDate: user.birthDate ?? undefined,
      points: user.points,
      experience: user.experience,
      levelId: user.levelId ?? undefined,
      status: user.status,
      banReason: user.banReason ?? undefined,
      banUntil: user.banUntil ?? undefined,
      lastLoginAt: user.lastLoginAt ?? undefined,
      lastLoginIp: user.lastLoginIp ?? undefined,
    }
  }

  /**
   * 构建日期范围查询条件
   */
  private buildDateRange(startDate?: string, endDate?: string) {
    if (!startDate && !endDate) {
      return undefined
    }

    const dateRange: Record<string, Date> = {}
    if (startDate) {
      const start = new Date(startDate)
      if (!Number.isNaN(start.getTime())) {
        dateRange.gte = start
      }
    }
    if (endDate) {
      const end = new Date(endDate)
      if (!Number.isNaN(end.getTime())) {
        end.setDate(end.getDate() + 1)
        dateRange.lt = end
      }
    }

    return Object.keys(dateRange).length > 0 ? dateRange : undefined
  }

  /**
   * 构建后台操作幂等业务键
   */
  private buildAuditBizKey(
    action: string,
    adminUserId: number,
    appUserId: number,
  ) {
    return `${action}:${adminUserId}:${appUserId}:${Date.now()}`
  }

  private readonly baseUserSelect = {
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
    points: true,
    experience: true,
    levelId: true,
    status: true,
    banReason: true,
    banUntil: true,
    lastLoginAt: true,
    lastLoginIp: true,
  } as const
}
