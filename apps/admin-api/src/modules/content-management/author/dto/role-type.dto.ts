import { ValidateString } from '@libs/base/decorators'
import { BaseDto, IdDto, OMIT_BASE_FIELDS } from '@libs/base/dto'
import { IntersectionType, OmitType } from '@nestjs/swagger'

/**
 * 角色类型响应DTO
 */
export class RoleTypeListResponseDto extends BaseDto {
  @ValidateString({
    description: '角色代码',
    example: 'MANGAKA',
    required: true,
  })
  code!: string

  @ValidateString({
    description: '角色名称',
    example: '漫画家',
    required: true,
  })
  name!: string

  @ValidateString({
    description: '角色描述',
    example: '负责漫画创作的核心画师',
    required: false,
  })
  description?: string
}

export class RoleTypeCreateRequestDto extends OmitType(
  RoleTypeListResponseDto,
  OMIT_BASE_FIELDS,
) {}

export class RoleTypeUpdateRequestDto extends IntersectionType(
  RoleTypeCreateRequestDto,
  IdDto,
) {}
