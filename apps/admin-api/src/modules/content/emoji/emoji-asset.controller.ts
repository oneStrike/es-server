import { BaseEmojiAssetDto, CreateEmojiAssetDto, QueryEmojiAssetDto, UpdateEmojiAssetDto } from '@libs/interaction/emoji/dto/emoji.dto';
import { EmojiAssetService } from '@libs/interaction/emoji/emoji-asset.service';
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators/api-doc.decorator';
import { CurrentUser } from '@libs/platform/decorators/current-user.decorator';
import { IdDto, UpdateEnabledStatusDto } from '@libs/platform/dto/base.dto';
import { DragReorderDto } from '@libs/platform/dto/drag-reorder.dto';
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiAuditDoc } from '../../../common/decorators/api-audit-doc.decorator'

@ApiTags('内容管理/表情管理')
@Controller('admin/content/emoji-asset')
export class EmojiAssetController {
  constructor(private readonly emojiAssetService: EmojiAssetService) {}

  @Get('page')
  @ApiPageDoc({
    summary: '分页查询表情资源',
    model: BaseEmojiAssetDto,
  })
  async getPage(@Query() query: QueryEmojiAssetDto) {
    return this.emojiAssetService.getAssetPage(query)
  }

  @Get('detail')
  @ApiDoc({
    summary: '查询表情资源详情',
    model: BaseEmojiAssetDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.emojiAssetService.getAssetDetail(query.id)
  }

  @Post('create')
  @ApiAuditDoc({
    summary: '创建表情资源',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.CREATE,
    },
  })
  async create(
    @Body() body: CreateEmojiAssetDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.emojiAssetService.createAsset(body, userId)
  }

  @Post('update')
  @ApiAuditDoc({
    summary: '更新表情资源',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async update(
    @Body() body: UpdateEmojiAssetDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.emojiAssetService.updateAsset(body, userId)
  }

  @Post('delete')
  @ApiAuditDoc({
    summary: '删除表情资源',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.DELETE,
    },
  })
  async delete(@Body() body: IdDto) {
    return this.emojiAssetService.deleteAsset(body.id)
  }

  @Post('update-enabled')
  @ApiAuditDoc({
    summary: '更新表情资源启用状态',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateEnabled(
    @Body() body: UpdateEnabledStatusDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.emojiAssetService.updateAssetEnabled(
      body.id,
      body.isEnabled,
      userId,
    )
  }

  @Post('swap-sort-order')
  @ApiAuditDoc({
    summary: '交换表情资源排序',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async swapSortOrder(@Body() body: DragReorderDto) {
    return this.emojiAssetService.swapAssetSortOrder(body.dragId, body.targetId)
  }
}
