import { BaseAppConfigDto } from '@libs/app-config'
import { OMIT_BASE_FIELDS } from '@libs/platform/dto'
import { OmitType } from '@nestjs/swagger'

export class UpdateAppConfigDto extends OmitType(BaseAppConfigDto, [
  ...OMIT_BASE_FIELDS,
  'updatedById',
] as const) {}
