import type { InteractionTargetType } from '../interaction.constant'
import type { ITargetValidator } from './target-validator.interface'
import { Injectable } from '@nestjs/common'

/**
 * 目标校验器注册表
 * 管理所有目标类型的校验器
 */
@Injectable()
export class TargetValidatorRegistry {
  private readonly validators = new Map<InteractionTargetType, ITargetValidator>()

  /**
   * 注册校验器
   * @param validator 校验器实例
   */
  register(validator: ITargetValidator): void {
    this.validators.set(validator.targetType, validator)
  }

  /**
   * 获取校验器
   * @param targetType 目标类型
   * @returns 校验器实例
   */
  getValidator(targetType: InteractionTargetType): ITargetValidator {
    const validator = this.validators.get(targetType)
    if (!validator) {
      throw new Error(`未找到目标类型 ${targetType} 的校验器`)
    }
    return validator
  }

  /**
   * 检查是否支持该目标类型
   * @param targetType 目标类型
   * @returns 是否支持
   */
  hasValidator(targetType: InteractionTargetType): boolean {
    return this.validators.has(targetType)
  }

  /**
   * 获取所有支持的目标类型
   * @returns 目标类型数组
   */
  getSupportedTypes(): InteractionTargetType[] {
    return Array.from(this.validators.keys())
  }
}
