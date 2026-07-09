import {
  AssignUserBadgeDto,
  UserBadgeItemDto,
} from '@libs/growth/badge/dto/user-badge-management.dto'
import { QueryScopedUserExperienceRecordDto } from '@libs/growth/experience/dto/experience-record.dto'
import { QueryUserPointRecordDto } from '@libs/growth/point/dto/point-record.dto'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'
import { IdDto, UserIdDto } from '@libs/platform/dto'
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import {
  AdminAppUserDetailDto,
  AdminAppUserExperienceRecordDto,
  AdminAppUserExperienceStatsDto,
  AdminAppUserFollowCountRepairResultDto,
  AdminAppUserGrowthLedgerRecordDto,
  AdminAppUserGrowthRuleActionDto,
  AdminAppUserPageItemDto,
  AdminAppUserPointRecordDto,
  ConsumeAdminAppUserPointsDto,
  CreateAdminAppUserDto,
  QueryAdminAppUserBadgeDto,
  QueryAdminAppUserGrowthLedgerDto,
  QueryAdminAppUserPageDto,
  ResetAdminAppUserPasswordDto,
  UpdateAdminAppUserEnabledDto,
  UpdateAdminAppUserProfileDto,
  UpdateAdminAppUserStatusDto,
} from '@libs/user/dto/admin-app-user.dto'
import { UserPointStatsFieldsDto } from '@libs/user/dto/app-user-growth-shared.dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AdminPermission } from '../../common/decorators/admin-permission.decorator'
import { ApiAuditDoc } from '../../common/decorators/api-audit-doc.decorator'
import { AppUserService } from './app-user.service'

/**
 * APP 用户管理控制器
 * 提供管理端 APP 用户的查询、状态维护与成长资产管理接口
 */
@ApiTags('APP管理/用户管理')
@Controller('admin/app-users')
export class AppUserController {
  constructor(private readonly appUserService: AppUserService) {}

  /**
   * 获取 APP 用户分页列表
   */
  @Get('page')
  @AdminPermission({
    code: 'app:users:page',
    name: '分页查询 APP 用户列表',
    groupCode: 'app:users',
  })
  @ApiPageDoc({
    summary: '分页查询 APP 用户列表',
    model: AdminAppUserPageItemDto,
  })
  async getAppUserPage(@Query() query: QueryAdminAppUserPageDto) {
    return this.appUserService.getAppUserPage(query)
  }

  /**
   * 获取 APP 用户详情
   */
  @Get('detail')
  @AdminPermission({
    code: 'app:users:detail',
    name: '获取 APP 用户详情',
    groupCode: 'app:users',
  })
  @ApiDoc({
    summary: '获取 APP 用户详情',
    model: AdminAppUserDetailDto,
  })
  async getAppUserDetail(@Query() query: IdDto) {
    return this.appUserService.getAppUserDetail(query.id)
  }

