import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import {
  BaseForumReplyDto,
  CreateForumReplyDto,
  QueryForumReplyDto,
  UpdateForumReplyDto,
} from './dto/forum-reply.dto'
import { ForumReplyService } from './forum-reply.service'

/**
 * 客户端论坛回复控制器
 * 提供客户端论坛回复相关的API接口
 */
@ApiTags('论坛/回复模块')
@Controller('forum/reply')
export class ForumReplyController {
  constructor(private readonly forumReplyService: ForumReplyService) {}

  /**
   * 创建论坛回复
   */
  @Post('/create')
  @ApiDoc({
    summary: '创建论坛回复',
    model: IdDto,
  })
  async create(
    @Body() body: CreateForumReplyDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.forumReplyService.createForumReply(body, userId)
  }

  /**
   * 分页查询论坛回复列表
   */
  @Get('/page')
  @ApiPageDoc({
    summary: '分页查询论坛回复列表',
    model: BaseForumReplyDto,
  })
  async getPage(@Query() query: QueryForumReplyDto) {
    return this.forumReplyService.getForumReplyPage(query)
  }

  /**
   * 获取论坛回复详情
   */
  @Get('/detail')
  @ApiDoc({
    summary: '获取论坛回复详情',
    model: BaseForumReplyDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.forumReplyService.getForumReplyDetail(query.id)
  }

  /**
   * 更新论坛回复
   */
  @Post('/update')
  @ApiDoc({
    summary: '更新论坛回复',
    model: IdDto,
  })
  async update(
    @Body() body: UpdateForumReplyDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.forumReplyService.updateForumReply(body, userId)
  }

  /**
   * 删除论坛回复
   */
  @Post('/delete')
  @ApiDoc({
    summary: '删除论坛回复',
    model: IdDto,
  })
  async delete(@Body() body: IdDto, @CurrentUser('id') userId: number) {
    return this.forumReplyService.deleteForumReply(body.id, userId)
  }

  /**
   * 点赞回复
   */
  @Post('/like')
  @ApiDoc({
    summary: '点赞回复',
    model: IdDto,
  })
  async like(@Body() body: IdDto, @CurrentUser('id') userId: number) {
    return this.forumReplyService.likeReply(body.id, userId)
  }

  /**
   * 取消点赞回复
   */
  @Post('/unlike')
  @ApiDoc({
    summary: '取消点赞回复',
    model: IdDto,
  })
  async unlike(@Body() body: IdDto, @CurrentUser('id') userId: number) {
    return this.forumReplyService.unlikeReply(body.id, userId)
  }
}
