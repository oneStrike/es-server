import { IntersectionType, PartialType } from '@nestjs/swagger'
import {
  NotificationDeliveryIdFieldsDto,
  NotificationDeliveryLookupFieldsDto,
} from './notification-delivery.dto'

export class NotificationDeliveryLookupFilterDto extends IntersectionType(
  PartialType(NotificationDeliveryLookupFieldsDto),
  PartialType(NotificationDeliveryIdFieldsDto),
) {}
