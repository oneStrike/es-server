import { ApiProperty } from '@nestjs/swagger'

/**
 * 用户设备信息 DTO
 * 用于返回用户的登录设备列表
 */
export class UserDeviceDto {
  /**
   * Token ID
   */
  @ApiProperty({
    description: 'Token ID',
    example: 1,
  })
  id: number

  /**
   * JWT Token ID（唯一标识）
   */
  @ApiProperty({
    description: 'JWT Token ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  jti: string

  /**
   * 设备信息（JSON 格式）
   */
  @ApiProperty({
    description: '设备信息',
    example: {
      deviceType: 'mobile',
      os: 'iOS',
      osVersion: '16.0',
      browser: 'Safari',
      browserVersion: '16.0',
    },
  })
  deviceInfo: any

  /**
   * IP 地址
   */
  @ApiProperty({
    description: 'IP 地址',
    example: '192.168.1.1',
  })
  ipAddress: string

  /**
   * 最后使用时间
   */
  @ApiProperty({
    description: '最后使用时间',
    example: '2023-09-15T00:00:00.000Z',
  })
  lastUsedAt: Date

  /**
   * 创建时间
   */
  @ApiProperty({
    description: '创建时间',
    example: '2023-09-15T00:00:00.000Z',
  })
  createdAt: Date
}

/**
 * 撤销设备 DTO
 * 用于撤销特定设备的登录
 */
export class RevokeDeviceDto {
  @ApiProperty({
    description: 'Token ID',
    example: 1,
  })
  tokenId: number
}
