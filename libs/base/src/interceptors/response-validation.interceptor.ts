import type { CallHandler, ExecutionContext, Type } from '@nestjs/common'
import type { Observable } from 'rxjs'
import type { ResponseDtoMetadata } from '../decorators/response-dto.constants'
import { BadRequestException, Injectable, NestInterceptor } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { mergeMap } from 'rxjs/operators'
import { RESPONSE_DTO_METADATA_KEY } from '../decorators/response-dto.constants'

@Injectable()
export class ResponseValidationInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const metadata = this.getMetadata(context)
    if (!metadata?.model) {
      return next.handle()
    }

    return next.handle().pipe(
      mergeMap(async (data) => {
        await this.validateResponse(data, metadata)
        return data
      }),
    )
  }

  private getMetadata(context: ExecutionContext): ResponseDtoMetadata | null {
    const handler = context.getHandler()
    const target = context.getClass()
    return (
      this.reflector.get<ResponseDtoMetadata>(
        RESPONSE_DTO_METADATA_KEY,
        handler,
      ) ??
      this.reflector.get<ResponseDtoMetadata>(
        RESPONSE_DTO_METADATA_KEY,
        target,
      ) ??
      null
    )
  }

  private async validateResponse(
    data: unknown,
    metadata: ResponseDtoMetadata,
  ) {
    if (metadata.isPage) {
      await this.validatePage(data, metadata.model)
      return
    }

    if (metadata.isArray) {
      await this.validateArray(data, metadata.model)
      return
    }

    await this.validateValue(data, metadata.model)
  }

  private async validatePage(data: unknown, model: unknown) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new BadRequestException('响应数据与DTO定义不一致')
    }

    const pageData = data as Record<string, unknown>
    const list = pageData.list
    const pageIndex = pageData.pageIndex
    const pageSize = pageData.pageSize
    const total = pageData.total

    if (!Array.isArray(list)) {
      throw new BadRequestException('响应数据与DTO定义不一致')
    }
    if (!this.isNumber(pageIndex) || !this.isNumber(pageSize)) {
      throw new BadRequestException('响应数据与DTO定义不一致')
    }
    if (!this.isNumber(total)) {
      throw new BadRequestException('响应数据与DTO定义不一致')
    }

    for (const item of list) {
      await this.validateValue(item, model)
    }
  }

  private async validateArray(data: unknown, model: unknown) {
    if (!Array.isArray(data)) {
      throw new BadRequestException('响应数据与DTO定义不一致')
    }
    for (const item of data) {
      await this.validateValue(item, model)
    }
  }

  private async validateValue(data: unknown, model: unknown) {
    if (model === String) {
      if (typeof data !== 'string') {
        throw new BadRequestException('响应数据与DTO定义不一致')
      }
      return
    }

    if (model === Number) {
      if (typeof data !== 'number' || Number.isNaN(data)) {
        throw new BadRequestException('响应数据与DTO定义不一致')
      }
      return
    }

    if (model === Boolean) {
      if (typeof data !== 'boolean') {
        throw new BadRequestException('响应数据与DTO定义不一致')
      }
      return
    }

    if (!this.isClass(model)) {
      return
    }

    if (!data || typeof data !== 'object') {
      throw new BadRequestException('响应数据与DTO定义不一致')
    }

    const instance = plainToInstance(model, data) as object
    const errors = await validate(instance, {
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    })

    if (errors.length > 0) {
      throw new BadRequestException('响应数据与DTO定义不一致')
    }
  }

  private isClass(model: unknown): model is Type<unknown> {
    return typeof model === 'function' && !!(model as any).prototype
  }

  private isNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value)
  }
}
