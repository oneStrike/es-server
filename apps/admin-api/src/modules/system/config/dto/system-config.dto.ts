import { IdDto } from '@libs/platform/dto'
import {
  BaseSystemConfigDto,
} from '@libs/system-config'
import { IntersectionType } from '@nestjs/swagger'

export class SystemConfigDto extends BaseSystemConfigDto {}

export class SystemConfigBodyDto extends IntersectionType(
  BaseSystemConfigDto,
  IdDto,
) {}
