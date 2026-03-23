import {
  AppPageService,
  BaseAppPageDto,
} from '@libs/app-content/page'
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators'
import { IdsDto } from '@libs/platform/dto'
import {
  Body,
  Controller,
  Get,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Audit } from '../../../common/decorators/audit.decorator'
import { AuditActionTypeEnum } from '../../system/audit/audit.constant'
import {
  AppPageResponseDto,
  CreateAppPageDto,
  QueryAppPageDto,
  UpdateAppPageDto,
} from './dto/page.dto'

/**
 * APP页面配置管理控制器
 * 提供页面配置的创建、更新、删除、查询等管理接口
 *
 * @class AppPageController
 */
@ApiTags('APP管理/页面管理')
@Controller('admin/app-page')
export class AppPageController {
  constructor(private readonly libAppPageService: AppPageService) {}

  @Post('create')
  @ApiDoc({
    summary: '创建页面配置',
    model: Boolean,
  })
  async create(@Body() body: CreateAppPageDto) {
    return this.libAppPageService.createPage(body)
  }

  @Get('page')
  @ApiPageDoc({
    summary: '分页查询页面配置列表',
    model: AppPageResponseDto,
  })
  async findPage(@Query() query: QueryAppPageDto) {
    return this.libAppPageService.findPage(query)
  }

  @Get('detail')
  @ApiDoc({
    summary: '根据ID查询页面配置详情',
    model: BaseAppPageDto,
  })
  async findDetail(@Query('id', ParseIntPipe) id: number) {
    return this.libAppPageService.findById(id)
  }

  @Get('detail/code')
  @ApiDoc({
    summary: '根据页面编码查询页面配置详情',
    model: BaseAppPageDto,
  })
  async findByCode(@Query('code') code: string) {
    return this.libAppPageService.findByCode(code)
  }

  @Post('update')
  @ApiDoc({
    summary: '更新页面配置',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '更新页面配置',
  })
  async update(@Body() body: UpdateAppPageDto) {
    return this.libAppPageService.updatePage(body)
  }

  @Post('delete')
  @ApiDoc({
    summary: '批量下线页面配置',
    model: Boolean,
  })
  async batchDelete(@Body() body: IdsDto) {
    return this.libAppPageService.batchDelete(body)
  }
}
