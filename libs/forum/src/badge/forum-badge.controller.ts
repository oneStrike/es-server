import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { BaseDto } from '@libs/base/dto'
import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import {
  BaseForumBadgeDto,
  CreateForumBadgeDto,
  QueryForumBadgeDto,
  UpdateForumBadgeDto,
  AssignBadgeDto,
} from './dto/forum-badge.dto'
import { ForumBadgeService } from './forum-badge.service'

@ApiTags('论坛管理/徽章管理模块')
@Controller('admin/forum/badge')
export class ForumBadgeController {
  constructor(
    private readonly forumBadgeService: ForumBadgeService,
  ) {}

  @Post('/create')
  @ApiDoc({
    summary: '创建徽章',
    model: BaseForumBadgeDto,
  })
  async create(@Body() body: CreateForumBadgeDto) {
    return this.forumBadgeService.createBadge(body)
  }

  @Put('/update/:id')
  @ApiDoc({
    summary: '更新徽章',
    model: BaseForumBadgeDto,
  })
  async update(@Param('id') id: number, @Body() body: UpdateForumBadgeDto) {
    return this.forumBadgeService.updateBadge(id, body)
  }

  @Delete('/delete/:id')
  @ApiDoc({
    summary: '删除徽章',
    model: BaseDto,
  })
  async delete(@Param('id') id: number) {
    return this.forumBadgeService.deleteBadge(id)
  }

  @Get('/detail/:id')
  @ApiDoc({
    summary: '获取徽章详情',
    model: BaseForumBadgeDto,
  })
  async getDetail(@Param('id') id: number) {
    return this.forumBadgeService.getBadge(id)
  }

  @Get('/page')
  @ApiPageDoc({
    summary: '分页查询徽章列表',
    model: BaseForumBadgeDto,
  })
  async getPage(@Query() query: QueryForumBadgeDto) {
    return this.forumBadgeService.getBadges(query)
  }

  @Post('/assign')
  @ApiDoc({
    summary: '分配徽章给用户',
    model: BaseDto,
  })
  async assign(@Body() body: AssignBadgeDto) {
    return this.forumBadgeService.assignBadge(body)
  }

  @Post('/revoke')
  @ApiDoc({
    summary: '撤销用户徽章',
    model: BaseDto,
  })
  async revoke(@Body() body: AssignBadgeDto) {
    const { profileId, badgeId } = body
    return this.forumBadgeService.revokeBadge(profileId, badgeId)
  }

  @Get('/user-badges/:profileId')
  @ApiDoc({
    summary: '获取用户徽章列表',
    model: {
      profileId: 1,
      badges: [BaseForumBadgeDto],
      total: 5,
    },
  })
  async getUserBadges(@Param('profileId') profileId: number, @Query() query: QueryForumBadgeDto) {
    return this.forumBadgeService.getUserBadges(profileId, query)
  }

  @Get('/badge-users/:badgeId')
  @ApiPageDoc({
    summary: '获取徽章用户列表',
    model: BaseDto,
  })
  async getBadgeUsers(@Param('badgeId') badgeId: number, @Query() query: QueryForumBadgeDto) {
    return this.forumBadgeService.getBadgeUsers(badgeId, query)
  }

  @Get('/statistics')
  @ApiDoc({
    summary: '获取徽章统计信息',
    model: {
      totalBadges: 10,
      enabledCount: 8,
      disabledCount: 2,
      totalAssignments: 100,
      typeDistribution: [
        {
          type: 1,
          count: 3,
        },
      ],
      topBadges: [
        {
          badge: BaseForumBadgeDto,
          count: 20,
        },
      ],
    },
  })
  async getStatistics() {
    return this.forumBadgeService.getBadgeStatistics()
  }
}
