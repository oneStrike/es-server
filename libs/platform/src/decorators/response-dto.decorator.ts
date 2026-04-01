import type { ResponseDtoMetadata } from './response-dto.metadata'
import { SetMetadata } from '@nestjs/common'
import { RESPONSE_DTO_METADATA_KEY } from './response-dto.metadata'

/**
 * 写入响应 DTO 元数据
 */
export function SetResponseDtoMetadata(metadata: ResponseDtoMetadata) {
  return SetMetadata(RESPONSE_DTO_METADATA_KEY, metadata)
}
