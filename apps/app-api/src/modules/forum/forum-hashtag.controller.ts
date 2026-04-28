import {
  ForumHashtagCommentPageItemDto,
  PublicForumHashtagDetailDto,
  PublicForumHashtagHotPageItemDto,
  PublicForumHashtagSearchItemDto,
  QueryForumHashtagCommentPageDto,
  QueryForumHashtagTopicPageDto,
  QueryPublicForumHashtagSearchDto,
} from '@libs/forum/hashtag/dto/forum-hashtag.dto'
import { ForumHashtagService } from '@libs/forum/hashtag/forum-hashtag.service'
import { PublicForumTopicPageItemDto } from '@libs/forum/topic/dto/forum-topic.dto'
import {
  ApiDoc,
  ApiPageDoc,
  CurrentUser,
  OptionalAuth,
} from '@libs/platform/decorators'
import { IdDto, PageDto } from '@libs/platform/dto'
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
  @ApiPageDoc({
    summary: '分页查询热门论坛话题',
    model: PublicForumHashtagHotPageItemDto,
  })
  async getHotPage(
    @Query() query: PageDto,
    @CurrentUser('sub') userId?: number,
  ) {
    return this.forumHashtagService.getHotHashtagPage({
      pageIndex: query.pageIndex ?? 1,
      pageSize: query.pageSize ?? 10,
      userId,
    })
  }

  @Get('topic/page')
  @OptionalAuth()
  @ApiPageDoc({
    summary: '分页查询话题关联的主题',
    model: PublicForumTopicPageItemDto,
  })
  async getTopicPage(
    @Query() query: QueryForumHashtagTopicPageDto,
    @CurrentUser('sub') userId?: number,
  ) {
    return this.forumHashtagService.getHashtagTopicPage(query.id, {
      pageIndex: query.pageIndex ?? 1,
      pageSize: query.pageSize ?? 10,
      userId,
    })
  }

  @Get('comment/page')
  @OptionalAuth()
  @ApiPageDoc({
    summary: '分页查询话题关联的评论',
    model: ForumHashtagCommentPageItemDto,
  })
  async getCommentPage(
    @Query() query: QueryForumHashtagCommentPageDto,
    @CurrentUser('sub') userId?: number,
  ) {
    return this.forumHashtagService.getHashtagCommentPage(query.id, {
      pageIndex: query.pageIndex ?? 1,
      pageSize: query.pageSize ?? 10,
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
