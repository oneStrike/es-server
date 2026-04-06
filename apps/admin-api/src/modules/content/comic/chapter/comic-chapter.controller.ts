import { CreateWorkChapterDto, QueryWorkChapterDto, UpdateWorkChapterDto } from '@libs/content/work/chapter/dto/work-chapter.dto';
import { WorkChapterService } from '@libs/content/work/chapter/work-chapter.service';
import { ContentTypeEnum } from '@libs/platform/constant/content.constant';
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators/api-doc.decorator';
import { IdDto } from '@libs/platform/dto/base.dto';
import { DragReorderDto } from '@libs/platform/dto/drag-reorder.dto';
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Audit } from '../../../../common/decorators/audit.decorator'
import { AuditActionTypeEnum } from '../../../system/audit/audit.constant'

@ApiTags('内容管理/漫画管理/章节管理')
@Controller('admin/content/comic/chapter')
export class ComicChapterController {
  constructor(private readonly workChapterService: WorkChapterService) {}

  @Post('create')
  @ApiDoc({
    summary: '创建漫画章节',
    model: Boolean,
  })
  @Audit({ actionType: AuditActionTypeEnum.CREATE, content: '创建漫画章节' })
  async create(@Body() body: CreateWorkChapterDto) {
    return this.workChapterService.createChapter({
      ...body,
      workType: ContentTypeEnum.COMIC,
    })
  }

  @Get('page')
  @ApiPageDoc({
    summary: '分页查询漫画章节列表',
    model: IdDto,
  })
  async getPage(@Query() query: QueryWorkChapterDto) {
    return this.workChapterService.getChapterPage(query)
  }

  @Get('detail')
  @ApiDoc({
    summary: '获取漫画章节详情',
    model: IdDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.workChapterService.getChapterDetail(query.id, {
      bypassVisibilityCheck: true,
    })
  }

  @Post('update')
  @ApiDoc({
    summary: '更新漫画章节',
    model: Boolean,
  })
  @Audit({ actionType: AuditActionTypeEnum.UPDATE, content: '更新漫画章节' })
  async update(@Body() body: UpdateWorkChapterDto) {
    return this.workChapterService.updateChapter(body)
  }

  @Post('delete')
  @ApiDoc({
    summary: '删除漫画章节',
    model: Boolean,
  })
  @Audit({ actionType: AuditActionTypeEnum.DELETE, content: '删除漫画章节' })
  async delete(@Body() query: IdDto) {
    return this.workChapterService.deleteChapter(query.id)
  }

  @Post('swap-sort-order')
  @ApiDoc({
    summary: '交换章节序号',
    model: Boolean,
  })
  @Audit({ actionType: AuditActionTypeEnum.UPDATE, content: '交换漫画章节序号' })
  async swapSortOrder(@Body() body: DragReorderDto) {
    return this.workChapterService.swapChapterNumbers(body)
  }
}
