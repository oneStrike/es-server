import {
  FollowAuthorPageItemDto,
  FollowSectionPageItemDto,
  FollowStatusResponseDto,
  FollowTargetDto,
  FollowUserPageItemDto,
} from '@libs/interaction/follow/dto/follow.dto'
import { FollowService } from '@libs/interaction/follow/follow.service'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'

import { IdDto, PageDto } from '@libs/platform/dto'

import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('关注')
@Controller('app/follow')
export class FollowController {
  constructor(private readonly followService: FollowService) {}

  @Post('follow')
  @ApiDoc({
    summary: '关注目标',
    model: IdDto,
  })
  async follow(
    @Body() body: FollowTargetDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.followService.follow({
      ...body,
      userId,
    })
  }

  @Post('cancel')
  @ApiDoc({
    summary: '取消关注',
    model: Boolean,
  })
  async unfollow(
    @Body() body: FollowTargetDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.followService.unfollow({
      ...body,
      userId,
    })
  }

  @Get('status')
  @ApiDoc({
    summary: '查询关注状态',
    model: FollowStatusResponseDto,
  })
  async status(
    @Query() query: FollowTargetDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.followService.checkFollowStatus({
      ...query,
      userId,
    })
  }

  @Get('author/page')
  @ApiPageDoc({
    summary: '分页查询我关注的作者',
    model: FollowAuthorPageItemDto,
  })
  async authorPage(
    @Query() query: PageDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.followService.getUserAuthorFollows({
      ...query,
      userId,
    })
  }

  @Get('section/page')
  @ApiPageDoc({
    summary: '分页查询我关注的论坛板块',
    model: FollowSectionPageItemDto,
  })
  async sectionPage(
    @Query() query: PageDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.followService.getUserSectionFollows({
      ...query,
      userId,
    })
  }

  @Get('my/following/page')
  @ApiPageDoc({
    summary: '分页查询我关注的用户',
    model: FollowUserPageItemDto,
  })
  async myFollowing(
    @Query() query: PageDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.followService.getMyFollowingUserPage({
      ...query,
      userId,
    })
  }

  @Get('my/follower/page')
  @ApiPageDoc({
    summary: '分页查询关注我的用户',
    model: FollowUserPageItemDto,
  })
  async myFollower(
    @Query() query: PageDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.followService.getMyFollowerUserPage({
      ...query,
      userId,
    })
  }
}
