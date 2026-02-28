import {
  AppPageResponseDto,
  AppPageService,
  BaseAppPageDto,
  QueryAppPageDto,
  UpdateAppPageDto,
} from '@libs/app-config/page'
import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { BatchOperationResponseDto, IdDto, IdsDto } from '@libs/base/dto'
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
import { ActionTypeEnum } from '../../system/audit/audit.constant'

@ApiTags('APP管理/页面管理')
@Controller('admin/app-page')
export class AppPageController {
  constructor(private readonly libAppPageService: AppPageService) {}

  @Post('/create')
  @ApiDoc({
    summary: '创建页面配置',
    model: IdDto,
  })
  async create(@Body() body: BaseAppPageDto) {
    return this.libAppPageService.createPage(body)
  }

  @Get('/page')
  @ApiPageDoc({
    summary: '分页查询页面配置列表',
    model: AppPageResponseDto,
  })
  async findPage(@Query() query: QueryAppPageDto) {
    return this.libAppPageService.findPage(query)
  }

  @Get('/detail-by-id')
  @ApiDoc({
    summary: '根据ID查询页面配置详情',
    model: BaseAppPageDto,
  })
  async findDetail(@Query('id', ParseIntPipe) id: number) {
    return this.libAppPageService.appPage.findUnique({ where: { id } })
  }

  @Get('/detail-by-code')
  @ApiDoc({
    summary: '根据页面编码查询页面配置详情',
    model: BaseAppPageDto,
  })
  async findByCode(@Query('code') code: string) {
    return this.libAppPageService.appPage.findUnique({
      where: { code },
    })
  }

  @Post('/update')
  @ApiDoc({
    summary: '更新页面配置',
    model: IdDto,
  })
  @Audit({
    actionType: ActionTypeEnum.UPDATE,
    content: '更新页面配置',
  })
  async update(@Body() body: UpdateAppPageDto) {
    return this.libAppPageService.updatePage(body)
  }

  @Post('/batch-delete')
  @ApiDoc({
    summary: '批量删除页面配置',
    model: BatchOperationResponseDto,
  })
  async batchDelete(@Body() body: IdsDto) {
    return this.libAppPageService.appPage.deleteMany({
      where: { id: { in: body.ids } },
    })
  }
}
