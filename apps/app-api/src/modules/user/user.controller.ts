/**
 * 用户控制器
 *
 * 提供用户中心相关的 API 接口，包括：
 * - 用户基本信息获取和更新
 * - 用户计数获取
 * - 用户中心汇总信息
 * - 用户状态信息
 * - 用户资产统计
 * - 用户成长信息（积分、经验、徽章）
 */
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'
import { BaseAppUserDto } from '@libs/user/core'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { QueryMyPointRecordDto, UserPointRecordDto } from './dto/user-point.dto'
import {
  QueryMyBadgeDto,
  QueryMyExperienceRecordDto,
  QueryMyGrowthLedgerRecordDto,
  UpdateMyProfileDto,
  UserAssetsSummaryDto,
  UserBadgeItemDto,
  UserCenterDto,
  UserCountDto,
  UserExperienceRecordDto,
  UserExperienceStatsDto,
  UserGrowthLedgerRecordDto,
  UserGrowthSummaryDto,
  UserPointStatsDto,
  UserStatusSummaryDto,
} from './dto/user.dto'
import { UserService } from './user.service'

@ApiTags('用户')
@Controller('app/user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * 获取当前用户资料
   */
  @Get('profile')
  @ApiDoc({
    summary: '获取当前用户资料',
    model: BaseAppUserDto,
  })
  async getProfile(@CurrentUser('sub') userId: number) {
    return this.userService.getUserProfile(userId)
  }

  /**
   * 更新当前用户资料
   */
  @Post('profile/update')
  @ApiDoc({
    summary: '更新当前用户资料',
    model: Boolean,
  })
  async updateProfile(
    @Body() body: UpdateMyProfileDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.userService.updateUserProfile(userId, body)
  }

  /**
   * 获取当前用户计数
   */
  @Get('counts/stats')
  @ApiDoc({
    summary: '获取当前用户计数',
    model: UserCountDto,
  })
  async getCounts(@CurrentUser('sub') userId: number) {
    return this.userService.getUserCounts(userId)
  }

  /**
   * 获取用户中心汇总信息
   */
  @Get('center')
  @ApiDoc({
    summary: '获取用户中心汇总信息',
    model: UserCenterDto,
  })
  async getCenter(@CurrentUser('sub') userId: number) {
    return this.userService.getUserCenter(userId)
  }

  /**
   * 获取用户状态信息
   */
  @Get('status')
  @ApiDoc({
    summary: '获取用户状态信息',
    model: UserStatusSummaryDto,
  })
  async getStatus(@CurrentUser('sub') userId: number) {
    return this.userService.getUserStatus(userId)
  }

  /**
   * 获取用户资产统计
   */
  @Get('assets/stats')
  @ApiDoc({
    summary: '获取用户资产统计',
    model: UserAssetsSummaryDto,
  })
  async getAssetsSummary(@CurrentUser('sub') userId: number) {
    return this.userService.getUserAssetsSummary(userId)
  }

  /**
   * 获取用户成长汇总
   */
  @Get('growth/summary')
  @ApiDoc({
    summary: '获取用户成长汇总',
    model: UserGrowthSummaryDto,
  })
  async getGrowthSummary(@CurrentUser('sub') userId: number) {
    return this.userService.getUserGrowthSummary(userId)
  }

  /**
   * 获取用户积分统计
   */
  @Get('points/stats')
  @ApiDoc({
    summary: '获取用户积分统计',
    model: UserPointStatsDto,
  })
  async getPointStats(@CurrentUser('sub') userId: number) {
    return this.userService.getUserPointStats(userId)
  }

  /**
   * 查询用户积分记录
   */
  @Get('points/record/page')
  @ApiPageDoc({
    summary: '查询用户积分记录',
    model: UserPointRecordDto,
  })
  async getPointRecords(
    @Query() query: QueryMyPointRecordDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.userService.getUserPointRecords(userId, query)
  }

  /**
   * 获取用户经验统计
   */
  @Get('experience/stats')
  @ApiDoc({
    summary: '获取用户经验统计',
    model: UserExperienceStatsDto,
  })
  async getExperienceStats(@CurrentUser('sub') userId: number) {
    return this.userService.getUserExperienceStats(userId)
  }

  /**
   * 查询用户经验记录
   */
  @Get('experience/record/page')
  @ApiPageDoc({
    summary: '查询用户经验记录',
    model: UserExperienceRecordDto,
  })
  async getExperienceRecords(
    @Query() query: QueryMyExperienceRecordDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.userService.getUserExperienceRecords(userId, query)
  }

  /**
   * 查询用户混合成长流水
   */
  @Get('growth/record/page')
  @ApiPageDoc({
    summary: '查询用户混合成长流水',
    model: UserGrowthLedgerRecordDto,
  })
  async getGrowthLedgerRecords(
    @Query() query: QueryMyGrowthLedgerRecordDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.userService.getUserGrowthLedgerRecords(userId, query)
  }

  /**
   * 查询用户徽章
   */
  @Get('badges/page')
  @ApiPageDoc({
    summary: '查询用户徽章',
    model: UserBadgeItemDto,
  })
  async getBadges(
    @Query() query: QueryMyBadgeDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.userService.getUserBadges(userId, query)
  }
}
