import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { IdDto, UpdateEnabledStatusDto } from '@libs/base/dto'
import {
  CreateForumSensitiveWordDto,
  ForumMatchedWordDto,
  ForumSensitiveWordDetectDto,
  ForumSensitiveWordDetectService,
  ForumSensitiveWordService,
  ForumSensitiveWordStatisticsDataDto,
  ForumSensitiveWordStatisticsQueryDto,
  ForumSensitiveWordStatisticsResponseDto,
  ForumSensitiveWordStatisticsService,
  QueryForumSensitiveWordDto,
  UpdateForumSensitiveWordDto,
} from '@libs/forum/sensitive-word'

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
    private readonly sensitiveWordService: ForumSensitiveWordService,
    private readonly statisticsService: ForumSensitiveWordStatisticsService,
    private readonly detectService: ForumSensitiveWordDetectService,
  ) {}

  /**
   * 获取敏感词分页列表
   * @param query - 查询参数
   * @returns 敏感词分页数据
   */
  @Get('/page')
  @ApiPageDoc({
    summary: '获取敏感词分页列表',
    model: CreateForumSensitiveWordDto,
  })
  async getSensitiveWordPage(@Query() query: QueryForumSensitiveWordDto) {
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
    model: CreateForumSensitiveWordDto,
  })
  async createSensitiveWord(@Body() body: CreateForumSensitiveWordDto) {
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
    model: UpdateForumSensitiveWordDto,
  })
  async updateSensitiveWord(@Body() body: UpdateForumSensitiveWordDto) {
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
    model: IdDto,
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
    model: UpdateEnabledStatusDto,
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
    model: ForumMatchedWordDto,
    isArray: true,
  })
  async detect(@Body() body: ForumSensitiveWordDetectDto) {
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
    model: ForumSensitiveWordStatisticsResponseDto,
  })
  async getStatistics(@Query() query: ForumSensitiveWordStatisticsQueryDto) {
    return this.sensitiveWordService.getStatistics(query)
  }

  /**
   * 获取完整统计数据
   * @returns 完整统计数据
   */
  @Get('/statistics/full')
  @ApiDoc({
    summary: '获取完整统计数据',
    model: ForumSensitiveWordStatisticsDataDto,
  })
  async getFullStatistics() {
    return this.statisticsService.getStatistics()
  }
}
