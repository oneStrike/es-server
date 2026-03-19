import { BaseForumNotificationDto } from '@libs/forum'
import { NumberProperty } from '@libs/platform/decorators'
import { BatchOperationResponseDto, PageDto } from '@libs/platform/dto'
import {
  IntersectionType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

export class QueryUserForumNotificationDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseForumNotificationDto, ['type', 'isRead'] as const)),
) {}

export class ForumNotificationUnreadCountDto {
  @NumberProperty({
    description: '未读通知数量',
    example: 3,
    required: true,
    validation: false,
  })
  count!: number
}

export class ForumNotificationBatchResultDto extends BatchOperationResponseDto {}
