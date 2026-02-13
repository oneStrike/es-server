import type { Type } from '@nestjs/common'
import { SetMetadata } from '@nestjs/common'

export const RESPONSE_DTO_METADATA_KEY = 'responseDtoMetadata'

export interface ResponseDtoMetadata<TModel = any> {
  model?: Type<TModel> | Record<string, any>
  isArray?: boolean
  isPage?: boolean
}

export function SetResponseDtoMetadata(metadata: ResponseDtoMetadata) {
  return SetMetadata(RESPONSE_DTO_METADATA_KEY, metadata)
}
