import {
  BaseEmojiAssetDto,
  CreateEmojiAssetDto,
  EmojiAssetService,
  QueryEmojiAssetDto,
  UpdateEmojiAssetDto,
} from '@libs/interaction/emoji'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'
import { DragReorderDto, IdDto, UpdateEnabledStatusDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

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
  @ApiDoc({
    summary: '创建表情资源',
    model: Boolean,
  })
  async create(
    @Body() body: CreateEmojiAssetDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.emojiAssetService.createAsset(body, userId)
  }

  @Post('update')
  @ApiDoc({
    summary: '更新表情资源',
    model: Boolean,
  })
  async update(
    @Body() body: UpdateEmojiAssetDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.emojiAssetService.updateAsset(body, userId)
  }

  @Post('delete')
  @ApiDoc({
    summary: '删除表情资源',
    model: Boolean,
  })
  async delete(@Body() body: IdDto) {
    return this.emojiAssetService.deleteAsset(body.id)
  }

  @Post('update-enabled')
  @ApiDoc({
    summary: '更新表情资源启用状态',
    model: Boolean,
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
  @ApiDoc({
    summary: '交换表情资源排序',
    model: Boolean,
  })
  async swapSortOrder(@Body() body: DragReorderDto) {
    return this.emojiAssetService.swapAssetSortOrder(body.dragId, body.targetId)
  }
}
