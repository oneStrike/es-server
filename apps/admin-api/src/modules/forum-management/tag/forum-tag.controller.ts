import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import {
  AssignForumTagToTopicDto,
  CreateForumTagDto,
  ForumTagService,
  QueryForumTagDto,
  RemoveForumTagFromTopicDto,
  UpdateForumTagDto,
} from '@libs/forum/tag'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@Controller('/admin/forum/tags')
@ApiTags('论坛模块/标签管理')
export class ForumTagController {
  constructor(private readonly forumTagService: ForumTagService) {}

  @Get('list')
  @ApiPageDoc({
    summary: '查看标签列表',
    model: CreateForumTagDto,
  })
  async getTagList(@Query() query: QueryForumTagDto) {
    return this.forumTagService.getTags(query)
  }

  @Get('detail')
  @ApiDoc({
    summary: '查看标签详情',
    model: CreateForumTagDto,
  })
  async getTagDetail(@Query() query: IdDto) {
    return this.forumTagService.getTagById(query.id)
  }

  @Get('popular')
  @ApiDoc({
    summary: '获取热门标签',
    model: CreateForumTagDto,
  })
  async getPopularTags(@Query('limit') limit?: number) {
    return this.forumTagService.getPopularTags(limit)
  }

  @Get('system')
  @ApiDoc({
    summary: '获取系统标签',
    model: CreateForumTagDto,
  })
  async getSystemTags() {
    return this.forumTagService.getEnabledTags()
  }

  @Get('user')
  @ApiDoc({
    summary: '获取用户标签',
    model: CreateForumTagDto,
  })
  async getUserTags() {
    return this.forumTagService.getEnabledTags()
  }

  @Get('topic-tags')
  @ApiDoc({
    summary: '获取主题的所有标签',
    model: CreateForumTagDto,
  })
  async getTopicTags(@Query('topicId') topicId: number) {
    return this.forumTagService.getTopicTags(topicId)
  }

  @Post('add')
  @ApiDoc({
    summary: '添加标签',
    model: CreateForumTagDto,
  })
  async addTag(@Body() dto: CreateForumTagDto) {
    return this.forumTagService.createTag(dto)
  }

  @Post('update')
  @ApiDoc({
    summary: '更新标签',
    model: UpdateForumTagDto,
  })
  async updateTag(@Body() dto: UpdateForumTagDto) {
    return this.forumTagService.updateTag(dto)
  }

  @Post('remove')
  @ApiDoc({
    summary: '删除标签',
  })
  async removeTag(@Body() dto: IdDto) {
    return this.forumTagService.deleteTag(dto.id)
  }

  @Post('assign')
  @ApiDoc({
    summary: '为主题分配标签',
  })
  async assignTagToTopic(@Body() dto: AssignForumTagToTopicDto) {
    return this.forumTagService.assignTagToTopic(dto)
  }

  @Post('remove-tag')
  @ApiDoc({
    summary: '从主题移除标签',
  })
  async removeTagFromTopic(@Body() dto: RemoveForumTagFromTopicDto) {
    return this.forumTagService.removeTagFromTopic(dto)
  }
}
