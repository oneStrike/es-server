import { BaseForumNotificationDto } from '@libs/forum'
import { PageDto } from '@libs/platform/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

export class CreateForumNotificationDto extends OmitType(
  BaseForumNotificationDto,
  ['id', 'isRead', 'readAt', 'createdAt'] as const,
) {}

export class QueryForumNotificationDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseForumNotificationDto, [
      'userId',
      'topicId',
      'type',
      'isRead',
    ] as const),
  ),
) {}
