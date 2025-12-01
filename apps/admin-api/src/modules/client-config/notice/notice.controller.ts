import { ApiDoc, ApiPageDoc, Public } from '@libs/base/decorators'
import { BatchOperationResponseDto, IdDto, IdsDto } from '@libs/base/dto'
import {
  BaseNoticeDto,
  CreateNoticeDto,
  LibClientNoticeService,
  NoticePageResponseDto,
  QueryNoticeDto,
  UpdateNoticeDto,
  UpdateNoticeStatusDto,
} from '@libs/client-config/notice'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

/**
 * 客户端通知控制器
 * 提供通知相关的API接口
 */
@ApiTags('客户端通知模块')
@Controller('admin/notice')
export class ClientNoticeController {
  constructor(
    private readonly libClientNoticeService: LibClientNoticeService,
  ) {}

  /**
   * 创建通知
   */
  @Post('/create')
  @ApiDoc({
    summary: '创建通知消息',
    model: IdDto,
  })
  async create(@Body() body: CreateNoticeDto) {
    return this.libClientNoticeService.createNotice(body)
  }

  /**
   * 分页查询通知列表
   */
  @Get('/page')
  @ApiPageDoc({
    summary: '分页查询通知列表',
    model: NoticePageResponseDto,
  })
  @Public()
  async getPage(@Query() query: QueryNoticeDto) {
    return this.libClientNoticeService.findNoticePage(query)
  }

  /**
   * 根据ID查询通知详情
   */
  @Get('/detail')
  @ApiDoc({
    summary: '根据ID查询通知详情',
    model: BaseNoticeDto,
  })
  async findOne(@Query() query: IdDto) {
    return this.libClientNoticeService.clientNotice.findUnique({
      where: query,
      include: {
        clientPage: {
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

  /**
   * 更新通知
   */
  @Post('/update')
  @ApiDoc({
    summary: '更新通知消息',
    model: IdDto,
  })
  async update(@Body() body: UpdateNoticeDto) {
    return this.libClientNoticeService.updateNotice(body)
  }

  /**
   * 更新通知状态
   */
  @Post('batch-update-status')
  @ApiDoc({
    summary: '批量更新通知状态',
    model: BatchOperationResponseDto,
  })
  async updateStatus(@Body() body: UpdateNoticeStatusDto) {
    return this.libClientNoticeService.clientNotice.updateMany({
      where: { id: { in: body.ids } },
      data: { isPublished: body.isPublished },
    })
  }

  /**
   * 批量删除通知
   */
  @Post('/batch-delete')
  @ApiDoc({
    summary: '批量删除通知',
    model: BatchOperationResponseDto,
  })
  async batchRemove(@Body() body: IdsDto) {
    return this.libClientNoticeService.clientNotice.deleteMany({
      where: { id: { in: body.ids } },
    })
  }
}
