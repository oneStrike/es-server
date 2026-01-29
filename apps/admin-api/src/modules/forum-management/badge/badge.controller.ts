import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import {
  BaseForumBadgeDto,
  CreateForumBadgeDto,
  ForumBadgeService,
  QueryForumBadgeDto,
  UpdateForumBadgeDto,
  UserBadgeDto,
} from '@libs/forum/badge'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@Controller('/admin/forum/badges')
@ApiTags('论坛模块/徽章管理')
export class ForumBadgeController {
  constructor(private readonly forumBadgeService: ForumBadgeService) {}

  @Get('page')
  @ApiPageDoc({
    summary: '获取论坛徽章分页',
    model: BaseForumBadgeDto,
  })
  async getAllForumBadges(@Query() query: QueryForumBadgeDto) {
    return this.forumBadgeService.getBadges(query)
  }

  @Get('detail')
  @ApiDoc({
    summary: '获取徽章详情',
    model: BaseForumBadgeDto,
  })
  async getBadge(@Query() dto: IdDto) {
    return this.forumBadgeService.getBadge(dto)
  }

  @Post('create')
  @ApiDoc({
    summary: '创建徽章',
    model: BaseForumBadgeDto,
  })
  async createBadge(@Body() dto: CreateForumBadgeDto) {
    return this.forumBadgeService.createBadge(dto)
  }

  @Post('update')
  @ApiDoc({
    summary: '更新徽章',
    model: BaseForumBadgeDto,
  })
  async updateBadge(@Body() dto: UpdateForumBadgeDto) {
    return this.forumBadgeService.updateBadge(dto)
  }

  @Post('delete')
  @ApiDoc({
    summary: '删除徽章',
    model: BaseForumBadgeDto,
  })
  async deleteBadge(@Body() dto: IdDto) {
    return this.forumBadgeService.deleteBadge(dto)
  }

  @Post('update-status')
  @ApiDoc({
    summary: '更新徽章状态',
    model: BaseForumBadgeDto,
  })
  async updateBadgeStatus(@Body() dto: UpdateForumBadgeDto) {
    return this.forumBadgeService.updateBadge(dto)
  }

  @Post('assign')
  @ApiDoc({
    summary: '为用户分配徽章',
    model: BaseForumBadgeDto,
  })
  async assignBadge(@Body() dto: UserBadgeDto) {
    return this.forumBadgeService.assignBadge(dto)
  }

  @Post('revoke')
  @ApiDoc({
    summary: '撤销用户的徽章',
    model: BaseForumBadgeDto,
  })
  async revokeBadge(@Body() dto: UserBadgeDto) {
    return this.forumBadgeService.revokeBadge(dto)
  }

  @Get('users')
  @ApiPageDoc({
    summary: '获取拥有某个徽章的用户列表',
    model: BaseForumBadgeDto,
  })
  async getBadgeUsers(
    @Query('badgeId') badgeId: number,
    @Query() query: QueryForumBadgeDto,
  ) {
    return this.forumBadgeService.getBadgeUsers(badgeId, query)
  }

  @Get('statistics')
  @ApiDoc({
    summary: '获取徽章统计信息',
    model: BaseForumBadgeDto,
  })
  async getBadgeStatistics() {
    return this.forumBadgeService.getBadgeStatistics()
  }
}
