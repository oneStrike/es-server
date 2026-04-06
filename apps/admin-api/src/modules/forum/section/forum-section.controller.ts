import { BaseForumSectionDto, CreateForumSectionDto, ForumSectionFollowCountRepairResultDto, QueryForumSectionDto, SwapForumSectionSortDto, UpdateForumSectionDto, UpdateForumSectionEnabledDto } from '@libs/forum/section/dto/forum-section.dto';
import { ForumSectionService } from '@libs/forum/section/forum-section.service';
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators/api-doc.decorator';
import { IdDto } from '@libs/platform/dto/base.dto';
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Audit } from '../../../common/decorators/audit.decorator'
import { AuditActionTypeEnum } from '../../system/audit/audit.constant'

@Controller('admin/forum/sections')
@ApiTags('论坛管理/板块管理')
export class ForumSectionController {
  constructor(private readonly forumSectionService: ForumSectionService) {}

  @Get('page')
  @ApiPageDoc({
    summary: '查看板块分页',
    model: BaseForumSectionDto,
  })
  async getSectionPage(@Query() query: QueryForumSectionDto) {
    return this.forumSectionService.getSectionPage(query)
  }

  @Get('detail')
  @ApiDoc({
    summary: '查看板块详情',
    model: BaseForumSectionDto,
  })
  async getSectionDetail(@Query() query: IdDto) {
    return this.forumSectionService.getSectionDetail(query.id)
  }

  @Get('tree')
  @ApiDoc({
    summary: '查看板块树',
  })
  async getSectionTree() {
    return this.forumSectionService.getSectionTree()
  }

  @Post('create')
  @ApiDoc({
    summary: '添加板块',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.CREATE,
    content: '添加板块',
  })
  async createSection(@Body() dto: CreateForumSectionDto) {
    return this.forumSectionService.createSection(dto)
  }

  @Post('update')
  @ApiDoc({
    summary: '更新板块',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '更新板块',
  })
  async updateSection(@Body() dto: UpdateForumSectionDto) {
    return this.forumSectionService.updateSection(dto)
  }

  @Post('delete')
  @ApiDoc({
    summary: '删除板块',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.DELETE,
    content: '删除板块',
  })
  async deleteSection(@Body() dto: IdDto) {
    return this.forumSectionService.deleteSection(dto.id)
  }

  @Post('update-enabled')
  @ApiDoc({
    summary: '更新板块启用状态',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '更新板块启用状态',
  })
  async updateEnabledStatus(@Body() dto: UpdateForumSectionEnabledDto) {
    return this.forumSectionService.updateEnabledStatus(dto)
  }

  @Post('rebuild-follow-count')
  @ApiDoc({
    summary: '重建板块关注计数',
    model: ForumSectionFollowCountRepairResultDto,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '重建板块关注计数',
  })
  async rebuildFollowCount(@Body() dto: IdDto) {
    return this.forumSectionService.rebuildSectionFollowersCount(dto.id)
  }

  @Post('rebuild-follow-count-all')
  @ApiDoc({
    summary: '全量重建板块关注计数',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '全量重建板块关注计数',
  })
  async rebuildFollowCountAll() {
    return this.forumSectionService.rebuildAllSectionFollowersCount()
  }

  @Post('swap-sort-order')
  @ApiDoc({
    summary: '交换板块排序顺序',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '交换板块排序顺序',
  })
  async swapSortOrder(@Body() dto: SwapForumSectionSortDto) {
    return this.forumSectionService.updateSectionSort(dto)
  }
}
