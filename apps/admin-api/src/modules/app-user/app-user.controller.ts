import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'
import { IdDto, UserIdDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Audit } from '../../common/decorators/audit.decorator'
import { AuditActionTypeEnum } from '../system/audit/audit.constant'
import { AppUserService } from './app-user.service'
import {
  AddAdminAppUserExperienceDto,
  AddAdminAppUserPointsDto,
  AdminAppUserBadgeItemDto,
  AdminAppUserDetailDto,
  AdminAppUserExperienceRecordDto,
  AdminAppUserExperienceStatsDto,
  AdminAppUserFollowCountRepairResultDto,
  AdminAppUserPageItemDto,
  AdminAppUserPointRecordDto,
  AdminAppUserPointStatsDto,
  AssignAdminAppUserBadgeDto,
  ConsumeAdminAppUserPointsDto,
  CreateAdminAppUserDto,
  QueryAdminAppUserBadgeDto,
  QueryAdminAppUserExperienceRecordDto,
  QueryAdminAppUserPageDto,
  QueryAdminAppUserPointRecordDto,
  ResetAdminAppUserPasswordDto,
  UpdateAdminAppUserEnabledDto,
  UpdateAdminAppUserProfileDto,
  UpdateAdminAppUserStatusDto,
} from './dto/app-user.dto'

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
  @ApiDoc({
    summary: '获取 APP 用户详情',
    model: AdminAppUserDetailDto,
  })
  async getAppUserDetail(@Query() query: IdDto) {
    return this.appUserService.getAppUserDetail(query.id)
  }

  @Post('create')
  @ApiDoc({
    summary: '新建 APP 用户',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.CREATE,
    content: '新建 APP 用户',
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
  @ApiDoc({
    summary: '更新 APP 用户资料',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '更新 APP 用户资料',
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
  @ApiDoc({
    summary: '更新 APP 用户启用状态',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '更新 APP 用户启用状态',
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
  @ApiDoc({
    summary: '更新 APP 用户状态',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '更新 APP 用户状态',
  })
  async updateAppUserStatus(
    @Body() body: UpdateAdminAppUserStatusDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.appUserService.updateAppUserStatus(userId, body)
  }

  @Post('delete')
  @ApiDoc({
    summary: '删除 APP 用户',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.DELETE,
    content: '删除 APP 用户',
  })
  async deleteAppUser(
    @Body() body: IdDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.appUserService.deleteAppUser(userId, body.id)
  }

  @Post('restore')
  @ApiDoc({
    summary: '恢复 APP 用户',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '恢复 APP 用户',
  })
  async restoreAppUser(
    @Body() body: IdDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.appUserService.restoreAppUser(userId, body.id)
  }

  @Post('rebuild-follow-count')
  @ApiDoc({
    summary: '重建 APP 用户关注计数',
    model: AdminAppUserFollowCountRepairResultDto,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '重建 APP 用户关注计数',
  })
  async rebuildFollowCount(
    @Body() body: UserIdDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.appUserService.rebuildAppUserFollowCounts(userId, body.userId)
  }

  @Post('rebuild-follow-count-all')
  @ApiDoc({
    summary: '全量重建 APP 用户关注计数',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '全量重建 APP 用户关注计数',
  })
  async rebuildFollowCountAll(@CurrentUser('sub') userId: number) {
    return this.appUserService.rebuildAllAppUserFollowCounts(userId)
  }

  @Post('password/reset')
  @ApiDoc({
    summary: '重置 APP 用户密码',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '重置 APP 用户密码',
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
  @ApiDoc({
    summary: '获取 APP 用户积分统计',
    model: AdminAppUserPointStatsDto,
  })
  async getAppUserPointStats(@Query() query: UserIdDto) {
    return this.appUserService.getAppUserPointStats(query.userId)
  }

  /**
   * 获取 APP 用户积分记录分页
   */
  @Get('points/record/page')
  @ApiPageDoc({
    summary: '分页查询 APP 用户积分记录',
    model: AdminAppUserPointRecordDto,
  })
  async getAppUserPointRecords(
    @Query() query: QueryAdminAppUserPointRecordDto,
  ) {
    return this.appUserService.getAppUserPointRecords(query)
  }

  /**
   * 手动增加 APP 用户积分
   */
  @Post('points/grant')
  @ApiDoc({
    summary: '手动增加 APP 用户积分',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.CREATE,
    content: '手动增加 APP 用户积分',
  })
  async addAppUserPoints(
    @Body() body: AddAdminAppUserPointsDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.appUserService.addAppUserPoints(userId, body)
  }

  /**
   * 手动扣减 APP 用户积分
   */
  @Post('points/consume')
  @ApiDoc({
    summary: '手动扣减 APP 用户积分',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '手动扣减 APP 用户积分',
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
  @ApiPageDoc({
    summary: '分页查询 APP 用户经验记录',
    model: AdminAppUserExperienceRecordDto,
  })
  async getAppUserExperienceRecords(
    @Query() query: QueryAdminAppUserExperienceRecordDto,
  ) {
    return this.appUserService.getAppUserExperienceRecords(query)
  }

  /**
   * 手动增加 APP 用户经验
   */
  @Post('experience/grant')
  @ApiDoc({
    summary: '手动增加 APP 用户经验',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.CREATE,
    content: '手动增加 APP 用户经验',
  })
  async addAppUserExperience(
    @Body() body: AddAdminAppUserExperienceDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.appUserService.addAppUserExperience(userId, body)
  }

  /**
   * 获取 APP 用户徽章分页
   */
  @Get('badges/page')
  @ApiPageDoc({
    summary: '分页查询 APP 用户徽章',
    model: AdminAppUserBadgeItemDto,
  })
  async getAppUserBadges(@Query() query: QueryAdminAppUserBadgeDto) {
    return this.appUserService.getAppUserBadges(query)
  }

  /**
   * 为 APP 用户分配徽章
   */
  @Post('badges/assign')
  @ApiDoc({
    summary: '为 APP 用户分配徽章',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.CREATE,
    content: '为 APP 用户分配徽章',
  })
  async assignAppUserBadge(
    @Body() body: AssignAdminAppUserBadgeDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.appUserService.assignAppUserBadge(userId, body)
  }

  /**
   * 撤销 APP 用户徽章
   */
  @Post('badges/revoke')
  @ApiDoc({
    summary: '撤销 APP 用户徽章',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.DELETE,
    content: '撤销 APP 用户徽章',
  })
  async revokeAppUserBadge(
    @Body() body: AssignAdminAppUserBadgeDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.appUserService.revokeAppUserBadge(userId, body)
  }
}
