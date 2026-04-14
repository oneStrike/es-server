import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators/api-doc.decorator'
import { CurrentUser } from '@libs/platform/decorators/current-user.decorator'
import { BaseAppUserDto } from '@libs/user/dto/base-app-user.dto'
import {
  ChangeMyPhoneDto,
  QueryMyBadgeDto,
  QueryMyExperienceRecordDto,
  QueryMyPointRecordDto,
  QueryUserCenterDto,
  QueryUserMentionPageDto,
  UpdateMyProfileDto,
  UserBadgeItemDto,
  UserCenterDto,
  UserExperienceRecordDto,
  UserExperienceStatsDto,
  UserMentionCandidateDto,
  UserPointRecordDto,
  UserPointStatsDto,
  UserStatusSummaryDto,
} from '@libs/user/dto/user-self.dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
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
   * 换绑当前用户手机号
   */
  @Post('phone/change')
  @ApiDoc({
    summary: '换绑当前用户手机号',
    model: Boolean,
  })
  async changePhone(
    @Body() body: ChangeMyPhoneDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.userService.changeMyPhone(userId, body)
  }

  /**
   * 获取用户中心汇总信息
   */
  @Get('center')
  @ApiDoc({
    summary: '获取用户中心汇总信息',
    model: UserCenterDto,
  })
  async getCenter(
    @CurrentUser('sub') userId: number,
    @Query() query: QueryUserCenterDto,
  ) {
    return this.userService.getUserCenter(query.userId || userId)
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

  /**
   * 查询 @ 提及候选用户。
   */
  @Get('mention/page')
  @ApiPageDoc({
    summary: '查询 @ 提及候选用户',
    model: UserMentionCandidateDto,
  })
  async getMentionCandidates(@Query() query: QueryUserMentionPageDto) {
    return this.userService.getMentionCandidates(query)
  }
}
