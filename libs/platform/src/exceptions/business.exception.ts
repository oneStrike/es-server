export interface BusinessExceptionOptions {
  cause?: unknown
}

export class BusinessException extends Error {
  readonly code: number
  override readonly cause?: unknown

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
