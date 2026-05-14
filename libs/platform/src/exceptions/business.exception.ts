export interface BusinessExceptionCauseObject {
  message?: string
  code?: string | number
  detail?: string
  constraint?: string
  table?: string
  column?: string
}

export type BusinessExceptionCause =
  | Error
  | string
  | number
  | boolean
  | null
  | Record<string, unknown>
  | BusinessExceptionCauseObject

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
