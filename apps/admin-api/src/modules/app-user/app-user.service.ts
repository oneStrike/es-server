import { Injectable } from '@nestjs/common'
import { AppUserCommandService } from './app-user-command.service'
import { AppUserGrowthService } from './app-user-growth.service'
import { AppUserQueryService } from './app-user-query.service'

/**
 * APP 用户模块门面服务。
 *
 * 统一向 controller 暴露模块公开用例，内部委托给 query / command / growth
 * 子服务，避免单个 service 同时承担目录查询、账号维护和成长资产编排。
 */
@Injectable()
export class AppUserService {
  constructor(
    private readonly appUserQueryService: AppUserQueryService,
    private readonly appUserCommandService: AppUserCommandService,
    private readonly appUserGrowthService: AppUserGrowthService,
  ) {}

  /** 获取 APP 用户分页列表。 */
  async getAppUserPage(query: Parameters<AppUserQueryService['getAppUserPage']>[0]) {
    return this.appUserQueryService.getAppUserPage(query)
  }

  /** 获取 APP 用户详情。 */
  async getAppUserDetail(userId: number) {
    return this.appUserQueryService.getAppUserDetail(userId)
  }

  /** 新建 APP 用户。 */
  async createAppUser(
    adminUserId: number,
    dto: Parameters<AppUserCommandService['createAppUser']>[1],
  ) {
    return this.appUserCommandService.createAppUser(adminUserId, dto)
  }

  /** 更新 APP 用户基础资料。 */
  async updateAppUserProfile(
    adminUserId: number,
    dto: Parameters<AppUserCommandService['updateAppUserProfile']>[1],
  ) {
    return this.appUserCommandService.updateAppUserProfile(adminUserId, dto)
  }

  /** 更新 APP 用户账号启用状态。 */
  async updateAppUserEnabled(
    adminUserId: number,
    dto: Parameters<AppUserCommandService['updateAppUserEnabled']>[1],
  ) {
    return this.appUserCommandService.updateAppUserEnabled(adminUserId, dto)
  }

  /** 更新 APP 用户状态。 */
  async updateAppUserStatus(
    adminUserId: number,
    dto: Parameters<AppUserCommandService['updateAppUserStatus']>[1],
  ) {
    return this.appUserCommandService.updateAppUserStatus(adminUserId, dto)
  }

  /** 软删除 APP 用户。 */
  async deleteAppUser(adminUserId: number, userId: number) {
    return this.appUserCommandService.deleteAppUser(adminUserId, userId)
  }

  /** 恢复已软删除的 APP 用户。 */
  async restoreAppUser(adminUserId: number, userId: number) {
    return this.appUserCommandService.restoreAppUser(adminUserId, userId)
  }

  /** 重置 APP 用户密码。 */
  async resetAppUserPassword(
    adminUserId: number,
    dto: Parameters<AppUserCommandService['resetAppUserPassword']>[1],
  ) {
    return this.appUserCommandService.resetAppUserPassword(adminUserId, dto)
  }

  /** 重建单个 APP 用户关注计数。 */
  async rebuildAppUserFollowCounts(adminUserId: number, userId: number) {
    return this.appUserCommandService.rebuildAppUserFollowCounts(
      adminUserId,
      userId,
    )
  }

  /** 全量重建 APP 用户关注计数。 */
  async rebuildAllAppUserFollowCounts(adminUserId: number, batchSize = 200) {
    return this.appUserCommandService.rebuildAllAppUserFollowCounts(
      adminUserId,
      batchSize,
    )
  }

  /** 获取 APP 用户积分统计。 */
  async getAppUserPointStats(userId: number) {
    return this.appUserGrowthService.getAppUserPointStats(userId)
  }

  /** 获取 APP 用户积分记录分页。 */
  async getAppUserPointRecords(
    query: Parameters<AppUserGrowthService['getAppUserPointRecords']>[0],
  ) {
    return this.appUserGrowthService.getAppUserPointRecords(query)
  }

  /** 手动增加 APP 用户积分。 */
  async addAppUserPoints(
    adminUserId: number,
    dto: Parameters<AppUserGrowthService['addAppUserPoints']>[1],
  ) {
    return this.appUserGrowthService.addAppUserPoints(adminUserId, dto)
  }

  /** 手动扣减 APP 用户积分。 */
  async consumeAppUserPoints(
    adminUserId: number,
    dto: Parameters<AppUserGrowthService['consumeAppUserPoints']>[1],
  ) {
    return this.appUserGrowthService.consumeAppUserPoints(adminUserId, dto)
  }

  /** 获取 APP 用户经验统计。 */
  async getAppUserExperienceStats(userId: number) {
    return this.appUserGrowthService.getAppUserExperienceStats(userId)
  }

  /** 获取 APP 用户经验记录分页。 */
  async getAppUserExperienceRecords(
    query: Parameters<AppUserGrowthService['getAppUserExperienceRecords']>[0],
  ) {
    return this.appUserGrowthService.getAppUserExperienceRecords(query)
  }

  /** 获取 APP 用户混合成长流水分页。 */
  async getAppUserGrowthLedgerRecords(
    query: Parameters<AppUserGrowthService['getAppUserGrowthLedgerRecords']>[0],
  ) {
    return this.appUserGrowthService.getAppUserGrowthLedgerRecords(query)
  }

  /** 手动增加 APP 用户经验。 */
  async addAppUserExperience(
    adminUserId: number,
    dto: Parameters<AppUserGrowthService['addAppUserExperience']>[1],
  ) {
    return this.appUserGrowthService.addAppUserExperience(adminUserId, dto)
  }

  /** 获取 APP 用户徽章分页。 */
  async getAppUserBadges(
    query: Parameters<AppUserGrowthService['getAppUserBadges']>[0],
  ) {
    return this.appUserGrowthService.getAppUserBadges(query)
  }

  /** 为 APP 用户分配徽章。 */
  async assignAppUserBadge(
    adminUserId: number,
    dto: Parameters<AppUserGrowthService['assignAppUserBadge']>[1],
  ) {
    return this.appUserGrowthService.assignAppUserBadge(adminUserId, dto)
  }

  /** 撤销 APP 用户徽章。 */
  async revokeAppUserBadge(
    adminUserId: number,
    dto: Parameters<AppUserGrowthService['revokeAppUserBadge']>[1],
  ) {
    return this.appUserGrowthService.revokeAppUserBadge(adminUserId, dto)
  }
}
