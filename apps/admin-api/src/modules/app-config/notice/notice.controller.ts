import { ApiDoc, ApiPageDoc, Public } from '@libs/base/decorators'
import { BatchOperationResponseDto, IdDto } from '@libs/base/dto'
import {
  BaseNoticeDto,
  CreateNoticeDto,
  LibAppNoticeService,
  NoticePageResponseDto,
  QueryNoticeDto,
  UpdateNoticeDto,
  UpdateNoticeStatusDto,
} from '@libs/app-config/notice'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('客户端管理/通知公告')
@Controller('admin/notice')
export class AppNoticeController {
  constructor(
    private readonly libAppNoticeService: LibAppNoticeService,
  ) {}

  @Post('/create')
  @ApiDoc({
    summary: '创建通知消息',
    model: IdDto,
  })
  async create(@Body() body: CreateNoticeDto) {
    return this.libAppNoticeService.createNotice(body)
  }

  @Get('/page')
  @ApiPageDoc({
    summary: '分页查询通知列表',
    model: NoticePageResponseDto,
  })
  @Public()
  async getPage(@Query() query: QueryNoticeDto) {
    return this.libAppNoticeService.findNoticePage(query)
  }

  @Get('/detail')
  @ApiDoc({
    summary: '根据ID查询通知详情',
    model: BaseNoticeDto,
  })
  async findOne(@Query() query: IdDto) {
    return this.libAppNoticeService.appNotice.findUnique({
      where: query,
      include: {
        appPage: {
          select: {
            id: true,
            code: true,
            name: true,
            path: true,
          },
        },
      },
    })
  }

  @Post('/update')
  @ApiDoc({
    summary: '更新通知消息',
    model: IdDto,
  })
  async update(@Body() body: UpdateNoticeDto) {
    return this.libAppNoticeService.updateNotice(body)
  }

  @Post('update-status')
  @ApiDoc({
    summary: '更新通知状态',
    model: BatchOperationResponseDto,
  })
  async updateStatus(@Body() body: UpdateNoticeStatusDto) {
    return this.libAppNoticeService.appNotice.update({
      where: { id: body.id },
      data: { isPublished: body.isPublished },
    })
  }

  @Post('/delete')
  @ApiDoc({
    summary: '删除通知',
    model: BatchOperationResponseDto,
  })
  async batchRemove(@Body() body: IdDto) {
    return this.libAppNoticeService.appNotice.delete({
      where: { id: body.id },
    })
  }
}
