import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { IdDto, UpdateEnabledStatusDto } from '@libs/base/dto'
import {
  BaseSensitiveWordDto,
  CreateSensitiveWordDto,
  QuerySensitiveWordDto,
  SensitiveWordService,
  UpdateSensitiveWordDto,
} from '@libs/forum'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@Controller('/admin/forum/sensitive-word')
@ApiTags('论坛模块/敏感词管理')
export class SensitiveWordController {
  constructor(private readonly sensitiveWordService: SensitiveWordService) {}

  @Get('page')
  @ApiPageDoc({
    summary: '获取敏感词分页',
    model: BaseSensitiveWordDto,
  })
  async getSensitiveWordPage(@Query() query: QuerySensitiveWordDto) {
    return this.sensitiveWordService.getSensitiveWordPage(query)
  }

  @Post('create')
  @ApiDoc({
    summary: '创建敏感词',
    model: BaseSensitiveWordDto,
  })
  async createSensitiveWord(@Body() dto: CreateSensitiveWordDto) {
    return this.sensitiveWordService.createSensitiveWord(dto)
  }

  @Post('update')
  @ApiDoc({
    summary: '更新敏感词',
    model: BaseSensitiveWordDto,
  })
  async updateSensitiveWord(@Body() dto: UpdateSensitiveWordDto) {
    return this.sensitiveWordService.updateSensitiveWord(dto)
  }

  @Post('delete')
  @ApiDoc({
    summary: '删除敏感词',
    model: BaseSensitiveWordDto,
  })
  async deleteSensitiveWord(@Body() dto: IdDto) {
    return this.sensitiveWordService.deleteSensitiveWord(dto)
  }

  @Post('update-status')
  @ApiDoc({
    summary: '更新敏感词状态',
    model: BaseSensitiveWordDto,
  })
  async enableSensitiveWord(@Body() dto: UpdateEnabledStatusDto) {
    return this.sensitiveWordService.updateSensitiveWordStatus(dto)
  }
}
