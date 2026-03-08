import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import {
  LikeDto,
  LikeListQueryDto,
  LikeService,
  UnlikeDto,
} from '@libs/interaction'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('点赞模块')
@Controller('app/like')
export class LikeController {
  constructor(private readonly likeService: LikeService) {}

  @Post()
  @ApiDoc({
    summary: '点赞',
    model: IdDto,
  })
  async like(@Body() body: LikeDto, @CurrentUser('sub') userId: number) {
    await this.likeService.like(body.targetType, body.targetId, userId)
    return { id: body.targetId }
  }

  @Post('cancel')
  @ApiDoc({
    summary: '取消点赞',
    model: IdDto,
  })
  async unlike(@Body() body: UnlikeDto, @CurrentUser('sub') userId: number) {
    await this.likeService.unlike(body.targetType, body.targetId, userId)
    return { id: body.targetId }
  }

  @Get('status')
  @ApiDoc({
    summary: '查询点赞状态',
    model: Boolean,
  })
  async status(@Query() query: LikeDto, @CurrentUser('sub') userId: number) {
    return {
      isLiked: await this.likeService.checkLikeStatus(
        query.targetType,
        query.targetId,
        userId,
      ),
    }
  }

  @Get('my')
  @ApiPageDoc({
    summary: '分页查询我的点赞记录',
    model: IdDto,
  })
  async my(@Query() query: LikeListQueryDto, @CurrentUser('sub') userId: number) {
    return this.likeService.getUserLikes(
      userId,
      query.targetType,
      query.pageIndex,
      query.pageSize,
    )
  }
}
