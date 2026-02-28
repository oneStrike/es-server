import {
  CreateAnnouncementDto,
  AppAnnouncementService,
  AnnouncementDetailDto,
  AnnouncementPageResponseDto,
  QueryAnnouncementDto,
  UpdateAnnouncementDto,
  UpdateAnnouncementStatusDto,
} from '@libs/app-config/announcement'
import { ApiDoc, ApiPageDoc, Public } from '@libs/base/decorators'
import { BatchOperationResponseDto, IdDto } from '@libs/base/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('APP管理/系统公告')
@Controller('admin/announcement')
export class AppAnnouncementController {
  constructor(private readonly libAppAnnouncementService: AppAnnouncementService) {}

  @Post('/create')
  @ApiDoc({
    summary: '创建公告',
    model: IdDto,
  })
  async create(@Body() body: CreateAnnouncementDto) {
    return this.libAppAnnouncementService.createAnnouncement(body)
  }

  @Get('/page')
  @ApiPageDoc({
    summary: '分页查询公告列表',
    model: AnnouncementPageResponseDto,
  })
  @Public()
  async getPage(@Query() query: QueryAnnouncementDto) {
    return this.libAppAnnouncementService.findAnnouncementPage(query)
  }

  @Get('/detail')
  @ApiDoc({
    summary: '公告详情',
    model: AnnouncementDetailDto,
  })
  async findOne(@Query() query: IdDto) {
    return this.libAppAnnouncementService.findAnnouncementDetail(query.id)
  }

  @Post('/update')
  @ApiDoc({
    summary: '更新公告',
    model: IdDto,
  })
  async update(@Body() body: UpdateAnnouncementDto) {
    return this.libAppAnnouncementService.updateAnnouncement(body)
  }

  @Post('update-status')
  @ApiDoc({
    summary: '更新公告状态',
    model: BatchOperationResponseDto,
  })
  async updateStatus(@Body() body: UpdateAnnouncementStatusDto) {
    return this.libAppAnnouncementService.appAnnouncement.update({
      where: { id: body.id },
      data: { isPublished: body.isPublished },
    })
  }

  @Post('/delete')
  @ApiDoc({
    summary: '删除公告',
    model: BatchOperationResponseDto,
  })
  async batchRemove(@Body() body: IdDto) {
    return this.libAppAnnouncementService.appAnnouncement.delete({
      where: { id: body.id },
    })
  }
}
