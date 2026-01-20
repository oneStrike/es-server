import { BaseService } from '@libs/base/database'
import { BadRequestException, Injectable, } from '@nestjs/common'
import { DEFAULT_APP_CONFIG } from './config.constant'
import {
  UpdateAppConfigDto,
} from './dto/config.dto'

/// 应用配置服务
/// 提供应用配置的创建、查询、更新、删除等功能
/// 实现了 OnModuleInit 接口，在模块初始化时自动创建默认配置
@Injectable()
export class AppConfigService extends BaseService {
  get appConfig() {
    return this.prisma.appConfig
  }

  constructor() {
    super()
  }

  /// 获取最新应用配置
  /// @returns 最新版本的应用配置
  async findActiveConfig() {
    const config = await this.appConfig.findFirst({
      orderBy: [{ version: 'desc' }],
    })
    if (!config) {
      return this.appConfig.create({
        data: DEFAULT_APP_CONFIG,
      })
    }
    return config
  }

  /// 更新应用配置
  /// @param updateConfigDto 更新数据
  /// @returns 更新后的应用配置
  async updateConfig(updateConfigDto: UpdateAppConfigDto) {
    const { id, ...updateData } = updateConfigDto

    const existingConfig = await this.appConfig.findUnique({
      where: { id },
    })

    if (!existingConfig) {
      throw new BadRequestException('应用配置不存在')
    }

    return this.appConfig.update({
      where: { id },
      data: {
        ...updateData,
      },
    })
  }
}
