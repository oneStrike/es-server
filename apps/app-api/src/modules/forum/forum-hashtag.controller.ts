import {
  ForumHashtagCommentPageItemDto,
  PublicForumHashtagDetailDto,
  PublicForumHashtagHotPageItemDto,
  PublicForumHashtagSearchItemDto,
  QueryForumHashtagHotPageDto,
  QueryForumHashtagCommentPageDto,
  QueryForumHashtagTopicPageDto,
  QueryPublicForumHashtagSearchDto,
} from '@libs/forum/hashtag/dto/forum-hashtag.dto'
import { ForumHashtagService } from '@libs/forum/hashtag/forum-hashtag.service'
import { PublicForumTopicPageItemDto } from '@libs/forum/topic/dto/forum-topic.dto'
import {
  ApiCursorPageDoc,
  ApiDoc,
  CurrentUser,
  OptionalAuth,
} from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto/base.dto'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('论坛/话题')
@Controller('app/forum/hashtag')
export class ForumHashtagController {
  constructor(private readonly forumHashtagService: ForumHashtagService) {}

  @Get('detail')
  @OptionalAuth()
  @ApiDoc({
    summary: '获取论坛话题详情',
    model: PublicForumHashtagDetailDto,
  })
  async getDetail(@Query() query: IdDto, @CurrentUser('sub') userId?: number) {
    return this.forumHashtagService.getPublicHashtagDetail(query.id, userId)
  }

  @Get('hot/page')
  @OptionalAuth()
  @ApiCursorPageDoc({
    summary: '分页查询热门论坛话题',
    model: PublicForumHashtagHotPageItemDto,
  })
  async getHotPage(
    @Query() query: QueryForumHashtagHotPageDto,
    @CurrentUser('sub') userId?: number,
  ) {
    return this.forumHashtagService.getHotHashtagPage({
      pageSize: query.pageSize ?? 10,
      cursor: query.cursor,
      userId,
    })
  }

  @Get('topic/page')
  @OptionalAuth()
  @ApiCursorPageDoc({
    summary: '分页查询话题关联的主题',
    model: PublicForumTopicPageItemDto,
  })
  async getTopicPage(
    @Query() query: QueryForumHashtagTopicPageDto,
    @CurrentUser('sub') userId?: number,
  ) {
    return this.forumHashtagService.getHashtagTopicPage(query.id, {
      pageSize: query.pageSize ?? 10,
      cursor: query.cursor,
      userId,
    })
  }

  @Get('comment/page')
  @OptionalAuth()
  @ApiCursorPageDoc({
    summary: '分页查询话题关联的评论',
    model: ForumHashtagCommentPageItemDto,
  })
  async getCommentPage(
    @Query() query: QueryForumHashtagCommentPageDto,
    @CurrentUser('sub') userId?: number,
  ) {
    return this.forumHashtagService.getHashtagCommentPage(query.id, {
      pageSize: query.pageSize ?? 10,
      cursor: query.cursor,
      userId,
    })
  }

  @Get('search/list')
  @OptionalAuth()
  @ApiDoc({
    summary: '搜索可见话题',
    model: PublicForumHashtagSearchItemDto,
    isArray: true,
  })
  async search(
    @Query() query: QueryPublicForumHashtagSearchDto,
    @CurrentUser('sub') userId?: number,
  ) {
    return this.forumHashtagService.searchVisibleHashtags(
      query.keyword,
      userId,
      query.limit,
    )
  }
}
