import type { WorkflowHandler } from './workflow.type'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable } from '@nestjs/common'

/**
 * 工作流处理器注册表。
 * 只维护 workflowType 到处理器的映射，不依赖任何业务模块。
 */
@Injectable()
export class WorkflowRegistry {
  private readonly handlers = new Map<string, WorkflowHandler>()

  // 注册工作流处理器。
  register(handler: WorkflowHandler) {
    if (this.handlers.has(handler.workflowType)) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        `工作流处理器已存在: ${handler.workflowType}`,
      )
    }

    this.handlers.set(handler.workflowType, handler)
  }

  // 判断工作流类型是否已注册。
  has(workflowType: string) {
    return this.handlers.has(workflowType)
  }

  // 解析工作流处理器，不存在时按业务异常返回。
  resolve(workflowType: string) {
    const handler = this.handlers.get(workflowType)
    if (!handler) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        `工作流处理器不存在: ${workflowType}`,
      )
    }
    return handler
  }

  // 返回已注册工作流类型列表。
  listWorkflowTypes() {
    return [...this.handlers.keys()]
  }
}
