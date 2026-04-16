import { LibDictionaryService } from '@libs/dictionary/dictionary.service';
import { BaseDictionaryDto, BaseDictionaryItemDto, CreateDictionaryDto, CreateDictionaryItemDto, QueryAllDictionaryItemDto, QueryDictionaryDto, QueryDictionaryItemDto, UpdateDictionaryDto, UpdateDictionaryItemDto } from '@libs/dictionary/dto/dictionary.dto';
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators/api-doc.decorator';
import { IdDto, UpdateEnabledStatusDto } from '@libs/platform/dto/base.dto';
import { DragReorderDto } from '@libs/platform/dto/drag-reorder.dto';
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiAuditDoc } from '../../../common/decorators/api-audit-doc.decorator'
import { Audit } from '../../../common/decorators/audit.decorator'

@ApiTags('系统管理/字典管理')
@Controller('admin/dictionary')
export class DictionaryController {
  constructor(private readonly libDictionaryService: LibDictionaryService) {}

  @Get('page')
  @ApiPageDoc({
    summary: '分页查询字典',
    model: BaseDictionaryDto,
  })
  async getPage(@Query() query: QueryDictionaryDto) {
    return this.libDictionaryService.findDictionaries(query)
  }

  @Get('detail')
  @ApiDoc({
    summary: '获取字典详情',
    model: BaseDictionaryDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.libDictionaryService.findDictionaryById(query)
  }

  @Post('create')
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
  @ApiPageDoc({
    summary: '分页获取字典项',
    model: BaseDictionaryItemDto,
  })
  async getItems(@Query() query: QueryDictionaryItemDto) {
    return this.libDictionaryService.findDictionaryItems(query)
  }

  @Get('item/list')
  @ApiDoc({
    summary: '获取所有字典项',
    model: BaseDictionaryItemDto,
  })
  async getAllItems(@Query() query: QueryAllDictionaryItemDto) {
    return this.libDictionaryService.findAllDictionaryItems(query)
  }

  @Post('item/create')
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
  @ApiDoc({
    summary: '启用禁用字典项',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '更新字典项状态',
  })
  async enableItem(@Body() query: UpdateEnabledStatusDto) {
    return this.libDictionaryService.updateDictionaryItemStatus(query)
  }

  @Post('item/delete')
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

  /**
   * 拖拽排序
   */
  @Post('item/swap-sort-order')
  @ApiDoc({
    summary: '字典项交换排序',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '交换字典项排序',
  })
  async itemOrder(@Body() body: DragReorderDto) {
    return this.libDictionaryService.updateDictionaryItemSort(body)
  }
}
