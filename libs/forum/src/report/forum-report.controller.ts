import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { BaseDto, IdDto } from '@libs/base/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import {
  BaseForumReportDto,
  CreateForumReportDto,
  HandleReportDto,
  QueryForumReportDto,
} from './dto/forum-report.dto'
import { ForumReportService } from './forum-report.service'

/**
 * 论坛举报管理控制器
 * 提供论坛举报相关的API接口
 */
@ApiTags('论坛管理/举报模块')
@Controller('admin/forum/report')
export class ForumReportController {
  constructor(
    private readonly forumReportService: ForumReportService,
  ) {}

  /**
   * 创建举报
   * @param body - 创建举报的数据传输对象
   * @returns 创建的举报记录
   */
  @Post('/create')
  @ApiDoc({
    summary: '创建举报',
    model: BaseForumReportDto,
  })
  async create(@Body() body: CreateForumReportDto) {
    return this.forumReportService.createForumReport(body)
  }

  /**
   * 分页查询举报记录
   * @param query - 查询参数
   * @returns 分页的举报记录列表
   */
  @Get('/page')
  @ApiPageDoc({
    summary: '分页查询举报记录',
    model: BaseForumReportDto,
  })
  async getPage(@Query() query: QueryForumReportDto) {
    return this.forumReportService.getForumReports(query)
  }

  /**
   * 获取举报详情
   * @param query - 包含举报记录ID的对象
   * @returns 举报记录详情
   */
  @Get('/detail')
  @ApiDoc({
    summary: '获取举报详情',
    model: BaseForumReportDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.forumReportService.getForumReportById(query.id)
  }

  /**
   * 处理举报
   * @param body - 处理举报的数据传输对象
   * @returns 更新后的举报记录
   */
  @Post('/handle')
  @ApiDoc({
    summary: '处理举报',
    model: BaseForumReportDto,
  })
  async handle(@Body() body: HandleReportDto) {
    return this.forumReportService.handleReport(body)
  }

  /**
   * 获取举报统计
   * @returns 举报统计数据
   */
  @Get('/statistics')
  @ApiDoc({
    summary: '获取举报统计',
    model: {
      totalReports: 100,
      pendingReports: 10,
      reportsByStatus: {},
      reportsByType: {},
      reportsByReason: {},
    },
  })
  async getStatistics() {
    return this.forumReportService.getReportStatistics()
  }

  /**
   * 获取用户举报记录
   * @param profileId - 用户资料ID
   * @param pageIndex - 页码，默认为0
   * @param pageSize - 每页数量，默认为15
   * @returns 分页的用户举报记录列表
   */
  @Get('/user-reports')
  @ApiPageDoc({
    summary: '获取用户举报记录',
    model: BaseForumReportDto,
  })
  async getUserReports(
    @Query('profileId') profileId: number,
    @Query('pageIndex') pageIndex = 0,
    @Query('pageSize') pageSize = 15,
  ) {
    return this.forumReportService.getUserReports(profileId, pageIndex, pageSize)
  }

  /**
   * 删除举报记录
   * @param body - 包含举报记录ID的对象
   * @returns 操作结果
   */
  @Post('/delete')
  @ApiDoc({
    summary: '删除举报记录',
    model: BaseDto,
  })
  async delete(@Body() body: IdDto) {
    return this.forumReportService.deleteForumReport(body.id)
  }
}
