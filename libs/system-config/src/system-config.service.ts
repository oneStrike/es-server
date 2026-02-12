import { BaseService } from '@libs/base/database'
import { AesService, RsaService } from '@libs/base/modules'
import { isMasked, maskString } from '@libs/base/utils'
import { Injectable } from '@nestjs/common'

// 配置元数据定义，用于驱动通用的加解密和脱敏逻辑
const CONFIG_METADATA: Record<string, { sensitiveFields: string[] }> = {
  aliyunConfig: {
    sensitiveFields: ['accessKeyId', 'accessKeySecret'],
  },
  growthAntifraudConfig: {
    sensitiveFields: [],
  },
  // 未来可以在这里添加其他配置，如 wechatConfig 等
}

@Injectable()
export class SystemConfigService extends BaseService {
  constructor(
    private readonly aesService: AesService,
    private readonly rsaService: RsaService,
  ) {
    super()
  }

  get systemConfig() {
    return this.prisma.systemConfig
  }

  /**
   * 获取系统配置（内部使用，解密为明文）
   * @returns 包含明文敏感信息的配置对象
   */
  async findActiveConfig() {
    const config = await this.systemConfig.findUnique({
      where: { id: 1 },
    })

    if (!config) {
      return null
    }

    // 遍历元数据进行解密
    for (const [key, metadata] of Object.entries(CONFIG_METADATA)) {
      const configItem = (config as any)[key]
      if (configItem) {
        for (const field of metadata.sensitiveFields) {
          if (configItem[field]) {
            try {
              configItem[field] = await this.aesService.decrypt(
                configItem[field],
              )
            } catch {
              // 忽略解密失败
            }
          }
        }
      }
    }

    return config
  }

  /**
   * 获取脱敏后的系统配置（供前端展示）
   */
  async findMaskedConfig() {
    const config = await this.findActiveConfig()
    if (!config) {
      return null
    }

    // 深拷贝一份用于脱敏，避免污染缓存或引用（虽然 findActiveConfig 返回的是新对象，但保险起见）
    const maskedConfig = JSON.parse(JSON.stringify(config))

    // 遍历元数据进行脱敏
    for (const [key, metadata] of Object.entries(CONFIG_METADATA)) {
      const configItem = maskedConfig[key]
      if (configItem) {
        for (const field of metadata.sensitiveFields) {
          if (configItem[field]) {
            configItem[field] = maskString(configItem[field])
          }
        }
      }
    }

    return maskedConfig
  }

  /**
   * 更新系统配置（自动处理加密和掩码忽略）
   */
  async updateConfig(dto: Record<string, any>) {
    // 读取当前明文配置，用于掩码回填与增量更新
    const currentConfig = await this.findActiveConfig()
    const data: any = {}

    // 兼容扁平入参：accessKeyId / sms 等直接视为 aliyunConfig
    if (dto.accessKeyId || dto.sms) {
      // 构造 aliyunConfig 对象
      const aliyunConfigData = { ...dto }
      const metadata = CONFIG_METADATA.aliyunConfig
      const currentConfigItem = currentConfig
        ? (currentConfig as any).aliyunConfig
        : null

      // 掩码回填 + 加密处理
      for (const field of metadata.sensitiveFields) {
        const inputValue = aliyunConfigData[field]

        if (inputValue && isMasked(inputValue)) {
          // 前端传回掩码则保留旧值
          if (currentConfigItem && currentConfigItem[field]) {
            aliyunConfigData[field] = currentConfigItem[field]
          } else {
            aliyunConfigData[field] = ''
          }
        } else if (inputValue) {
          // 尝试 RSA 解密（前端加密传输），失败则视为明文
          try {
            const decryptedValue = this.rsaService.decryptWith(inputValue)
            aliyunConfigData[field] =
              await this.aesService.encrypt(decryptedValue)
          } catch {
            // 如果 RSA 解密失败（可能是普通明文或已经处理过），则直接 AES 加密
            aliyunConfigData[field] = await this.aesService.encrypt(inputValue)
          }
        }
      }

      data.aliyunConfig = aliyunConfigData
    } else {
      // 结构化入参处理，例如 { aliyunConfig: {...}, wechatConfig: {...} }
      for (const key of Object.keys(dto)) {
        if (CONFIG_METADATA[key]) {
          const inputConfigItem = { ...dto[key] }
          const currentConfigItem = currentConfig
            ? (currentConfig as any)[key]
            : null
          const sensitiveFields = CONFIG_METADATA[key].sensitiveFields

          for (const field of sensitiveFields) {
            const inputValue = inputConfigItem[field]

            if (inputValue && isMasked(inputValue)) {
              // 前端传回掩码则保留旧值
              if (currentConfigItem && currentConfigItem[field]) {
                inputConfigItem[field] = currentConfigItem[field]
              } else {
                inputConfigItem[field] = ''
              }
            }
          }

          // 对敏感字段执行加密存储
          for (const field of sensitiveFields) {
            if (inputConfigItem[field]) {
              // 尝试 RSA 解密（处理前端传输的加密值），再 AES 加密存储
              try {
                const decryptedValue = this.rsaService.decryptWith(
                  inputConfigItem[field],
                )
                inputConfigItem[field] =
                  await this.aesService.encrypt(decryptedValue)
              } catch {
                inputConfigItem[field] = await this.aesService.encrypt(
                  inputConfigItem[field],
                )
              }
            }
          }

          data[key] = inputConfigItem
        } else {
          // 仅允许 Prisma 模型中存在的字段通过
          // 实际上应该通过 DTO 验证，但为了防止 prisma 报错，这里可以加个简单的过滤或信任 DTO
          // 鉴于报错是因为传入了 accessKeyId 到 root，所以上面的 if (dto.accessKeyId) 已经拦截了最常见的情况
          // 这里保留原有逻辑，或者直接赋值（如果 DTO 结构正确的话）
          data[key] = dto[key]
        }
      }
    }

    // 过滤 data 中未定义的字段，避免将 undefined 传入 Prisma
    const cleanData: any = {}
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleanData[key] = value
      }
    }

    return this.systemConfig.upsert({
      where: { id: 1 },
      create: cleanData,
      update: cleanData,
    })
  }
}
