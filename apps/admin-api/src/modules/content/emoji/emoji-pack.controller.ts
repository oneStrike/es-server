import { BaseEmojiPackDto, CreateEmojiPackDto, QueryEmojiPackDto, UpdateEmojiPackDto, UpdateEmojiPackSceneTypeDto } from '@libs/interaction/emoji/dto/emoji.dto';
import { EmojiAssetService } from '@libs/interaction/emoji/emoji-asset.service';
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators/api-doc.decorator';
import { CurrentUser } from '@libs/platform/decorators/current-user.decorator';
import { IdDto, UpdateEnabledStatusDto } from '@libs/platform/dto/base.dto';
import { DragReorderDto } from '@libs/platform/dto/drag-reorder.dto';
import { AuditActionTypeEnum } from '@libs/platform/modules/audit'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiAuditDoc } from '../../../common/decorators/api-audit-doc.decorator'

@ApiTags('内容管理/表情管理')
@Controller('admin/content/emoji-pack')
export class EmojiPackController {
  constructor(private readonly emojiAssetService: EmojiAssetService) {}

  @Get('page')
  @ApiPageDoc({
    summary: '分页查询表情包',
    model: BaseEmojiPackDto,
  })
  async getPage(@Query() query: QueryEmojiPackDto) {
    return this.emojiAssetService.getPackPage(query)
  }

  @Get('detail')
  @ApiDoc({
    summary: '查询表情包详情',
    model: BaseEmojiPackDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.emojiAssetService.getPackDetail(query.id)
  }

  @Post('create')
  @ApiAuditDoc({
    summary: '创建表情包',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.CREATE,
    },
  })
  async create(
    @Body() body: CreateEmojiPackDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.emojiAssetService.createPack(body, userId)
  }

  @Post('update')
  @ApiAuditDoc({
    summary: '更新表情包',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async update(
    @Body() body: UpdateEmojiPackDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.emojiAssetService.updatePack(body, userId)
  }

  @Post('delete')
  @ApiAuditDoc({
    summary: '删除表情包',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.DELETE,
    },
  })
  async delete(@Body() body: IdDto) {
    return this.emojiAssetService.deletePack(body.id)
  }

  @Post('update-enabled')
  @ApiAuditDoc({
    summary: '更新表情包启用状态',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateEnabled(
    @Body() body: UpdateEnabledStatusDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.emojiAssetService.updatePackEnabled(
      body.id,
      body.isEnabled,
      userId,
    )
  }

  @Post('swap-sort-order')
  @ApiAuditDoc({
    summary: '交换表情包排序',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async swapSortOrder(@Body() body: DragReorderDto) {
    return this.emojiAssetService.swapPackSortOrder(body.dragId, body.targetId)
  }

  @Post('update-scene-type')
  @ApiAuditDoc({
    summary: '更新表情包场景类型',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateSceneType(
    @Body() body: UpdateEmojiPackSceneTypeDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.emojiAssetService.updatePackSceneType(body, userId)
  }
}
