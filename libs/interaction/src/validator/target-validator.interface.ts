import type { InteractionTargetType } from '../interaction.constant'

/**
 * 目标校验结果接口
 */
export interface ITargetValidationResult {
  /** 校验是否通过 */
  valid: boolean
  /** 校验失败时的错误信息 */
  message?: string
  /** 目标对象数据（校验通过时返回） */
  data?: unknown
}

/**
 * 目标校验器接口
 * 所有目标类型校验器必须实现此接口
 */
export interface ITargetValidator {
  /** 支持的目标类型 */
  readonly targetType: InteractionTargetType

  /**
   * 校验目标是否存在且有效
   * @param targetId 目标ID
   * @returns 校验结果
   */
  validate(targetId: number): Promise<ITargetValidationResult>

  /**
   * 批量校验目标是否存在
   * @param targetIds 目标ID数组
   * @returns 存在的目标ID数组
   */
  validateBatch(targetIds: number[]): Promise<number[]>

  /**
   * 获取目标信息
   * @param targetId 目标ID
   * @returns 目标信息
   */
  getTargetInfo(targetId: number): Promise<unknown | null>
}
