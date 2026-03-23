import {
  BaseUserBadgeDto,
  UserBadgeService,
} from '@libs/growth/badge'
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  AssignUserBadgeDto,
  BadgeUserPageItemDto,
  CreateUserBadgeDto,
  QueryUserBadgeDto,
  UpdateUserBadgeDto,
  UpdateUserBadgeStatusDto,
  UserBadgeStatisticsDto,
} from './dto/badge.dto'

/**
 * 用户徽章管理控制器
 * 提供徽章的创建、更新、删除、分配等管理接口
 *
 * @class UserBadgeController
 */
@Controller('admin/growth/badges')
@ApiTags('用户成长/徽章管理')
export class UserBadgeController {
  constructor(private readonly userBadgeService: UserBadgeService) {}

  @Get('page')
  @ApiPageDoc({
    summary: '获取用户徽章分页',
    model: BaseUserBadgeDto,
  })
  async getAllBadges(@Query() query: QueryUserBadgeDto) {
    return this.userBadgeService.getBadges(query)
  }

  @Get('detail')
  @ApiDoc({
    summary: '获取用户徽章详情',
    model: BaseUserBadgeDto,
  })
  async getBadge(@Query() dto: IdDto) {
    return this.userBadgeService.getBadgeDetail(dto)
  }

  @Post('create')
  @ApiDoc({
    summary: '创建用户徽章',
    model: Boolean,
  })
  async createBadge(@Body() dto: CreateUserBadgeDto) {
    return this.userBadgeService.createBadge(dto)
  }

  @Post('update')
  @ApiDoc({
    summary: '更新用户徽章',
    model: Boolean,
  })
  async updateBadge(@Body() dto: UpdateUserBadgeDto) {
    return this.userBadgeService.updateBadge(dto)
  }

  @Post('delete')
  @ApiDoc({
    summary: '删除用户徽章',
    model: Boolean,
  })
  async deleteBadge(@Body() dto: IdDto) {
    return this.userBadgeService.deleteBadge(dto)
  }

  @Post('update-status')
  @ApiDoc({
    summary: '更新用户徽章状态',
    model: Boolean,
  })
  async updateBadgeStatus(@Body() dto: UpdateUserBadgeStatusDto) {
    return this.userBadgeService.updateBadgeStatus(dto)
  }

  @Post('assign')
  @ApiDoc({
    summary: '为用户分配用户徽章',
    model: Boolean,
  })
  async assignBadge(@Body() dto: AssignUserBadgeDto) {
    return this.userBadgeService.assignBadge(dto)
  }

  @Post('revoke')
  @ApiDoc({
    summary: '撤销用户徽章',
    model: Boolean,
  })
  async revokeBadge(@Body() dto: AssignUserBadgeDto) {
    return this.userBadgeService.revokeBadge(dto)
  }

  @Get('user/page')
  @ApiPageDoc({
    summary: '获取拥有某个用户徽章的用户列表',
    model: BadgeUserPageItemDto,
  })
  async getBadgeUsers(
    @Query('badgeId') badgeId: number,
    @Query() query: QueryUserBadgeDto,
  ) {
    return this.userBadgeService.getBadgeUsers(badgeId, query)
  }

  @Get('stats')
  @ApiDoc({
    summary: '获取用户徽章统计信息',
    model: UserBadgeStatisticsDto,
  })
  async getBadgeStatistics() {
    return this.userBadgeService.getBadgeStatistics()
  }
}
