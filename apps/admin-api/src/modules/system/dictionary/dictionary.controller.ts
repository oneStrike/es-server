import { LibDictionaryService } from '@libs/dictionary/dictionary.service'
import {
  CreateDictionaryDto,
  CreateDictionaryItemDto,
  DictionaryItemOutputDto,
  DictionaryOutputDto,
  QueryAllDictionaryItemDto,
  QueryDictionaryDto,
  QueryDictionaryItemDto,
  UpdateDictionaryDto,
  UpdateDictionaryItemDto,
} from '@libs/dictionary/dto/dictionary.dto'
import { AuditActionTypeEnum } from '@libs/observability/audit/audit-action.constant'
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators'

import {
  DragReorderDto,
  IdDto,
  UpdateEnabledStatusDto,
} from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AdminPermission } from '../../../common/decorators/admin-permission.decorator'
import { ApiAuditDoc } from '../../../common/decorators/api-audit-doc.decorator'

@ApiTags('系统管理/字典管理')
@Controller('admin/dictionary')
export class DictionaryController {
  constructor(private readonly libDictionaryService: LibDictionaryService) {}

  @Get('page')
  @AdminPermission({
    code: 'dictionary:page',
    name: '分页查询字典',
    groupCode: 'dictionary',
  })
  @ApiPageDoc({
    summary: '分页查询字典',
    model: DictionaryOutputDto,
  })
  async getPage(@Query() query: QueryDictionaryDto) {
    return this.libDictionaryService.findDictionaries(query)
  }

  @Get('detail')
  @AdminPermission({
    code: 'dictionary:detail',
    name: '获取字典详情',
    groupCode: 'dictionary',
  })
  @ApiDoc({
    summary: '获取字典详情',
    model: DictionaryOutputDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.libDictionaryService.findDictionaryById(query)
  }

  @Post('create')
  @AdminPermission({
    code: 'dictionary:create',
    name: '创建字典',
    groupCode: 'dictionary',
  })
  @ApiAuditDoc({
    summary: '创建字典',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.CREATE,
    },
  })
  async create(@Body() createDictionaryDto: CreateDictionaryDto) {
    return this.libDictionaryService.createDictionary(createDictionaryDto)
  }

  @Post('update')
  @AdminPermission({
    code: 'dictionary:update',
    name: '更新字典',
    groupCode: 'dictionary',
  })
  @ApiAuditDoc({
    summary: '更新字典',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async update(@Body() updateDictionaryDto: UpdateDictionaryDto) {
    return this.libDictionaryService.updateDictionary(updateDictionaryDto)
  }

  @Post('delete')
  @AdminPermission({
    code: 'dictionary:delete',
    name: '删除字典',
    groupCode: 'dictionary',
  })
  @ApiAuditDoc({
    summary: '删除字典',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.DELETE,
    },
  })
  async delete(@Body() query: IdDto) {
    return this.libDictionaryService.deleteDictionary(query)
  }

  @Post('update-status')
  @AdminPermission({
    code: 'dictionary:update:status',
    name: '更新字典状态',
    groupCode: 'dictionary',
  })
  @ApiAuditDoc({
    summary: '更新字典状态',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateStatus(@Body() query: UpdateEnabledStatusDto) {
    return this.libDictionaryService.updateDictionaryStatus(query)
  }

  @Get('item/page')
  @AdminPermission({
    code: 'dictionary:item:page',
    name: '分页获取字典项',
    groupCode: 'dictionary',
  })
  @ApiPageDoc({
    summary: '分页获取字典项',
    model: DictionaryItemOutputDto,
  })
  async getItems(@Query() query: QueryDictionaryItemDto) {
    return this.libDictionaryService.findDictionaryItems(query)
  }

  @Get('item/list')
  @AdminPermission({
    code: 'dictionary:item:list',
    name: '获取所有字典项',
    groupCode: 'dictionary',
  })
  @ApiDoc({
    summary: '获取所有字典项',
    model: DictionaryItemOutputDto,
    isArray: true,
  })
  async getAllItems(@Query() query: QueryAllDictionaryItemDto) {
    return this.libDictionaryService.findAllDictionaryItems(query)
  }

  @Post('item/create')
  @AdminPermission({
    code: 'dictionary:item:create',
    name: '创建字典项',
    groupCode: 'dictionary',
  })
  @ApiAuditDoc({
    summary: '创建字典项',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.CREATE,
    },
  })
  async createItem(@Body() createDictionaryItemDto: CreateDictionaryItemDto) {
    return this.libDictionaryService.createDictionaryItem(
      createDictionaryItemDto,
    )
  }

  @Post('item/update')
  @AdminPermission({
    code: 'dictionary:item:update',
    name: '更新字典项',
    groupCode: 'dictionary',
  })
  @ApiAuditDoc({
    summary: '更新字典项',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateItem(@Body() updateDictionaryItemDto: UpdateDictionaryItemDto) {
    return this.libDictionaryService.updateDictionaryItem(
      updateDictionaryItemDto,
    )
  }

  @Post('item/update-status')
  @AdminPermission({
    code: 'dictionary:item:update:status',
    name: '启用禁用字典项',
    groupCode: 'dictionary',
  })
  @ApiAuditDoc({
    summary: '启用禁用字典项',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
      content: '更新字典项状态',
    },
  })
  async enableItem(@Body() query: UpdateEnabledStatusDto) {
    return this.libDictionaryService.updateDictionaryItemStatus(query)
  }

  @Post('item/delete')
  @AdminPermission({
    code: 'dictionary:item:delete',
    name: '删除字典项',
    groupCode: 'dictionary',
  })
  @ApiAuditDoc({
    summary: '删除字典项',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.DELETE,
    },
  })
  async deleteItem(@Body() query: IdDto) {
    return this.libDictionaryService.deleteDictionaryItem(query)
  }

  @Post('item/swap-sort-order')
  @AdminPermission({
    code: 'dictionary:item:swap:sort:order',
    name: '字典项交换排序',
    groupCode: 'dictionary',
  })
  @ApiAuditDoc({
    summary: '字典项交换排序',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async itemOrder(@Body() body: DragReorderDto) {
    return this.libDictionaryService.updateDictionaryItemSort(body)
  }
}
