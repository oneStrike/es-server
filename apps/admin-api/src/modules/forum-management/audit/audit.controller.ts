import { AuditService } from './audit.service'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiDoc, ApiPageDoc } from '@libs/base/decorator'
import {
  BatchApproveDto,
  BatchRejectDto,
  CreateSensitiveWordDto,
  DeleteSensitiveWordDto,
  QueryAuditHistoryDto,
  QueryAuditQueueDto,
  QuerySensitiveWordDto,
  UpdateSensitiveWordDto,
} from './dto/audit.dto'

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * 创建敏感词
   */
  @Post('sensitive-word/create')
  @ApiDoc({
    summary: '创建敏感词',
    description: '创建新的敏感词',
    response: 'SensitiveWordDto',
  })
  async createSensitiveWord(@Body() createDto: CreateSensitiveWordDto) {
    return this.auditService.createSensitiveWord(createDto)
  }

  /**
   * 更新敏感词
   */
  @Post('sensitive-word/update')
  @ApiDoc({
    summary: '更新敏感词',
    description: '更新敏感词信息',
    response: 'SensitiveWordDto',
  })
  async updateSensitiveWord(@Body() updateDto: UpdateSensitiveWordDto) {
    return this.auditService.updateSensitiveWord(updateDto)
  }

  /**
   * 删除敏感词
   */
  @Post('sensitive-word/delete')
  @ApiDoc({
    summary: '删除敏感词',
    description: '删除敏感词',
    response: 'Boolean',
  })
  async deleteSensitiveWord(@Body() deleteDto: DeleteSensitiveWordDto) {
    await this.auditService.deleteSensitiveWord(deleteDto)
    return true
  }

  /**
   * 查看敏感词列表
   */
  @Get('sensitive-word/list')
  @ApiDoc({
    summary: '查看敏感词列表',
    description: '分页查询敏感词列表',
    response: 'SensitiveWordPageDto',
  })
  @ApiPageDoc()
  async getSensitiveWordList(@Query() queryDto: QuerySensitiveWordDto) {
    return this.auditService.getSensitiveWordPage(queryDto)
  }

  /**
   * 查看审核队列
   */
  @Get('queue/list')
  @ApiDoc({
    summary: '查看审核队列',
    description: '分页查询待审核内容',
    response: 'AuditQueuePageDto',
  })
  @ApiPageDoc()
  async getAuditQueueList(@Query() queryDto: QueryAuditQueueDto) {
    return this.auditService.getAuditQueuePage(queryDto)
  }

  /**
   * 批量通过
   */
  @Post('queue/batch-approve')
  @ApiDoc({
    summary: '批量通过',
    description: '批量通过审核',
    response: 'Boolean',
  })
  async batchApprove(@Body() approveDto: BatchApproveDto) {
    await this.auditService.batchApprove(approveDto)
    return true
  }

  /**
   * 批量拒绝
   */
  @Post('queue/batch-reject')
  @ApiDoc({
    summary: '批量拒绝',
    description: '批量拒绝审核',
    response: 'Boolean',
  })
  async batchReject(@Body() rejectDto: BatchRejectDto) {
    await this.auditService.batchReject(rejectDto)
    return true
  }

  /**
   * 查看审核历史
   */
  @Get('history/list')
  @ApiDoc({
    summary: '查看审核历史',
    description: '分页查询审核历史',
    response: 'AuditHistoryPageDto',
  })
  @ApiPageDoc()
  async getAuditHistoryList(@Query() queryDto: QueryAuditHistoryDto) {
    return this.auditService.getAuditHistoryPage(queryDto)
  }
}
