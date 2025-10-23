import { ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthGuard } from '@nestjs/passport'
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator'

export function createJwtAuthGuard(strategyKey: string) {
  @Injectable()
  class MixinJwtAuthGuard extends AuthGuard(strategyKey) {
    constructor(public reflector: Reflector) {
      super()
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
      const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
      if (isPublic) {
        return true
      }
      const result = await super.canActivate(context)
      return result as boolean
    }
  }

  return MixinJwtAuthGuard
}
