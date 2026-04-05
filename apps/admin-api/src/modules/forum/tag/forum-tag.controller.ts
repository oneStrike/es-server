import {
  AssignForumTagToTopicDto,
  BaseForumTagDto,
  CreateForumTagDto,
  ForumTagService,
  QueryForumTagDto,
  UpdateForumTagDto,
} from '@libs/forum/tag'
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Audit } from '../../../common/decorators/audit.decorator'
import { AuditActionTypeEnum } from '../../system/audit/audit.constant'
import { ForumTagDetailResponseDto } from './dto/forum-tag-response.dto'

@Controller('admin/forum/tags')
@ApiTags('论坛管理/标签管理')
export class ForumTagController {
  constructor(private readonly forumTagService: ForumTagService) {}

  @Get('page')
  @ApiPageDoc({
    summary: '查看标签列表',
    model: BaseForumTagDto,
  })
  async getTagList(@Query() query: QueryForumTagDto) {
    return this.forumTagService.getTags(query)
  }

  @Get('detail')
  @ApiDoc({
    summary: '查看标签详情',
    model: ForumTagDetailResponseDto,
  })
  async getTagDetail(@Query() query: IdDto) {
    return this.forumTagService.getTagById(query.id)
  }

  @Get('popular/list')
  @ApiDoc({
    summary: '获取热门标签',
    model: BaseForumTagDto,
    isArray: true,
  })
  async getPopularTags(@Query('limit') limit?: number) {
    return this.forumTagService.getPopularTags(limit)
  }

  @Get('enabled/list')
  @ApiDoc({
    summary: '获取启用标签',
    model: BaseForumTagDto,
    isArray: true,
  })
  async getEnabledTags() {
    return this.forumTagService.getEnabledTags()
  }

  @Get('topic-tag/list')
  @ApiDoc({
    summary: '获取主题的所有标签',
    model: BaseForumTagDto,
    isArray: true,
  })
  async getTopicTags(@Query('topicId') topicId: number) {
    return this.forumTagService.getTopicTags(topicId)
  }

  @Post('create')
  @ApiDoc({
    summary: '添加标签',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.CREATE,
    content: '添加标签',
  })
  async createTag(@Body() dto: CreateForumTagDto) {
    return this.forumTagService.createTag(dto)
  }

  @Post('update')
  @ApiDoc({
    summary: '更新标签',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '更新标签',
  })
  async updateTag(@Body() dto: UpdateForumTagDto) {
    return this.forumTagService.updateTag(dto)
  }

  @Post('delete')
  @ApiDoc({
    summary: '删除标签',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.DELETE,
    content: '删除标签',
  })
  async deleteTag(@Body() dto: IdDto) {
    return this.forumTagService.deleteTag(dto.id)
  }

  @Post('assign-topic')
  @ApiDoc({
    summary: '为主题分配标签',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '为主题分配标签',
  })
  async assignTagToTopic(@Body() dto: AssignForumTagToTopicDto) {
    return this.forumTagService.assignTagToTopic(dto)
  }

  @Post('unassign-topic')
  @ApiDoc({
    summary: '从主题移除标签',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '从主题移除标签',
  })
  async removeTagFromTopic(@Body() dto: AssignForumTagToTopicDto) {
    return this.forumTagService.removeTagFromTopic(dto)
  }
}
