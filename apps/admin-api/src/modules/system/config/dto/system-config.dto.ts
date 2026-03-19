import { IdDto } from '@libs/platform/dto'
import {
  BaseSystemConfigDto,
} from '@libs/system-config'
import { IntersectionType, PickType } from '@nestjs/swagger'

export class SystemConfigDto extends BaseSystemConfigDto {}

export class SystemConfigBodyDto extends IntersectionType(
  PickType(BaseSystemConfigDto, [
    'updatedById',
    'aliyunConfig',
    'siteConfig',
    'maintenanceConfig',
    'contentReviewPolicy',
    'uploadConfig',
  ]),
  IdDto,
) {}