  @Post('create')
  @AdminPermission({
    code: 'app:users:create',
    name: '新建 APP 用户',
    groupCode: 'app:users',
  })
  @ApiAuditDoc({
    summary: '新建 APP 用户',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.CREATE,
    },
  })
  async createAppUser(
    @Body() body: CreateAdminAppUserDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.appUserService.createAppUser(userId, body)
  }

  /**
   * 更新 APP 用户资料
   */
  @Post('profile/update')
  @AdminPermission({
    code: 'app:users:profile:update',
    name: '更新 APP 用户资料',
    groupCode: 'app:users',
  })
  @ApiAuditDoc({
    summary: '更新 APP 用户资料',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateAppUserProfile(
    @Body() body: UpdateAdminAppUserProfileDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.appUserService.updateAppUserProfile(userId, body)
  }

  /**
   * 更新 APP 用户启用状态
   */
  @Post('update-enabled')
  @AdminPermission({
    code: 'app:users:update:enabled',
    name: '更新 APP 用户启用状态',
    groupCode: 'app:users',
  })
  @ApiAuditDoc({
    summary: '更新 APP 用户启用状态',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateAppUserEnabled(
    @Body() body: UpdateAdminAppUserEnabledDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.appUserService.updateAppUserEnabled(userId, body)
  }

  /**
   * 更新 APP 用户状态
   */
  @Post('update-status')
  @AdminPermission({
    code: 'app:users:update:status',
    name: '更新 APP 用户状态',
    groupCode: 'app:users',
  })
  @ApiAuditDoc({
    summary: '更新 APP 用户状态',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateAppUserStatus(
    @Body() body: UpdateAdminAppUserStatusDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.appUserService.updateAppUserStatus(userId, body)
  }

  @Post('delete')
  @AdminPermission({
    code: 'app:users:delete',
    name: '删除 APP 用户',
    groupCode: 'app:users',
  })
  @ApiAuditDoc({
    summary: '删除 APP 用户',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.DELETE,
    },
  })
  async deleteAppUser(@Body() body: IdDto, @CurrentUser('sub') userId: number) {
    return this.appUserService.deleteAppUser(userId, body.id)
  }

  @Post('restore')
  @AdminPermission({
    code: 'app:users:restore',
    name: '恢复 APP 用户',
    groupCode: 'app:users',
  })
  @ApiAuditDoc({
    summary: '恢复 APP 用户',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async restoreAppUser(
    @Body() body: IdDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.appUserService.restoreAppUser(userId, body.id)
  }

  @Post('rebuild-follow-count')
  @AdminPermission({
    code: 'app:users:rebuild:follow:count',
    name: '重建 APP 用户关注计数',
    groupCode: 'app:users',
  })
  @ApiAuditDoc({
    summary: '重建 APP 用户关注计数',
    model: AdminAppUserFollowCountRepairResultDto,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async rebuildFollowCount(
    @Body() body: UserIdDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.appUserService.rebuildAppUserFollowCounts(userId, body.userId)
  }

  @Post('rebuild-follow-count-all')
  @AdminPermission({
    code: 'app:users:rebuild:follow:count:all',
    name: '全量重建 APP 用户关注计数',
    groupCode: 'app:users',
  })
  @ApiAuditDoc({
    summary: '全量重建 APP 用户关注计数',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async rebuildFollowCountAll(@CurrentUser('sub') userId: number) {
    return this.appUserService.rebuildAllAppUserFollowCounts(userId)
  }

  @Post('password/reset')
  @AdminPermission({
    code: 'app:users:password:reset',
    name: '重置 APP 用户密码',
    groupCode: 'app:users',
  })
  @ApiAuditDoc({
    summary: '重置 APP 用户密码',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async resetAppUserPassword(
    @Body() body: ResetAdminAppUserPasswordDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.appUserService.resetAppUserPassword(userId, body)
  }

  /**
   * 获取 APP 用户积分统计
   */
  @Get('points/stats')
  @AdminPermission({
    code: 'app:users:points:stats',
    name: '获取 APP 用户积分统计',
    groupCode: 'app:users',
  })
  @ApiDoc({
    summary: '获取 APP 用户积分统计',
    model: UserPointStatsFieldsDto,
  })
  async getAppUserPointStats(@Query() query: UserIdDto) {
    return this.appUserService.getAppUserPointStats(query.userId)
  }

  /**
   * 获取 APP 用户积分记录分页
   */
  @Get('points/record/page')
  @AdminPermission({
    code: 'app:users:points:record:page',
    name: '分页查询 APP 用户积分记录',
    groupCode: 'app:users',
  })
  @ApiPageDoc({
    summary: '分页查询 APP 用户积分记录',
    model: AdminAppUserPointRecordDto,
  })
  async getAppUserPointRecords(@Query() query: QueryUserPointRecordDto) {
    return this.appUserService.getAppUserPointRecords(query)
  }

  /**
   * 手动增加 APP 用户积分
   */
  @Post('points/grant')
  @AdminPermission({
    code: 'app:users:points:grant',
    name: '手动增加 APP 用户积分',
    groupCode: 'app:users',
  })
  @ApiAuditDoc({
    summary: '手动增加 APP 用户积分',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.CREATE,
    },
  })
  async addAppUserPoints(
    @Body() body: AdminAppUserGrowthRuleActionDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.appUserService.addAppUserPoints(userId, body)
  }

  /**
   * 手动扣减 APP 用户积分
   */
  @Post('points/consume')
  @AdminPermission({
    code: 'app:users:points:consume',
    name: '手动扣减 APP 用户积分',
    groupCode: 'app:users',
  })
  @ApiAuditDoc({
    summary: '手动扣减 APP 用户积分',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async consumeAppUserPoints(
    @Body() body: ConsumeAdminAppUserPointsDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.appUserService.consumeAppUserPoints(userId, body)
  }

  /**
   * 获取 APP 用户经验统计
   */
  @Get('experience/stats')
  @AdminPermission({
    code: 'app:users:experience:stats',
    name: '获取 APP 用户经验统计',
    groupCode: 'app:users',
  })
  @ApiDoc({
    summary: '获取 APP 用户经验统计',
    model: AdminAppUserExperienceStatsDto,
  })
  async getAppUserExperienceStats(@Query() query: UserIdDto) {
    return this.appUserService.getAppUserExperienceStats(query.userId)
  }

  /**
   * 获取 APP 用户经验记录分页
   */
  @Get('experience/record/page')
  @AdminPermission({
    code: 'app:users:experience:record:page',
    name: '分页查询 APP 用户经验记录',
    groupCode: 'app:users',
  })
  @ApiPageDoc({
    summary: '分页查询 APP 用户经验记录',
    model: AdminAppUserExperienceRecordDto,
  })
  async getAppUserExperienceRecords(
    @Query() query: QueryScopedUserExperienceRecordDto,
  ) {
    return this.appUserService.getAppUserExperienceRecords(query)
  }

  /**
   * 获取 APP 用户混合成长流水分页
   */
  @Get('growth/record/page')
  @AdminPermission({
    code: 'app:users:growth:record:page',
    name: '分页查询 APP 用户混合成长流水',
    groupCode: 'app:users',
  })
  @ApiPageDoc({
    summary: '分页查询 APP 用户混合成长流水',
    model: AdminAppUserGrowthLedgerRecordDto,
  })
  async getAppUserGrowthLedgerRecords(
    @Query() query: QueryAdminAppUserGrowthLedgerDto,
  ) {
    return this.appUserService.getAppUserGrowthLedgerRecords(query)
  }

  /**
   * 手动增加 APP 用户经验
   */
  @Post('experience/grant')
  @AdminPermission({
    code: 'app:users:experience:grant',
    name: '手动增加 APP 用户经验',
    groupCode: 'app:users',
  })
  @ApiAuditDoc({
    summary: '手动增加 APP 用户经验',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.CREATE,
    },
  })
  async addAppUserExperience(
    @Body() body: AdminAppUserGrowthRuleActionDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.appUserService.addAppUserExperience(userId, body)
  }

  /**
   * 获取 APP 用户徽章分页
   */
  @Get('badges/page')
  @AdminPermission({
    code: 'app:users:badges:page',
    name: '分页查询 APP 用户徽章',
    groupCode: 'app:users',
  })
  @ApiPageDoc({
    summary: '分页查询 APP 用户徽章',
    model: UserBadgeItemDto,
  })
  async getAppUserBadges(@Query() query: QueryAdminAppUserBadgeDto) {
    return this.appUserService.getAppUserBadges(query)
  }

  /**
   * 为 APP 用户分配徽章
   */
  @Post('badges/assign')
  @AdminPermission({
    code: 'app:users:badges:assign',
    name: '为 APP 用户分配徽章',
    groupCode: 'app:users',
  })
  @ApiAuditDoc({
    summary: '为 APP 用户分配徽章',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.CREATE,
    },
  })
  async assignAppUserBadge(
    @Body() body: AssignUserBadgeDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.appUserService.assignAppUserBadge(userId, body)
  }

  /**
   * 撤销 APP 用户徽章
   */
  @Post('badges/revoke')
  @AdminPermission({
    code: 'app:users:badges:revoke',
    name: '撤销 APP 用户徽章',
    groupCode: 'app:users',
  })
  @ApiAuditDoc({
    summary: '撤销 APP 用户徽章',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.DELETE,
    },
  })
  async revokeAppUserBadge(
    @Body() body: AssignUserBadgeDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.appUserService.revokeAppUserBadge(userId, body)
  }
}
