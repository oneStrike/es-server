import { ValidateNumber, ValidateString } from '@libs/base/decorators'

/**
 * 角色类型响应DTO
 */
export class RoleTypeListResponseDto {
  @ValidateNumber({
    description: '角色类型ID',
    example: 1,
    required: true,
  })
  id!: number

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
