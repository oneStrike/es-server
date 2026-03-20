import {
  LikeService,
} from '@libs/interaction'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  LikePageItemDto,
  LikePageQueryDto,
  LikeStatusResponseDto,
  LikeTargetDto,
} from './dto/like.dto'

@ApiTags('点赞')
@Controller('app/like')
export class LikeController {
  constructor(private readonly likeService: LikeService) { }

  @Post('like')
  @ApiDoc({
    summary: '点赞',
    model: Boolean,
  })
  async like(@Body() body: LikeTargetDto, @CurrentUser('sub') userId: number) {
    await this.likeService.like({
      ...body,
      userId,
    })
    return true
  }

  @Post('cancel')
  @ApiDoc({
    summary: '取消点赞',
    model: Boolean,
  })
  async unlike(
    @Body() body: LikeTargetDto,
    @CurrentUser('sub') userId: number,
  ) {
    await this.likeService.unlike({
      ...body,
      userId,
    })
    return true
  }

  @Get('status')
  @ApiDoc({
    summary: '查询点赞状态',
    model: LikeStatusResponseDto,
  })
  async status(
    @Query() query: LikeTargetDto,
    @CurrentUser('sub') userId: number,
  ) {
    return {
      isLiked: await this.likeService.checkLikeStatus({
        ...query,
        userId,
      }),
    }
  }

  @Get('my/page')
  @ApiPageDoc({
    summary: '分页查询我的点赞记录',
    model: LikePageItemDto,
  })
  async my(@Query() query: LikePageQueryDto, @CurrentUser('sub') userId: number) {
    return this.likeService.getUserLikes({
      ...query,
      userId,
    })
  }
}
