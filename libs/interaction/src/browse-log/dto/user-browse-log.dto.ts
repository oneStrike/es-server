import { DateProperty } from '@libs/platform/decorators/validate/date-property';
import { EnumProperty } from '@libs/platform/decorators/validate/enum-property';
import { NumberProperty } from '@libs/platform/decorators/validate/number-property';
import { StringProperty } from '@libs/platform/decorators/validate/string-property';
import { BrowseLogTargetTypeEnum } from '../browse-log.constant'

export class BaseUserBrowseLogDto {
  @NumberProperty({
    description: '主键ID',
    example: 1,
    required: true,
    min: 1,
  })
  id!: number

  @EnumProperty({
    description: '浏览目标类型（1=漫画作品；2=小说作品；3=漫画章节；4=小说章节；5=论坛话题）',
    enum: BrowseLogTargetTypeEnum,
    example: BrowseLogTargetTypeEnum.COMIC,
    required: true,
  })
  targetType!: BrowseLogTargetTypeEnum

  @NumberProperty({
    description: '目标 ID',
    example: 1,
    required: true,
    min: 1,
  })
  targetId!: number

  @NumberProperty({
    description: '用户ID',
    example: 1,
    required: true,
    min: 1,
  })
  userId!: number

  @StringProperty({
    description: 'IP地址',
    example: '127.0.0.1',
    required: false,
    maxLength: 45,
  })
  ipAddress?: string

  @StringProperty({
    description: '设备类型',
    example: 'mobile',
    required: false,
    maxLength: 200,
  })
  device?: string

  @StringProperty({
    description: '用户代理',
    example:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    required: false,
    maxLength: 500,
  })
  userAgent?: string

  @DateProperty({
    description: '浏览时间',
    example: '2024-01-01T00:00:00.000Z',
    required: true,
  })
  viewedAt!: Date
}
