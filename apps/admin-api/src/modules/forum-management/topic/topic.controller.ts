import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import {
  BaseForumTopicDto,
  CreateForumTopicDto,
  ForumTopicService,
  QueryForumTopicDto,
  UpdateForumTopicDto,
  UpdateTopicAuditStatusDto,
  UpdateTopicFeaturedDto,
  UpdateTopicHiddenDto,
  UpdateTopicLockedDto,
  UpdateTopicPinnedDto,
} from '@libs/forum/topic'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('论坛模块/主题管理模块')
@Controller('admin/forum/topic')
export class ForumTopicController {
  constructor(private readonly forumTopicService: ForumTopicService) {}

  @Get('/page')
  @ApiPageDoc({
    summary: '分页查询论坛主题列表',
    model: BaseForumTopicDto,
  })
  async getPage(@Query() query: QueryForumTopicDto) {
    return this.forumTopicService.getTopics(query)
  }

  @Get('/detail')
  @ApiDoc({
    summary: '获取论坛主题详情',
    model: BaseForumTopicDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.forumTopicService.getTopicById(query.id)
  }

  @Post('/create')
  @ApiDoc({
    summary: '创建论坛主题',
    model: BaseForumTopicDto,
  })
  async create(@Body() body: CreateForumTopicDto) {
    return this.forumTopicService.createForumTopic(body)
  }

  @Post('/update')
  @ApiDoc({
    summary: '更新论坛主题',
    model: BaseForumTopicDto,
  })
  async update(@Body() body: UpdateForumTopicDto) {
    return this.forumTopicService.updateForumTopic(body)
  }

  @Post('/delete')
  @ApiDoc({
    summary: '删除论坛主题',
    model: BaseForumTopicDto,
  })
  async delete(@Body() body: IdDto) {
    return this.forumTopicService.deleteTopic(body.id)
  }

  @Post('/update-pinned')
  @ApiDoc({
    summary: '更新主题置顶状态',
    model: BaseForumTopicDto,
  })
  async updatePinned(@Body() body: UpdateTopicPinnedDto) {
    return this.forumTopicService.updateTopicPinned(body)
  }

  @Post('/update-featured')
  @ApiDoc({
    summary: '更新主题精华状态',
    model: BaseForumTopicDto,
  })
  async updateFeatured(@Body() body: UpdateTopicFeaturedDto) {
    return this.forumTopicService.updateTopicFeatured(body)
  }

  @Post('/update-locked')
  @ApiDoc({
    summary: '更新主题锁定状态',
    model: BaseForumTopicDto,
  })
  async updateLocked(@Body() body: UpdateTopicLockedDto) {
    return this.forumTopicService.updateTopicLocked(body)
  }

  @Post('/update-hidden')
  @ApiDoc({
    summary: '更新主题隐藏状态',
    model: BaseForumTopicDto,
  })
  async updateHidden(@Body() body: UpdateTopicHiddenDto) {
    return this.forumTopicService.updateTopicHidden(body)
  }

  @Post('/update-audit-status')
  @ApiDoc({
    summary: '更新主题审核状态',
    model: BaseForumTopicDto,
  })
  async updateAuditStatus(@Body() body: UpdateTopicAuditStatusDto) {
    return this.forumTopicService.updateTopicAuditStatus(body)
  }

  @Post('/increment-view-count')
  @ApiDoc({
    summary: '增加主题浏览次数',
    model: BaseForumTopicDto,
  })
  async incrementViewCount(@Body() body: IdDto) {
    return this.forumTopicService.incrementViewCount(body.id)
  }
}
