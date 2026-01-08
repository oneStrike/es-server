import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { BatchOperationResponseDto, IdDto } from '@libs/base/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import {
  BaseForumTopicDto,
  CreateForumTopicDto,
  QueryForumTopicDto,
  UpdateForumTopicDto,
  UpdateTopicAuditStatusDto,
  UpdateTopicFeaturedDto,
  UpdateTopicHiddenDto,
  UpdateTopicLockedDto,
  UpdateTopicPinnedDto,
} from './dto/forum-topic.dto'
import { ForumTopicService } from './forum-topic.service'

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
   * @param body - 创建论坛主题的数据传输对象
   * @returns 创建的论坛主题ID
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
   * @param query - 查询参数
   * @returns 分页的论坛主题列表
   */
  @Get('/page')
  @ApiPageDoc({
    summary: '分页查询论坛主题列表',
    model: BaseForumTopicDto,
  })
  async getPage(@Query() query: QueryForumTopicDto) {
    return this.forumTopicService.getForumTopics(query)
  }

  /**
   * 获取论坛主题详情
   * @param query - 包含主题ID的对象
   * @returns 论坛主题详情
   */
  @Get('/detail')
  @ApiDoc({
    summary: '获取论坛主题详情',
    model: BaseForumTopicDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.forumTopicService.getForumTopicById(query.id)
  }

  /**
   * 更新论坛主题
   * @param body - 更新论坛主题的数据传输对象
   * @returns 更新后的论坛主题
   */
  @Post('/update')
  @ApiDoc({
    summary: '更新论坛主题',
    model: BaseForumTopicDto,
  })
  async update(@Body() body: UpdateForumTopicDto) {
    return this.forumTopicService.updateForumTopic(body)
  }

  /**
   * 删除论坛主题
   * @param body - 包含主题ID的对象
   * @returns 批量操作响应
   */
  @Post('/delete')
  @ApiDoc({
    summary: '删除论坛主题',
    model: BatchOperationResponseDto,
  })
  async delete(@Body() body: IdDto) {
    return this.forumTopicService.deleteForumTopic(body.id)
  }

  /**
   * 更新主题置顶状态
   * @param body - 更新置顶状态的数据传输对象
   * @returns 更新后的论坛主题
   */
  @Post('/update-pinned')
  @ApiDoc({
    summary: '更新主题置顶状态',
    model: BaseForumTopicDto,
  })
  async updatePinned(@Body() body: UpdateTopicPinnedDto) {
    return this.forumTopicService.updateTopicPinned(body)
  }

  /**
   * 更新主题精华状态
   * @param body - 更新精华状态的数据传输对象
   * @returns 更新后的论坛主题
   */
  @Post('/update-featured')
  @ApiDoc({
    summary: '更新主题精华状态',
    model: BaseForumTopicDto,
  })
  async updateFeatured(@Body() body: UpdateTopicFeaturedDto) {
    return this.forumTopicService.updateTopicFeatured(body)
  }

  /**
   * 更新主题锁定状态
   * @param body - 更新锁定状态的数据传输对象
   * @returns 更新后的论坛主题
   */
  @Post('/update-locked')
  @ApiDoc({
    summary: '更新主题锁定状态',
    model: BaseForumTopicDto,
  })
  async updateLocked(@Body() body: UpdateTopicLockedDto) {
    return this.forumTopicService.updateTopicLocked(body)
  }

  /**
   * 更新主题隐藏状态
   * @param body - 更新隐藏状态的数据传输对象
   * @returns 更新后的论坛主题
   */
  @Post('/update-hidden')
  @ApiDoc({
    summary: '更新主题隐藏状态',
    model: BaseForumTopicDto,
  })
  async updateHidden(@Body() body: UpdateTopicHiddenDto) {
    return this.forumTopicService.updateTopicHidden(body)
  }

  /**
   * 更新主题审核状态
   * @param body - 更新审核状态的数据传输对象
   * @returns 更新后的论坛主题
   */
  @Post('/update-audit-status')
  @ApiDoc({
    summary: '更新主题审核状态',
    model: BaseForumTopicDto,
  })
  async updateAuditStatus(@Body() body: UpdateTopicAuditStatusDto) {
    return this.forumTopicService.updateTopicAuditStatus(body)
  }

  /**
   * 增加主题浏览次数
   * @param body - 包含主题ID的对象
   * @returns 更新后的论坛主题
   */
  @Post('/increment-view-count')
  @ApiDoc({
    summary: '增加主题浏览次数',
    model: BaseForumTopicDto,
  })
  async incrementViewCount(@Body() body: IdDto) {
    return this.forumTopicService.incrementViewCount(body.id)
  }
}
