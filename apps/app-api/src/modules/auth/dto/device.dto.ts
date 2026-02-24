import { DateProperty, JsonProperty, NumberProperty, StringProperty } from '@libs/base/decorators'

/**
 * 用户设备信息 DTO
 * 用于返回用户的登录设备列表
 */
export class UserDeviceDto {
  /**
   * Token ID
   */
  @NumberProperty({
    description: 'Token ID',
    example: 1,
    validation: false,
  })
  id: number

  /**
   * JWT Token ID（唯一标识）
   */
  @StringProperty({
    description: 'JWT Token ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
    validation: false,
  })
  jti: string

  /**
   * 设备信息（JSON 格式）
   */
  @JsonProperty({
    description: '设备信息',
    example: {
      deviceType: 'mobile',
      os: 'iOS',
      osVersion: '16.0',
      browser: 'Safari',
      browserVersion: '16.0',
    },
    validation: false,
  })
  deviceInfo: any

  /**
   * IP 地址
   */
  @StringProperty({
    description: 'IP 地址',
    example: '192.168.1.1',
    validation: false,
  })
  ipAddress: string

  /**
   * 最后使用时间
   */
  @DateProperty({
    description: '最后使用时间',
    example: '2023-09-15T00:00:00.000Z',
    validation: false,
  })
  lastUsedAt: Date

  /**
   * 创建时间
   */
  @DateProperty({
    description: '创建时间',
    example: '2023-09-15T00:00:00.000Z',
    validation: false,
  })
  createdAt: Date
}

/**
 * 撤销设备 DTO
 * 用于撤销特定设备的登录
 */
export class RevokeDeviceDto {
  @NumberProperty({
    description: 'Token ID',
    example: 1,
  })
  tokenId: number
}
