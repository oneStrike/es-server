export type BusinessExceptionCause =
  | Error
  | string
  | number
  | boolean
  | null
  | {
      message?: string
      code?: string | number
      detail?: string
    }

export interface BusinessExceptionOptions {
  cause?: BusinessExceptionCause
}

export class BusinessException extends Error {
  readonly code: number
  override readonly cause?: BusinessExceptionCause

  constructor(
    code: number,
    message: string,
    options: BusinessExceptionOptions = {},
  ) {
    super(message, { cause: options.cause })
    this.name = new.target.name
    this.code = code
    this.cause = options.cause
    Object.setPrototypeOf(this, new.target.prototype)
  }
}
