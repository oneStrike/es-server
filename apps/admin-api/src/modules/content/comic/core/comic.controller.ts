import { WorkService } from '@libs/content/work'
import { WorkTypeEnum } from '@libs/platform/constant'
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  BaseWorkDto,
  CreateWorkDto,
  QueryWorkDto,
  UpdateWorkDto,
  UpdateWorkHotDto,
  UpdateWorkNewDto,
  UpdateWorkRecommendedDto,
  UpdateWorkStatusDto,
} from './dto/comic.dto'

@ApiTags('内容管理/漫画管理/基础信息')
@Controller('admin/content/comic')
export class ComicController {
  constructor(private readonly workService: WorkService) {}

  @Post('create')
  @ApiDoc({
    summary: '创建漫画',
    model: Boolean,
  })
  async create(@Body() body: CreateWorkDto) {
    return this.workService.createWork({ ...body, type: WorkTypeEnum.COMIC })
  }

  @Get('page')
  @ApiPageDoc({
    summary: '分页查询漫画列表',
    model: BaseWorkDto,
  })
  async getPage(@Query() query: QueryWorkDto) {
    return this.workService.getWorkPage({ ...query, type: WorkTypeEnum.COMIC })
  }

  @Get('detail')
  @ApiDoc({
    summary: '获取漫画详情',
    model: BaseWorkDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.workService.getWorkDetail(query.id, {
      bypassVisibilityCheck: true,
    })
  }

  @Post('update')
  @ApiDoc({
    summary: '更新漫画信息',
    model: Boolean,
  })
  async update(@Body() body: UpdateWorkDto) {
    return this.workService.updateWork(body)
  }

  @Post('update-status')
  @ApiDoc({
    summary: '更新漫画发布状态',
    model: Boolean,
  })
  async updateStatus(@Body() body: UpdateWorkStatusDto) {
    return this.workService.updateStatus(body)
  }

  @Post('update-recommended')
  @ApiDoc({
    summary: '更新漫画推荐状态',
    model: Boolean,
  })
  async updateRecommended(@Body() body: UpdateWorkRecommendedDto) {
    return this.workService.updateWorkFlags(body.id, {
      isRecommended: body.isRecommended,
    })
  }

  @Post('update-hot')
  @ApiDoc({
    summary: '更新漫画热门状态',
    model: Boolean,
  })
  async updateHot(@Body() body: UpdateWorkHotDto) {
    return this.workService.updateWorkFlags(body.id, {
      isHot: body.isHot,
    })
  }

  @Post('update-new')
  @ApiDoc({
    summary: '更新漫画新作状态',
    model: Boolean,
  })
  async updateNew(@Body() body: UpdateWorkNewDto) {
    return this.workService.updateWorkFlags(body.id, {
      isNew: body.isNew,
    })
  }

  @Post('delete')
  @ApiDoc({
    summary: '软删除漫画',
    model: Boolean,
  })
  async delete(@Body() body: IdDto) {
    return this.workService.deleteWork(body.id)
  }
}
