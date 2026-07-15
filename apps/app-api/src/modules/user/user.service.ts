import type {
  QueryMyBadgeDto,
  QueryMyExperienceRecordDto,
  QueryMyPointRecordDto,
} from '@libs/growth/app-user-growth-profile/dto/app-user-growth-profile.dto'
import type {
  UserAssetsSummaryPartial,
  UserCenterTaskPartial,
  UserCountPartial,
} from './user.type'
import { UserCenterDto } from '@libs/account/app-user-self/dto/app-user-self.dto'
import { UserAssetsService } from '@libs/account/user-assets/user-assets.service'
import { AppUserGrowthProfileService } from '@libs/growth/app-user-growth-profile/app-user-growth-profile.service'
/**
 * 应用端用户服务。
 * 提供用户中心相关的业务逻辑，包括资料获取/更新、用户中心汇总、状态判断、资产统计与成长信息。
 */
import { UserExperienceService } from '@libs/growth/experience/experience.service'
import { UserPointService } from '@libs/growth/point/point.service'
import { TaskService } from '@libs/growth/task/task.service'
import { MessageInboxService } from '@libs/message/inbox/inbox.service'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { SmsTemplateCodeEnum } from '@libs/platform/modules/sms/sms.constant'
import {
  ChangeMyPhoneDto,
  QueryUserMentionPageDto,
  UpdateMyProfileDto,
} from '@libs/user/dto/user-self.dto'
import { UserService as UserCoreService } from '@libs/user/user.service'
import { Injectable } from '@nestjs/common'
import { SmsService } from '../auth/sms.service'

@Injectable()
export class UserService {
  constructor(
    private readonly userCoreService: UserCoreService,
    private readonly smsService: SmsService,
    private readonly userAssetsService: UserAssetsService,
    private readonly userPointService: UserPointService,
    private readonly userExperienceService: UserExperienceService,
    private readonly appUserGrowthProfileService: AppUserGrowthProfileService,
    private readonly taskService: TaskService,
    private readonly messageInboxService: MessageInboxService,
  ) {}

  // 将共享用户计数读模型收敛为用户中心 DTO 约定结构，显式排除内部字段并为缺失值兜底为 0。
  private mapUserCenterCounts(counts?: UserCountPartial) {
    return {
      commentCount: counts?.commentCount ?? 0,
      likeCount: counts?.likeCount ?? 0,
      favoriteCount: counts?.favoriteCount ?? 0,
      followingUserCount: counts?.followingUserCount ?? 0,
      followingAuthorCount: counts?.followingAuthorCount ?? 0,
      followingSectionCount: counts?.followingSectionCount ?? 0,
      followingHashtagCount: counts?.followingHashtagCount ?? 0,
      followersCount: counts?.followersCount ?? 0,
      forumTopicCount: counts?.forumTopicCount ?? 0,
      commentReceivedLikeCount: counts?.commentReceivedLikeCount ?? 0,
      forumTopicReceivedLikeCount: counts?.forumTopicReceivedLikeCount ?? 0,
      forumTopicReceivedFavoriteCount:
        counts?.forumTopicReceivedFavoriteCount ?? 0,
    }
  }

  // 收敛用户资产摘要输出，避免资产域内部补充字段外泄到用户中心契约。
  private mapUserCenterAssets(assets?: UserAssetsSummaryPartial) {
    return {
      currencyBalance: assets?.currencyBalance ?? 0,
      vipExpiresAt: assets?.vipExpiresAt ?? null,
      availableCouponCount: assets?.availableCouponCount ?? 0,
      purchasedWorkCount: assets?.purchasedWorkCount ?? 0,
      purchasedChapterCount: assets?.purchasedChapterCount ?? 0,
      downloadedWorkCount: assets?.downloadedWorkCount ?? 0,
      downloadedChapterCount: assets?.downloadedChapterCount ?? 0,
      favoriteCount: assets?.favoriteCount ?? 0,
      likeCount: assets?.likeCount ?? 0,
      viewCount: assets?.viewCount ?? 0,
      commentCount: assets?.commentCount ?? 0,
    }
  }

  // 收敛用户中心任务摘要，避免执行层内部辅助字段透传到 HTTP 契约。
  private mapUserCenterTaskSummary(taskSummary?: UserCenterTaskPartial) {
    return {
      claimableCount: taskSummary?.claimableCount ?? 0,
      claimedCount: taskSummary?.claimedCount ?? 0,
      inProgressCount: taskSummary?.inProgressCount ?? 0,
      rewardPendingCount: taskSummary?.rewardPendingCount ?? 0,
    }
  }

  // 获取用户资料，包含成长快照。
  async getUserProfile(userId: number) {
    const user = await this.userCoreService.getAppUserResponseSource(userId)
    const growth =
      await this.appUserGrowthProfileService.getUserGrowthSnapshot(userId)
    return this.userCoreService.mapBaseUser(user, growth)
  }

  // 更新用户资料，邮箱唯一冲突时抛出业务异常。
  async updateUserProfile(userId: number, dto: UpdateMyProfileDto) {
    return this.userCoreService.updateUserProfile(userId, dto)
  }

