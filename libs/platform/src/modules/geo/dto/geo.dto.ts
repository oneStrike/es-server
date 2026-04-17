import type { GeoRuntimeSource } from '../geo.types'
import {
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { GEO_RUNTIME_SOURCE } from '../geo.types'

/**
 * ip2region 运行状态 DTO。
 * 用于后台查看当前进程已加载的属地库与热切换状态。
 */
export class Ip2regionRuntimeStatusDto {
  @BooleanProperty({
    description: '当前进程是否已加载可用属地库',
    example: true,
    required: true,
    validation: false,
  })
  ready!: boolean

  @BooleanProperty({
    description: '当前是否正在执行热切换',
    example: false,
    required: true,
    validation: false,
  })
  reloading!: boolean

  @EnumProperty({
    description:
      '生效库来源（托管 active 目录；环境变量显式路径；仓库默认路径；无可用属地库）',
    enum: GEO_RUNTIME_SOURCE,
    example: GEO_RUNTIME_SOURCE.MANAGED_ACTIVE,
    required: true,
    validation: false,
  })
  source!: GeoRuntimeSource

  @StringProperty({
    description: '当前生效文件名',
    example: '20260408-120000-ip2region_v4.xdb',
    required: false,
    validation: false,
  })
  fileName?: string

  @StringProperty({
    description: '当前生效文件绝对路径',
    example:
      'D:/code/es/es-server/uploads/ip2region/active/20260408-120000-ip2region_v4.xdb',
    required: false,
    validation: false,
  })
  filePath?: string

  @NumberProperty({
    description: '当前生效文件大小（字节）',
    example: 10485760,
    required: false,
    validation: false,
  })
  fileSize?: number

  @DateProperty({
    description: '当前生效时间',
    example: '2026-04-08T12:00:00.000Z',
    required: false,
    validation: false,
  })
  activatedAt?: Date

  @StringProperty({
    description: 'ip2region 专用存储根目录',
    example: 'D:/code/es/es-server/uploads/ip2region',
    required: false,
    validation: false,
  })
  storageDir?: string
}
