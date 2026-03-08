import type { JwtUserInfoInterface } from '@libs/base/types'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import {
  BaseUserExperienceRecordDto,
  BaseUserPointRecordDto,
} from '@libs/user'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Audit } from '../../common/decorators/audit.decorator'
import { ActionTypeEnum } from '../system/audit/audit.constant'
import { AppUserService } from './app-user.service'
import {
  AddAdminAppUserExperienceDto,
  AddAdminAppUserPointsDto,
  AdminAppUserBadgeItemDto,
  AdminAppUserBadgeOperationResultDto,
  AdminAppUserDetailDto,
  AdminAppUserExperienceStatsDto,
  AdminAppUserPageItemDto,
  AdminAppUserPointStatsDto,
  AssignAdminAppUserBadgeDto,
  ConsumeAdminAppUserPointsDto,
  QueryAdminAppUserBadgeDto,
  QueryAdminAppUserExperienceRecordDto,
  QueryAdminAppUserIdDto,
  QueryAdminAppUserPageDto,
  QueryAdminAppUserPointRecordDto,
  UpdateAdminAppUserEnabledDto,
  UpdateAdminAppUserProfileDto,
  UpdateAdminAppUserStatusDto,
} from './dto/app-user.dto'

/**
 * APP 用户管理控制器
 * 提供管理端 APP 用户的查询、状态维护与成长资产管理接口
 */
@ApiTags('APP管理/APP用户管理')
@Controller('/admin/app-users')
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

  /**
   * 更新 APP 用户资料
   */
  @Post('update-profile')
  @ApiDoc({
    summary: '更新 APP 用户资料',
    model: AdminAppUserDetailDto,
  })
  @Audit({
    actionType: ActionTypeEnum.UPDATE,
    content: '更新 APP 用户资料',
  })
  async updateAppUserProfile(
    @Body() body: UpdateAdminAppUserProfileDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.appUserService.updateAppUserProfile(user.sub, body)
  }

  /**
   * 更新 APP 用户启用状态
   */
  @Post('update-enabled')
  @ApiDoc({
    summary: '更新 APP 用户启用状态',
    model: AdminAppUserDetailDto,
  })
  @Audit({
    actionType: ActionTypeEnum.UPDATE,
    content: '更新 APP 用户启用状态',
  })
  async updateAppUserEnabled(
    @Body() body: UpdateAdminAppUserEnabledDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.appUserService.updateAppUserEnabled(user.sub, body)
  }

  /**
   * 更新 APP 用户社区状态
   */
  @Post('update-status')
  @ApiDoc({
    summary: '更新 APP 用户社区状态',
    model: AdminAppUserDetailDto,
  })
  @Audit({
    actionType: ActionTypeEnum.UPDATE,
    content: '更新 APP 用户社区状态',
  })
  async updateAppUserStatus(
    @Body() body: UpdateAdminAppUserStatusDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.appUserService.updateAppUserStatus(user.sub, body)
  }

  /**
   * 获取 APP 用户积分统计
   */
  @Get('points/stats')
  @ApiDoc({
    summary: '获取 APP 用户积分统计',
    model: AdminAppUserPointStatsDto,
  })
  async getAppUserPointStats(@Query() query: QueryAdminAppUserIdDto) {
    return this.appUserService.getAppUserPointStats(query.userId)
  }

  /**
   * 获取 APP 用户积分记录分页
   */
  @Get('points/records')
  @ApiPageDoc({
    summary: '分页查询 APP 用户积分记录',
    model: BaseUserPointRecordDto,
  })
  async getAppUserPointRecords(
    @Query() query: QueryAdminAppUserPointRecordDto,
  ) {
    return this.appUserService.getAppUserPointRecords(query)
  }

  /**
   * 手动增加 APP 用户积分
   */
  @Post('points/add')
  @ApiDoc({
    summary: '手动增加 APP 用户积分',
    model: BaseUserPointRecordDto,
  })
  @Audit({
    actionType: ActionTypeEnum.CREATE,
    content: '手动增加 APP 用户积分',
  })
  async addAppUserPoints(
    @Body() body: AddAdminAppUserPointsDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.appUserService.addAppUserPoints(user.sub, body)
  }

  /**
   * 手动扣减 APP 用户积分
   */
  @Post('points/consume')
  @ApiDoc({
    summary: '手动扣减 APP 用户积分',
    model: BaseUserPointRecordDto,
  })
  @Audit({
    actionType: ActionTypeEnum.UPDATE,
    content: '手动扣减 APP 用户积分',
  })
  async consumeAppUserPoints(
    @Body() body: ConsumeAdminAppUserPointsDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.appUserService.consumeAppUserPoints(user.sub, body)
  }

  /**
   * 获取 APP 用户经验统计
   */
  @Get('experience/stats')
  @ApiDoc({
    summary: '获取 APP 用户经验统计',
    model: AdminAppUserExperienceStatsDto,
  })
  async getAppUserExperienceStats(@Query() query: QueryAdminAppUserIdDto) {
    return this.appUserService.getAppUserExperienceStats(query.userId)
  }

  /**
   * 获取 APP 用户经验记录分页
   */
  @Get('experience/records')
  @ApiPageDoc({
    summary: '分页查询 APP 用户经验记录',
    model: BaseUserExperienceRecordDto,
  })
  async getAppUserExperienceRecords(
    @Query() query: QueryAdminAppUserExperienceRecordDto,
  ) {
    return this.appUserService.getAppUserExperienceRecords(query)
  }

  /**
   * 手动增加 APP 用户经验
   */
  @Post('experience/add')
  @ApiDoc({
    summary: '手动增加 APP 用户经验',
    model: BaseUserExperienceRecordDto,
  })
  @Audit({
    actionType: ActionTypeEnum.CREATE,
    content: '手动增加 APP 用户经验',
  })
  async addAppUserExperience(
    @Body() body: AddAdminAppUserExperienceDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.appUserService.addAppUserExperience(user.sub, body)
  }

  /**
   * 获取 APP 用户徽章分页
   */
  @Get('badges')
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
    model: AdminAppUserBadgeOperationResultDto,
  })
  @Audit({
    actionType: ActionTypeEnum.CREATE,
    content: '为 APP 用户分配徽章',
  })
  async assignAppUserBadge(
    @Body() body: AssignAdminAppUserBadgeDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.appUserService.assignAppUserBadge(user.sub, body)
  }

  /**
   * 撤销 APP 用户徽章
   */
  @Post('badges/revoke')
  @ApiDoc({
    summary: '撤销 APP 用户徽章',
    model: AdminAppUserBadgeOperationResultDto,
  })
  @Audit({
    actionType: ActionTypeEnum.DELETE,
    content: '撤销 APP 用户徽章',
  })
  async revokeAppUserBadge(
    @Body() body: AssignAdminAppUserBadgeDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.appUserService.revokeAppUserBadge(user.sub, body)
  }
}
