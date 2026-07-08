import type { BusinessErrorCodeValue } from '@libs/platform/constant'
import type { BusinessExceptionOptions } from './business-exception.type'

export type { BusinessExceptionOptions } from './business-exception.type'

export class BusinessException extends Error {
  readonly code: BusinessErrorCodeValue
  readonly httpStatus?: number
  override readonly cause?: unknown

  constructor(
    code: BusinessErrorCodeValue,
    message: string,
    options: BusinessExceptionOptions = {},
  ) {
    super(message, { cause: options.cause })
    this.name = new.target.name
    this.code = code
    this.httpStatus = options.httpStatus
    this.cause = options.cause
    Object.setPrototypeOf(this, new.target.prototype)
  }
}
