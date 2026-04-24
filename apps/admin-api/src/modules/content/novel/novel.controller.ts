import { BaseWorkDto, CreateWorkDto, QueryWorkDto, UpdateWorkDto, UpdateWorkHotDto, UpdateWorkNewDto, UpdateWorkRecommendedDto, UpdateWorkStatusDto } from '@libs/content/work/core/dto/work.dto';
import { WorkService } from '@libs/content/work/core/work.service';
import { WorkTypeEnum } from '@libs/platform/constant';
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators';
import { IdDto } from '@libs/platform/dto';
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiAuditDoc } from '../../../common/decorators/api-audit-doc.decorator'

@ApiTags('内容管理/小说管理/基础信息')
@Controller('admin/content/novel')
export class NovelController {
  constructor(private readonly workService: WorkService) {}

  @Post('create')
  @ApiAuditDoc({
    summary: '创建小说',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.CREATE,
    },
  })
  async create(@Body() body: CreateWorkDto) {
    return this.workService.createWork({ ...body, type: WorkTypeEnum.NOVEL })
  }

  @Get('page')
  @ApiPageDoc({
    summary: '分页查询小说列表',
    model: BaseWorkDto,
  })
  async getPage(@Query() query: QueryWorkDto) {
    return this.workService.getWorkPage({ ...query, type: WorkTypeEnum.NOVEL })
  }

  @Get('detail')
  @ApiDoc({
    summary: '获取小说详情',
    model: BaseWorkDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.workService.getWorkDetail(query.id, {
      bypassVisibilityCheck: true,
    })
  }

  @Post('update')
  @ApiAuditDoc({
    summary: '更新小说信息',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async update(@Body() body: UpdateWorkDto) {
    return this.workService.updateWork(body)
  }

  @Post('update-status')
  @ApiAuditDoc({
    summary: '更新小说发布状态',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateStatus(@Body() body: UpdateWorkStatusDto) {
    return this.workService.updateStatus(body)
  }

  @Post('update-recommended')
  @ApiAuditDoc({
    summary: '更新小说推荐状态',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateRecommended(@Body() body: UpdateWorkRecommendedDto) {
    return this.workService.updateWorkFlags(body.id, {
      isRecommended: body.isRecommended,
    })
  }

  @Post('update-hot')
  @ApiAuditDoc({
    summary: '更新小说热门状态',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateHot(@Body() body: UpdateWorkHotDto) {
    return this.workService.updateWorkFlags(body.id, {
      isHot: body.isHot,
    })
  }

  @Post('update-new')
  @ApiAuditDoc({
    summary: '更新小说新作状态',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateNew(@Body() body: UpdateWorkNewDto) {
    return this.workService.updateWorkFlags(body.id, {
      isNew: body.isNew,
    })
  }

  @Post('delete')
  @ApiAuditDoc({
    summary: '软删除小说',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.DELETE,
    },
  })
  async delete(@Body() body: IdDto) {
    return this.workService.deleteWork(body.id)
  }
}
