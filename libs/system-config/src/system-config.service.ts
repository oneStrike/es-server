import { BaseService } from '@libs/base/database'
import { AesService } from '@libs/base/modules'
import { isMasked, maskString } from '@libs/base/utils'
import { Injectable } from '@nestjs/common'

// 配置元数据定义，用于驱动通用的加解密和脱敏逻辑
const CONFIG_METADATA: Record<string, { sensitiveFields: string[] }> = {
  aliyunConfig: {
    sensitiveFields: ['accessKeyId', 'accessKeySecret'],
  },
  // 未来可以在这里添加其他配置，如 wechatConfig 等
}

@Injectable()
export class SystemConfigService extends BaseService {
  constructor(private readonly aesService: AesService) {
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
    // 1. 获取当前数据库中的配置（解密后的明文），用于对比和回填
    const currentConfig = await this.findActiveConfig()
    const data: any = {}

    for (const key of Object.keys(dto)) {
      // 如果 DTO 中的 key 在元数据中有定义（是配置项 JSON）
      if (CONFIG_METADATA[key]) {
        const inputConfigItem = { ...dto[key] }
        const currentConfigItem = currentConfig
          ? (currentConfig as any)[key]
          : null
        const sensitiveFields = CONFIG_METADATA[key].sensitiveFields

        for (const field of sensitiveFields) {
          const inputValue = inputConfigItem[field]

          // 情况 A: 前端传回的是掩码值 (e.g. "LTA***s2b") -> 说明未修改 -> 使用 DB 中的旧明文
          if (inputValue && isMasked(inputValue)) {
            if (currentConfigItem && currentConfigItem[field]) {
              // 回填旧明文，下一步会被加密
              inputConfigItem[field] = currentConfigItem[field]
            } else {
              // 异常情况：数据库没值但前端传了掩码？置空或保持原样
              inputConfigItem[field] = ''
            }
          }
          // 情况 B: 前端传回的是新明文 (e.g. "NewSecret123") -> 加密
          else if (inputValue) {
            // 保持明文，稍后统一加密
          }
        }

        // 执行加密
        for (const field of sensitiveFields) {
          if (inputConfigItem[field]) {
            inputConfigItem[field] = await this.aesService.encrypt(
              inputConfigItem[field],
            )
          }
        }

        data[key] = inputConfigItem
      } else {
        // 普通字段，直接赋值（如果有的话）
        data[key] = dto[key]
      }
    }

    return this.systemConfig.upsert({
      where: { id: 1 },
      create: data,
      update: data,
    })
  }
}
