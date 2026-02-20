import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { IdDto, UpdateEnabledStatusDto } from '@libs/base/dto'
import {
  BaseSensitiveWordDto,
  CreateSensitiveWordDto,
  MatchedWordDto,
  QuerySensitiveWordDto,
  SensitiveWordCountResponseDto,
  SensitiveWordDetectDto,
  SensitiveWordDetectService,
  SensitiveWordDetectStatusResponseDto,
  SensitiveWordHighestLevelResponseDto,
  SensitiveWordReplaceDto,
  SensitiveWordReplaceResponseDto,
  SensitiveWordService,
  SensitiveWordStatisticsDataDto,
  SensitiveWordStatisticsQueryDto,
  SensitiveWordStatisticsResponseDto,
  SensitiveWordStatisticsService,
  UpdateSensitiveWordDto,
} from '@libs/sensitive-word'

import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

/**
 * 敏感词管理控制器
 * 提供敏感词管理、检测、统计相关的API接口
 */
@ApiTags('论坛模块/敏感词管理模块')
@Controller('admin/forum/sensitive-word')
export class SensitiveWordController {
  constructor(
    private readonly sensitiveWordService: SensitiveWordService,
    private readonly statisticsService: SensitiveWordStatisticsService,
    private readonly detectService: SensitiveWordDetectService,
  ) {}

  /**
   * 获取敏感词分页列表
   * @param query - 查询参数
   * @returns 敏感词分页数据
   */
  @Get('/page')
  @ApiPageDoc({
    summary: '获取敏感词分页列表',
    model: BaseSensitiveWordDto,
  })
  async getSensitiveWordPage(@Query() query: QuerySensitiveWordDto) {
    return this.sensitiveWordService.getSensitiveWordPage(query)
  }

  /**
   * 创建敏感词
   * @param body - 创建敏感词请求对象
   * @returns 创建的敏感词信息
   */
  @Post('/create')
  @ApiDoc({
    summary: '创建敏感词',
    model: BaseSensitiveWordDto,
  })
  async createSensitiveWord(@Body() body: CreateSensitiveWordDto) {
    return this.sensitiveWordService.createSensitiveWord(body)
  }

  /**
   * 更新敏感词
   * @param body - 更新敏感词请求对象
   * @returns 更新后的敏感词信息
   */
  @Post('/update')
  @ApiDoc({
    summary: '更新敏感词',
    model: BaseSensitiveWordDto,
  })
  async updateSensitiveWord(@Body() body: UpdateSensitiveWordDto) {
    return this.sensitiveWordService.updateSensitiveWord(body)
  }

  /**
   * 删除敏感词
   * @param body - 删除敏感词请求对象
   * @returns 删除结果
   */
  @Post('/delete')
  @ApiDoc({
    summary: '删除敏感词',
    model: BaseSensitiveWordDto,
  })
  async deleteSensitiveWord(@Body() body: IdDto) {
    return this.sensitiveWordService.deleteSensitiveWord(body)
  }

  /**
   * 更新敏感词状态
   * @param body - 更新状态请求对象
   * @returns 更新结果
   */
  @Post('/update-status')
  @ApiDoc({
    summary: '更新敏感词状态',
    model: BaseSensitiveWordDto,
  })
  async updateSensitiveWordStatus(@Body() body: UpdateEnabledStatusDto) {
    return this.sensitiveWordService.updateSensitiveWordStatus(body)
  }

  /**
   * 检测文本中的敏感词
   * @param body - 检测请求对象
   * @returns 检测结果
   */
  @Post('/detect')
  @ApiDoc({
    summary: '检测文本中的敏感词',
    model: MatchedWordDto,
    isArray: true,
  })
  async detect(@Body() body: SensitiveWordDetectDto) {
    return this.detectService.getMatchedWords(body)
  }

  /**
   * 获取统计查询结果
   * @param query - 统计查询请求对象
   * @returns 统计查询结果
   */
  @Get('/statistics')
  @ApiDoc({
    summary: '获取统计查询结果',
    model: SensitiveWordStatisticsResponseDto,
  })
  async getStatistics(@Query() query: SensitiveWordStatisticsQueryDto) {
    return this.sensitiveWordService.getStatistics(query)
  }

  /**
   * 获取完整统计数据
   * @returns 完整统计数据
   */
  @Get('/statistics/full')
  @ApiDoc({
    summary: '获取完整统计数据',
    model: SensitiveWordStatisticsDataDto,
  })
  async getFullStatistics() {
    return this.statisticsService.getStatistics()
  }

  /**
   * 替换文本中的敏感词
   * @param body - 替换请求对象
   * @returns 替换后的文本
   */
  @Post('/replace')
  @ApiDoc({
    summary: '替换文本中的敏感词',
    model: SensitiveWordReplaceResponseDto,
  })
  async replaceSensitiveWords(@Body() body: SensitiveWordReplaceDto) {
    return this.detectService.replaceSensitiveWords(body)
  }

  /**
   * 获取文本中敏感词的最高等级
   * @param body - 检测请求对象
   * @returns 敏感词最高等级
   */
  @Post('/detect/highest-level')
  @ApiDoc({
    summary: '获取文本中敏感词的最高等级',
    model: SensitiveWordHighestLevelResponseDto,
  })
  async getHighestSensitiveWordLevel(
    @Body() body: SensitiveWordDetectDto,
  ) {
    return this.detectService.getHighestSensitiveWordLevel(body)
  }

  /**
   * 检查敏感词检测器状态
   * @returns 检测器状态
   */
  @Get('/detect/status')
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

  /**
   * 获取当前加载的敏感词数量
   * @returns 敏感词数量
   */
  @Get('/count')
  @ApiDoc({
    summary: '获取当前加载的敏感词数量',
    model: SensitiveWordCountResponseDto,
  })
  async getWordCount() {
    return this.detectService.getWordCount()
  }
}
