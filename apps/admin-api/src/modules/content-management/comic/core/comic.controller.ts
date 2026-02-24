import { WorkTypeEnum } from '@libs/base/constant'
import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { BatchOperationResponseDto, IdDto } from '@libs/base/dto'
import {
  BaseWorkDto,
  CreateWorkDto,
  QueryWorkDto,
  UpdateWorkDto,
  UpdateWorkHotDto,
  UpdateWorkNewDto,
  UpdateWorkRecommendedDto,
  UpdateWorkStatusDto,
  WorkService,
} from '@libs/content/work/core'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('内容管理/漫画管理模块')
@Controller('admin/work/comic')
export class ComicController {
  constructor(private readonly workService: WorkService) {}

  @Post('/create')
  @ApiDoc({
    summary: '创建漫画',
    model: IdDto,
  })
  async create(@Body() body: CreateWorkDto) {
    return this.workService.createWork({ ...body, type: WorkTypeEnum.COMIC })
  }

  @Get('/page')
  @ApiPageDoc({
    summary: '分页查询漫画列表',
    model: BaseWorkDto,
  })
  async getPage(@Query() query: QueryWorkDto) {
    return this.workService.getWorkPage({ ...query, type: WorkTypeEnum.COMIC })
  }

  @Get('/detail')
  @ApiDoc({
    summary: '获取漫画详情',
    model: BaseWorkDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.workService.getWorkDetail(query.id)
  }

  @Post('/update')
  @ApiDoc({
    summary: '更新漫画信息',
    model: IdDto,
  })
  async update(@Body() body: UpdateWorkDto) {
    return this.workService.updateWork(body)
  }

  @Post('/update-status')
  @ApiDoc({
    summary: '更新漫画发布状态',
    model: BatchOperationResponseDto,
  })
  async updateStatus(@Body() body: UpdateWorkStatusDto) {
    return this.workService.work.updateMany({
      where: { id: body.id },
      data: {
        isPublished: body.isPublished,
      },
    })
  }

  @Post('/update-recommended')
  @ApiDoc({
    summary: '更新漫画推荐状态',
    model: BatchOperationResponseDto,
  })
  async updateRecommended(@Body() body: UpdateWorkRecommendedDto) {
    return this.workService.work.updateMany({
      where: { id: body.id },
      data: {
        isRecommended: body.isRecommended,
      },
    })
  }

  @Post('/update-hot')
  @ApiDoc({
    summary: '更新漫画热门状态',
    model: BatchOperationResponseDto,
  })
  async updateHot(@Body() body: UpdateWorkHotDto) {
    return this.workService.work.updateMany({
      where: { id: body.id },
      data: {
        isHot: body.isHot,
      },
    })
  }

  @Post('/update-new')
  @ApiDoc({
    summary: '更新漫画新作状态',
    model: BatchOperationResponseDto,
  })
  async updateNew(@Body() body: UpdateWorkNewDto) {
    return this.workService.work.updateMany({
      where: { id: body.id },
      data: {
        isNew: body.isNew,
      },
    })
  }

  @Post('/delete')
  @ApiDoc({
    summary: '软删除漫画',
    model: IdDto,
  })
  async delete(@Body() body: IdDto) {
    return this.workService.deleteWork(body.id)
  }
}
