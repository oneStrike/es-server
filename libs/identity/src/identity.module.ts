import type { IdentityModuleRegisterOptions } from './identity.module.type'
import { DrizzleModule } from '@db/core'
import { IdentityAdminRbacModule } from '@libs/identity/admin-rbac.module'
import { AuthCronService } from '@libs/platform/modules/auth/auth-cron.service'
import { JwtAuthModule } from '@libs/platform/modules/auth/auth.module'
import { AuthStrategy } from '@libs/platform/modules/auth/auth.strategy'
import { CryptoModule } from '@libs/platform/modules/crypto/crypto.module'
import { DynamicModule, Module } from '@nestjs/common'
import { AdminUserManagementService } from './admin-user-management.service'
import { AdminUserIdentityService } from './admin-user.service'
import { AppUserCredentialService } from './app-user-credential.service'
import { AuthSessionService } from './session.service'
import { IdentityTokenStorageModule } from './token/identity-token-storage.module'

@Module({})
export class IdentityModule {
  static register(options: IdentityModuleRegisterOptions): DynamicModule {
    return {
      module: IdentityModule,
      imports: [
        JwtAuthModule,
        DrizzleModule,
        CryptoModule,
        IdentityAdminRbacModule,
        IdentityTokenStorageModule,
      ],
      providers: [
        AuthSessionService,
        AppUserCredentialService,
        AdminUserIdentityService,
        AdminUserManagementService,
        AuthCronService,
        AuthStrategy,
        {
          provide: 'ITokenStorageService',
          useExisting: options.tokenStorageService,
        },
      ],
      exports: [
        AuthSessionService,
        AppUserCredentialService,
        AdminUserIdentityService,
        AdminUserManagementService,
        IdentityTokenStorageModule,
        'ITokenStorageService',
      ],
    }
  }
}
