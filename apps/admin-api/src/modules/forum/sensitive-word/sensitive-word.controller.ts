import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators';
import { IdDto, UpdateEnabledStatusDto } from '@libs/platform/dto';
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import { BaseSensitiveWordDto, CreateSensitiveWordDto, QuerySensitiveWordDto, SensitiveWordCountResponseDto, SensitiveWordDetectDto, SensitiveWordDetectResponseDto, SensitiveWordDetectStatusResponseDto, SensitiveWordHighestLevelResponseDto, SensitiveWordReplaceDto, SensitiveWordReplaceResponseDto, SensitiveWordStatisticsDataDto, SensitiveWordStatisticsQueryDto, SensitiveWordStatisticsResponseDto, UpdateSensitiveWordDto } from '@libs/sensitive-word/dto/sensitive-word.dto';
import { SensitiveWordDetectService } from '@libs/sensitive-word/sensitive-word-detect.service';
import { SensitiveWordStatisticsService } from '@libs/sensitive-word/sensitive-word-statistics.service';
import { SensitiveWordService } from '@libs/sensitive-word/sensitive-word.service';
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiAuditDoc } from '../../../common/decorators/api-audit-doc.decorator'

// 敏感词管理控制器，提供敏感词管理、检测、统计相关的 API 接口。
@ApiTags('论坛管理/敏感词管理')
@Controller('admin/forum/sensitive-word')
export class SensitiveWordController {
  constructor(
    private readonly sensitiveWordService: SensitiveWordService,
    private readonly statisticsService: SensitiveWordStatisticsService,
    private readonly detectService: SensitiveWordDetectService,
  ) {}

  // 获取敏感词分页列表。
  @Get('page')
  @ApiPageDoc({
    summary: '获取敏感词分页列表',
    model: BaseSensitiveWordDto,
  })
  async getSensitiveWordPage(@Query() query: QuerySensitiveWordDto) {
    return this.sensitiveWordService.getSensitiveWordPage(query)
  }

  // 创建敏感词。
  @Post('create')
  @ApiAuditDoc({
    summary: '创建敏感词',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.CREATE,
    },
  })
  async createSensitiveWord(@Body() body: CreateSensitiveWordDto) {
    return this.sensitiveWordService.createSensitiveWord(body)
  }

  // 更新敏感词。
  @Post('update')
  @ApiAuditDoc({
    summary: '更新敏感词',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateSensitiveWord(@Body() body: UpdateSensitiveWordDto) {
    return this.sensitiveWordService.updateSensitiveWord(body)
  }

  // 删除敏感词。
  @Post('delete')
  @ApiAuditDoc({
    summary: '删除敏感词',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.DELETE,
    },
  })
  async deleteSensitiveWord(@Body() body: IdDto) {
    return this.sensitiveWordService.deleteSensitiveWord(body)
  }

  // 更新敏感词状态。
  @Post('update-status')
  @ApiAuditDoc({
    summary: '更新敏感词状态',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateSensitiveWordStatus(@Body() body: UpdateEnabledStatusDto) {
    return this.sensitiveWordService.updateSensitiveWordStatus(body)
  }

  // 检测文本中的敏感词。
  @Post('detect')
  @ApiDoc({
    summary: '检测文本中的敏感词',
    model: SensitiveWordDetectResponseDto,
  })
  async detect(@Body() body: SensitiveWordDetectDto) {
    return this.detectService.getMatchedWords(body)
  }

  // 获取统计查询结果。
  @Get('stats')
  @ApiDoc({
    summary: '获取统计查询结果',
    model: SensitiveWordStatisticsResponseDto,
  })
  async getStatistics(@Query() query: SensitiveWordStatisticsQueryDto) {
    return this.sensitiveWordService.getStatistics(query)
  }

  // 获取完整统计数据。
  @Get('stats/full')
  @ApiDoc({
    summary: '获取完整统计数据',
    model: SensitiveWordStatisticsDataDto,
  })
  async getFullStatistics() {
    return this.statisticsService.getStatistics()
  }

  // 替换文本中的敏感词。
  @Post('replace')
  @ApiDoc({
    summary: '替换文本中的敏感词',
    model: SensitiveWordReplaceResponseDto,
  })
  async replaceSensitiveWords(@Body() body: SensitiveWordReplaceDto) {
    return {
      replacedText: this.detectService.replaceSensitiveWords(body),
    }
  }

  // 获取文本中敏感词的最高等级。
  @Post('detect/highest-level')
  @ApiDoc({
    summary: '获取文本中敏感词的最高等级',
    model: SensitiveWordHighestLevelResponseDto,
  })
  async getHighestSensitiveWordLevel(
    @Body() body: SensitiveWordDetectDto,
  ) {
    return {
      highestLevel: this.detectService.getHighestSensitiveWordLevel(body),
    }
  }

  // 检查敏感词检测器状态。
  @Get('detect/status')
  @ApiDoc({
    summary: '检查敏感词检测器状态',
    model: SensitiveWordDetectStatusResponseDto,
  })
  async getDetectStatus() {
    return {
      isReady: this.detectService.isReady(),
      wordCount: this.detectService.getWordCount(),
    }
  }

  // 获取当前加载的敏感词数量。
  @Get('count')
  @ApiDoc({
    summary: '获取当前加载的敏感词数量',
    model: SensitiveWordCountResponseDto,
  })
  async getWordCount() {
    return {
      count: this.detectService.getWordCount(),
    }
  }
}
