import { JwtAuthModule } from '@libs/platform/modules/auth/auth.module'
import { DynamicModule, Module, Provider } from '@nestjs/common'
import { AuthSessionService } from './session.service'

@Module({})
export class IdentityModule {
  static register(options: { tokenStorageProvider: Provider }): DynamicModule {
    return {
      module: IdentityModule,
      imports: [JwtAuthModule],
      providers: [AuthSessionService, options.tokenStorageProvider],
      exports: [AuthSessionService],
    }
  }
}
