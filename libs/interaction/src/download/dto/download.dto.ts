import { EnumProperty, NumberProperty } from '@libs/base/decorators'
import { BaseDto, PageDto } from '@libs/base/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import { DownloadTargetTypeEnum } from '../download.constant'

export class BaseUserDownloadRecordDto extends PickType(BaseDto, [
  'id',
  'createdAt',
]) {
  @EnumProperty({
    description: '目标类型：1=漫画, 2=小说, 3=漫画章节, 4=小说章节',
    enum: DownloadTargetTypeEnum,
    example: 1,
    required: true,
  })
  targetType!: DownloadTargetTypeEnum

  @NumberProperty({
    description: '目标ID',
    example: 1,
    required: true,
  })
  targetId!: number

  @NumberProperty({
    description: '用户ID',
    example: 1,
    required: true,
  })
  userId!: number
}

export class UserDownloadRecordKeyDto extends PickType(
  BaseUserDownloadRecordDto,
  ['targetType', 'targetId', 'userId'],
) {}

export class QueryUserDownloadRecordDto extends IntersectionType(
  IntersectionType(
    PageDto,
    PartialType(PickType(BaseUserDownloadRecordDto, ['targetType'])),
  ),
  PickType(BaseUserDownloadRecordDto, ['userId']),
) {}
