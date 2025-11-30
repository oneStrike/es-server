import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { BatchOperationResponseDto, IdDto, IdsDto } from '@libs/base/dto'
import { ActionTypeEnum } from '@libs/base/types'
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
import {
  BaseClientPageDto,
  ClientPagePageResponseDto,
  QueryClientPageDto,
  UpdateClientPageDto,
} from './dto/page.dto'
import { ClientPageService } from './page.service'

/**
 * 客户端页面配置控制器
 * 提供页面配置相关的API接口
 */
@ApiTags('客户端页面配置模块')
@Controller('admin/client-page')
export class ClientPageController {
  constructor(private readonly pageService: ClientPageService) {}

  /**
   * 创建页面配置
   */
  @Post('/create')
  @ApiDoc({
    summary: '创建页面配置',
    model: IdDto,
  })
  async create(@Body() body: BaseClientPageDto) {
    return this.pageService.createPage(body)
  }

  /**
   * 分页查询页面配置列表
   */
  @Get('/page')
  @ApiPageDoc({
    summary: '分页查询页面配置列表',
    model: ClientPagePageResponseDto,
  })
  async findPage(@Query() query: QueryClientPageDto) {
    return this.pageService.findPage(query)
  }

  /**
   * 根据ID查询页面配置详情
   */
  @Get('/detail-by-id')
  @ApiDoc({
    summary: '根据ID查询页面配置详情',
    model: BaseClientPageDto,
  })
  async findDetail(@Query('id', ParseIntPipe) id: number) {
    return this.pageService.clientPage.findUnique({ where: { id } })
  }

  /**
   * 根据页面编码查询页面配置详情
   */
  @Get('/detail-by-code')
  @ApiDoc({
    summary: '根据页面编码查询页面配置详情',
    model: BaseClientPageDto,
  })
  async findByCode(@Query('code') code: string) {
    return this.pageService.clientPage.findUnique({
      where: { code },
    })
  }

  /**
   * 批量更新页面配置状态
   */
  @Post('/update')
  @ApiDoc({
    summary: '更新页面配置',
    model: IdDto,
  })
  @Audit({
    actionType: ActionTypeEnum.UPDATE,
    content: '更新页面配置',
  })
  async update(@Body() body: UpdateClientPageDto) {
    return this.pageService.updatePage(body)
  }

  /**
   * 批量删除页面配置
   */
  @Post('/batch-delete')
  @ApiDoc({
    summary: '批量删除页面配置',
    model: BatchOperationResponseDto,
  })
  async batchDelete(@Body() body: IdsDto) {
    return this.pageService.clientPage.deleteMany({
      where: { id: { in: body.ids } },
    })
  }
}
