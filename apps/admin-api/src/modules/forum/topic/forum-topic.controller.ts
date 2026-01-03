import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { BatchOperationResponseDto, IdDto } from '@libs/base/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { ForumTopicService } from './forum-topic.service'
import {
  BaseForumTopicDto,
  CreateForumTopicDto,
  QueryForumTopicDto,
  UpdateTopicAuditStatusDto,
  UpdateTopicFeaturedDto,
  UpdateTopicLockedDto,
  UpdateTopicPinnedDto,
  UpdateForumTopicDto,
} from './dto/forum-topic.dto'

/**
 * 论坛主题管理控制器
 * 提供论坛主题相关的API接口
 */
@ApiTags('论坛管理/主题管理模块')
@Controller('admin/forum/topic')
export class ForumTopicController {
  constructor(private readonly forumTopicService: ForumTopicService) {}

  /**
   * 创建论坛主题
   */
  @Post('/create')
  @ApiDoc({
    summary: '创建论坛主题',
    model: IdDto,
  })
  async create(@Body() body: CreateForumTopicDto) {
    return this.forumTopicService.createForumTopic(body)
  }

  /**
   * 分页查询论坛主题列表
   */
  @Get('/page')
  @ApiPageDoc({
    summary: '分页查询论坛主题列表',
    model: BaseForumTopicDto,
  })
  async getPage(@Query() query: QueryForumTopicDto) {
    return this.forumTopicService.getForumTopicPage(query)
  }

  /**
   * 获取论坛主题详情
   */
  @Get('/detail')
  @ApiDoc({
    summary: '获取论坛主题详情',
    model: BaseForumTopicDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.forumTopicService.getForumTopicDetail(query.id)
  }

  /**
   * 更新论坛主题
   */
  @Post('/update')
  @ApiDoc({
    summary: '更新论坛主题',
    model: IdDto,
  })
  async update(@Body() body: UpdateForumTopicDto) {
    return this.forumTopicService.updateForumTopic(body)
  }

  /**
   * 软删除论坛主题
   */
  @Post('/delete')
  @ApiDoc({
    summary: '软删除论坛主题',
    model: IdDto,
  })
  async delete(@Body() body: IdDto) {
    return this.forumTopicService.deleteForumTopic(body.id)
  }

  /**
   * 更新主题置顶状态
   */
  @Post('/update-pinned')
  @ApiDoc({
    summary: '更新主题置顶状态',
    model: BatchOperationResponseDto,
  })
  async updatePinned(@Body() body: UpdateTopicPinnedDto) {
    return this.forumTopicService.updatePinnedStatus(body.id, body.isPinned)
  }

  /**
   * 更新主题加精状态
   */
  @Post('/update-featured')
  @ApiDoc({
    summary: '更新主题加精状态',
    model: BatchOperationResponseDto,
  })
  async updateFeatured(@Body() body: UpdateTopicFeaturedDto) {
    return this.forumTopicService.updateFeaturedStatus(body.id, body.isFeatured)
  }

  /**
   * 更新主题锁定状态
   */
  @Post('/update-locked')
  @ApiDoc({
    summary: '更新主题锁定状态',
    model: BatchOperationResponseDto,
  })
  async updateLocked(@Body() body: UpdateTopicLockedDto) {
    return this.forumTopicService.updateLockedStatus(body.id, body.isLocked)
  }

  /**
   * 更新主题审核状态
   */
  @Post('/update-audit-status')
  @ApiDoc({
    summary: '更新主题审核状态',
    model: BatchOperationResponseDto,
  })
  async updateAuditStatus(@Body() body: UpdateTopicAuditStatusDto) {
    return this.forumTopicService.updateAuditStatus(body.id, body.auditStatus)
  }
}
