import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  BaseSensitiveWordDto,
  CreateSensitiveWordDto,
  QuerySensitiveWordDto,
  UpdateSensitiveWordDto,
} from './dto/sensitive-word.dto'
import { SensitiveWordService } from './sensitive-word.service'

@Controller('/admin/forum/sensitive-word')
@ApiTags('论坛模块/敏感词管理')
export class SensitiveWordController {
  constructor(private readonly sensitiveWordService: SensitiveWordService) {}

  @Get('page')
  @ApiPageDoc({
    summary: '获取敏感词列表',
    model: BaseSensitiveWordDto,
  })
  async getSensitiveWordPage(@Query() query: QuerySensitiveWordDto) {
    return this.sensitiveWordService.getSensitiveWordPage(query)
  }

  @Post('create')
  @ApiDoc({
    summary: '创建敏感词',
    model: IdDto,
  })
  async createSensitiveWord(@Body() dto: CreateSensitiveWordDto) {
    return this.sensitiveWordService.sensitiveWord.create({
      data: dto,
      select: { id: true },
    })
  }

  @Post('update')
  @ApiDoc({
    summary: '更新敏感词',
    model: IdDto,
  })
  async updateSensitiveWord(@Body() dto: UpdateSensitiveWordDto) {
    return this.sensitiveWordService.sensitiveWord.update({
      where: {
        id: dto.id,
      },
      data: dto,
      select: { id: true },
    })
  }

  @Post('delete')
  @ApiDoc({
    summary: '删除敏感词',
    model: IdDto,
  })
  async deleteSensitiveWord(@Body() dto: IdDto) {
    return this.sensitiveWordService.sensitiveWord.delete({
      where: {
        id: dto.id,
      },
      select: { id: true },
    })
  }

  @Post('update-status')
  @ApiDoc({
    summary: '更新敏感词状态',
    model: IdDto,
  })
  async enableSensitiveWord(@Body() dto: IdDto) {
    return this.sensitiveWordService.sensitiveWord.update({
      where: {
        id: dto.id,
      },
      data: {
        isEnabled: true,
      },
    })
  }
}
