import type { AuthConfigInterface, RsaConfigInterface } from '@libs/platform/types'
import { Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { AuthService } from './auth.service'
import { JwtBlacklistService } from './jwt-blacklist.service'
import { LoginGuardService } from './login-guard.service'

@Global()
@Module({
  imports: [
    PassportModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        defaultStrategy: configService.get<string>('auth.strategyKey'),
      }),
    }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const authConfig = configService.get<AuthConfigInterface>('auth')
        const rsaConfig = configService.get<RsaConfigInterface>('rsa')

        if (!authConfig || !rsaConfig) {
          throw new Error('JwtAuthModule: 缺少 auth 或 rsa 配置')
        }

        return {
          privateKey: rsaConfig.privateKey,
          publicKey: rsaConfig.publicKey,
          signOptions: {
            algorithm: 'RS256', // 强制使用 RSA 签名
            expiresIn: authConfig.expiresIn,
            issuer: authConfig.iss,
            audience: authConfig.aud,
          },
          verifyOptions: {
            algorithms: ['RS256'],
            issuer: authConfig.iss,
            audience: authConfig.aud,
          },
        }
      },
    }),
  ],
  providers: [AuthService, JwtBlacklistService, LoginGuardService],
  exports: [JwtModule, AuthService, JwtBlacklistService, LoginGuardService],
})
export class JwtAuthModule {}