  // 换绑手机号：需先校验旧手机号再校验新手机号，新号占用冲突统一翻译为稳定业务文案。
  async changeMyPhone(userId: number, dto: ChangeMyPhoneDto) {
    const user = await this.userCoreService.getUserPhoneSource(userId)

    if (!user.phoneNumber) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '当前账号未绑定手机号',
      )
    }
    if (dto.currentPhone !== user.phoneNumber) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '当前手机号与已绑定手机号不一致',
      )
    }
    if (dto.newPhone === user.phoneNumber) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '新手机号不能与当前手机号相同',
      )
    }

    await this.smsService.validateVerifyCode({
      phone: dto.currentPhone,
      code: dto.currentCode,
      templateCode: SmsTemplateCodeEnum.VERIFY_BIND_PHONE,
    })
    await this.smsService.validateVerifyCode({
      phone: dto.newPhone,
      code: dto.newCode,
      templateCode: SmsTemplateCodeEnum.BIND_NEW_PHONE,
    })

    return this.userCoreService.changeUserPhoneNumber(userId, dto.newPhone)
  }

  // 获取用户中心汇总信息：用户、成长、计数、徽章、资产、消息、任务。
  async getUserCenter(userId: number): Promise<UserCenterDto> {
    const [
      user,
      growth,
      counts,
      badgeCount,
      assets,
      messageSummary,
      taskSummary,
    ] = await Promise.all([
      this.userCoreService.getUserCenterSource(userId),
      this.appUserGrowthProfileService.getUserGrowthSnapshot(userId),
      this.userCoreService.getUserCounts(userId),
      this.appUserGrowthProfileService.getBadgeCount(userId),
      this.userAssetsService.getUserAssetsSummary(userId),
      this.messageInboxService.getUnreadSummary(userId),
      this.taskService.getUserTaskSummary(userId),
    ])

    const level = user.levelId
      ? await this.appUserGrowthProfileService.getLevelInfo(user.levelId)
      : undefined

    return {
      user: {
        id: user.id,
        account: user.account,
        phoneNumber: user.phoneNumber ?? null,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl ?? null,
        profileBackgroundImageUrl: user.profileBackgroundImageUrl ?? null,
        emailAddress: user.emailAddress ?? null,
        genderType: user.genderType,
        birthDate: user.birthDate ?? null,
      },
      growth: {
        points: growth.points,
        experience: growth.experience,
        levelId: user.levelId ?? null,
        levelName: level?.name ?? null,
        levelIcon: level?.icon ?? null,
        levelColor: level?.color ?? null,
        badgeCount,
      },
      profile: {
        signature: user.signature ?? null,
        bio: user.bio ?? null,
        status: user.status,
        banReason: user.banReason ?? null,
        banUntil: user.banUntil ?? null,
        counts: this.mapUserCenterCounts(counts),
      },
      lastLoginGeo: {
        geoCountry: user.lastLoginGeoCountry ?? null,
        geoProvince: user.lastLoginGeoProvince ?? null,
        geoCity: user.lastLoginGeoCity ?? null,
        geoIsp: user.lastLoginGeoIsp ?? null,
      },
      assets: this.mapUserCenterAssets(assets),
      message: {
        notificationUnread: messageSummary.notificationUnread,
        totalUnreadCount: messageSummary.totalUnreadCount,
      },
      task: this.mapUserCenterTaskSummary(taskSummary),
    }
  }

  // 获取用户状态信息。
  async getUserStatus(userId: number) {
    const user = await this.userCoreService.getUserStatusSource(userId)
    return this.userCoreService.buildUserStatus(user)
  }

  // 获取用户积分统计。
  async getUserPointStats(userId: number) {
    return this.userPointService.getUserPointStats(userId)
  }

  // 分页获取用户积分记录，剥离内部字段后返回。
  async getUserPointRecords(userId: number, query: QueryMyPointRecordDto) {
    const page = await this.userPointService.getAppPointRecordPage({
      ...query,
      userId,
    })

    return {
      ...page,
      list: page.list.map((item) => {
        const { bizKey: _bizKey, context: _context, ...rest } = item
        return rest
      }),
    }
  }

  // 获取用户经验统计，含今日已获经验、当前等级与下一等级信息。
  async getUserExperienceStats(userId: number) {
    return this.appUserGrowthProfileService.getUserExperienceStats(userId)
  }

  // 分页获取用户经验记录，剥离内部字段后返回。
  async getUserExperienceRecords(
    userId: number,
    query: QueryMyExperienceRecordDto,
  ) {
    const page = await this.userExperienceService.getAppExperienceRecordPage({
      ...query,
      userId,
    })

    return {
      ...page,
      list: page.list.map((item) => {
        const {
          bizKey: _bizKey,
          context: _context,
          updatedAt: _updatedAt,
          ...rest
        } = item
        return rest
      }),
    }
  }

  // 分页获取用户徽章列表，支持按名称/类型/启用状态过滤。
  async getUserBadges(userId: number, query: QueryMyBadgeDto) {
    return this.appUserGrowthProfileService.getUserBadgePage(userId, query)
  }

  // 获取 @ 提及候选用户，代理共享用户域的轻量搜索。
  async getMentionCandidates(query: QueryUserMentionPageDto) {
    return this.userCoreService.queryMentionCandidates(query)
  }
}
