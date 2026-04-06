import { AssignUserBadgeDto, UserBadgeItemDto } from '@libs/growth/badge/dto/user-badge-management.dto';
import { QueryUserExperienceRecordDto } from '@libs/growth/experience/dto/experience-record.dto';
import { QueryUserPointRecordDto } from '@libs/growth/point/dto/point-record.dto';
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators/api-doc.decorator';
import { CurrentUser } from '@libs/platform/decorators/current-user.decorator';
import { IdDto, UserIdDto } from '@libs/platform/dto/base.dto';
import { AddAdminAppUserExperienceDto, AddAdminAppUserPointsDto, AdminAppUserDetailDto, AdminAppUserExperienceRecordDto, AdminAppUserExperienceStatsDto, AdminAppUserFollowCountRepairResultDto, AdminAppUserGrowthLedgerRecordDto, AdminAppUserPageItemDto, AdminAppUserPointRecordDto, AdminAppUserPointStatsDto, ConsumeAdminAppUserPointsDto, CreateAdminAppUserDto, QueryAdminAppUserBadgeDto, QueryAdminAppUserGrowthLedgerDto, QueryAdminAppUserPageDto, ResetAdminAppUserPasswordDto, UpdateAdminAppUserEnabledDto, UpdateAdminAppUserProfileDto, UpdateAdminAppUserStatusDto } from '@libs/user/dto/admin-app-user.dto';
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiAuditDoc } from '../../common/decorators/api-audit-doc.decorator'
import { AuditActionTypeEnum } from '../system/audit/audit.constant'
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
  @ApiAuditDoc({
    summary: '删除 APP 用户',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.DELETE,
    },
  })
  async deleteAppUser(
    @Body() body: IdDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.appUserService.deleteAppUser(userId, body.id)
  }

  @Post('restore')
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
  async getAppUserPointRecords(@Query() query: QueryUserPointRecordDto) {
    return this.appUserService.getAppUserPointRecords(query)
  }

  /**
   * 手动增加 APP 用户积分
   */
  @Post('points/grant')
  @ApiAuditDoc({
    summary: '手动增加 APP 用户积分',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.CREATE,
    },
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
    @Query() query: QueryUserExperienceRecordDto,
  ) {
    return this.appUserService.getAppUserExperienceRecords(query)
  }

  /**
   * 获取 APP 用户混合成长流水分页
   */
  @Get('growth/record/page')
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
  @ApiAuditDoc({
    summary: '手动增加 APP 用户经验',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.CREATE,
    },
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
    model: UserBadgeItemDto,
  })
  async getAppUserBadges(@Query() query: QueryAdminAppUserBadgeDto) {
    return this.appUserService.getAppUserBadges(query)
  }

  /**
   * 为 APP 用户分配徽章
   */
  @Post('badges/assign')
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
