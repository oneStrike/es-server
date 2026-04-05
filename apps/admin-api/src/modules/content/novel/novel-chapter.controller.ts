import {
  CreateWorkChapterDto,
  QueryWorkChapterDto,
  UpdateWorkChapterDto,
  WorkChapterService,
} from '@libs/content/work'
import { ContentTypeEnum } from '@libs/platform/constant'
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators'
import { DragReorderDto, IdDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Audit } from '../../../common/decorators/audit.decorator'
import { AuditActionTypeEnum } from '../../system/audit/audit.constant'

@ApiTags('内容管理/小说管理/章节管理')
@Controller('admin/content/novel/chapter')
export class NovelChapterController {
  constructor(private readonly workChapterService: WorkChapterService) {}

  @Post('create')
  @ApiDoc({
    summary: '创建小说章节',
    model: Boolean,
  })
  @Audit({ actionType: AuditActionTypeEnum.CREATE, content: '创建小说章节' })
  async create(@Body() body: CreateWorkChapterDto) {
    return this.workChapterService.createChapter({
      ...body,
      workType: ContentTypeEnum.NOVEL,
    })
  }

  @Get('page')
  @ApiPageDoc({
    summary: '分页查询小说章节列表',
    model: IdDto,
  })
  async getPage(@Query() query: QueryWorkChapterDto) {
    return this.workChapterService.getChapterPage(query)
  }

  @Get('detail')
  @ApiDoc({
    summary: '获取小说章节详情',
    model: IdDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.workChapterService.getChapterDetail(query.id)
  }

  @Post('update')
  @ApiDoc({
    summary: '更新小说章节',
    model: Boolean,
  })
  @Audit({ actionType: AuditActionTypeEnum.UPDATE, content: '更新小说章节' })
  async update(@Body() body: UpdateWorkChapterDto) {
    return this.workChapterService.updateChapter(body)
  }

  @Post('delete')
  @ApiDoc({
    summary: '删除小说章节',
    model: Boolean,
  })
  @Audit({ actionType: AuditActionTypeEnum.DELETE, content: '删除小说章节' })
  async delete(@Body() query: IdDto) {
    return this.workChapterService.deleteChapter(query.id)
  }

  @Post('swap-sort-order')
  @ApiDoc({
    summary: '交换章节序号',
    model: Boolean,
  })
  @Audit({ actionType: AuditActionTypeEnum.UPDATE, content: '交换小说章节序号' })
  async swapSortOrder(@Body() body: DragReorderDto) {
    return this.workChapterService.swapChapterNumbers(body)
  }
}
