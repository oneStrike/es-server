import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { BaseDto } from '@libs/base/dto'
import { Body, Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import {
  BaseForumAuditLogDto,
  CreateForumAuditLogDto,
  QueryForumAuditLogDto,
} from './dto/forum-audit-log.dto'
import { ForumAuditLogService } from './forum-audit-log.service'

@ApiTags('论坛管理/审计日志模块')
@Controller('admin/forum/audit-log')
export class ForumAuditLogController {
  constructor(
    private readonly forumAuditLogService: ForumAuditLogService,
  ) {}

  @Post('/create')
  @ApiDoc({
    summary: '创建审计日志',
    model: BaseForumAuditLogDto,
  })
  async create(@Body() body: CreateForumAuditLogDto) {
    return this.forumAuditLogService.createLog(body)
  }

  @Get('/page')
  @ApiPageDoc({
    summary: '分页查询审计日志',
    model: BaseForumAuditLogDto,
  })
  async getPage(@Query() query: QueryForumAuditLogDto) {
    return this.forumAuditLogService.getLogs(query)
  }

  @Get('/entity-logs')
  @ApiPageDoc({
    summary: '查询实体的审计日志',
    model: BaseForumAuditLogDto,
  })
  async getEntityLogs(
    @Query('objectType') objectType: number,
    @Query('objectId') objectId: number,
    @Query() query: QueryForumAuditLogDto,
  ) {
    return this.forumAuditLogService.getEntityLogs(objectType, objectId, query)
  }

  @Get('/statistics')
  @ApiDoc({
    summary: '获取审计日志统计信息',
    model: {
      total: 100,
      pending: 10,
      approved: 80,
      rejected: 10,
    },
  })
  async getStatistics(@Query() query: QueryForumAuditLogDto) {
    return this.forumAuditLogService.getLogStatistics(query)
  }
}
