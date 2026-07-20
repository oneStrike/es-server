import { DrizzleModule } from '@db/core'
import { Module } from '@nestjs/common'
import { AppUserCountService } from './app-user-count.service'
import { AppUserCredentialService } from './app-user-credential.service'
import { AppUserTokenPersistenceAdapter } from './token/app-user-token-persistence.adapter'
import { AppUserTokenStorageService } from './token/app-user-token-storage.service'
import { UserService } from './user.service'

@Module({
  imports: [DrizzleModule],
  providers: [
    AppUserCountService,
    UserService,
    AppUserCredentialService,
    AppUserTokenPersistenceAdapter,
    AppUserTokenStorageService,
  ],
  exports: [
    AppUserCountService,
    UserService,
    AppUserCredentialService,
    AppUserTokenStorageService,
  ],
})
export class UserModule {}
