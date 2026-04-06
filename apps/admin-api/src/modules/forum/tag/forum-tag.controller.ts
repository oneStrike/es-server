import { AssignForumTagToTopicDto, BaseForumTagDto, CreateForumTagDto, ForumTagDetailResponseDto, QueryForumTagDto, UpdateForumTagDto } from '@libs/forum/tag/dto/forum-tag.dto';
import { ForumTagService } from '@libs/forum/tag/forum-tag.service';
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators/api-doc.decorator';
import { IdDto } from '@libs/platform/dto/base.dto';
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiAuditDoc } from '../../../common/decorators/api-audit-doc.decorator'
import { AuditActionTypeEnum } from '../../system/audit/audit.constant'

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
  @ApiAuditDoc({
    summary: '添加标签',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.CREATE,
    },
  })
  async createTag(@Body() dto: CreateForumTagDto) {
    return this.forumTagService.createTag(dto)
  }

  @Post('update')
  @ApiAuditDoc({
    summary: '更新标签',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateTag(@Body() dto: UpdateForumTagDto) {
    return this.forumTagService.updateTag(dto)
  }

  @Post('delete')
  @ApiAuditDoc({
    summary: '删除标签',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.DELETE,
    },
  })
  async deleteTag(@Body() dto: IdDto) {
    return this.forumTagService.deleteTag(dto.id)
  }

  @Post('assign-topic')
  @ApiAuditDoc({
    summary: '为主题分配标签',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async assignTagToTopic(@Body() dto: AssignForumTagToTopicDto) {
    return this.forumTagService.assignTagToTopic(dto)
  }

  @Post('unassign-topic')
  @ApiAuditDoc({
    summary: '从主题移除标签',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async removeTagFromTopic(@Body() dto: AssignForumTagToTopicDto) {
    return this.forumTagService.removeTagFromTopic(dto)
  }
}
