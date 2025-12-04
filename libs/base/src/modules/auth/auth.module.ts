import { Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { AuthService } from './auth.service'
import { AuthStrategy } from './auth.strategy'
import { JwtBlacklistService } from './jwt-blacklist.service'

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
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('auth.secret')!,
        signOptions: {
          expiresIn: configService.get<number>('auth.expiresIn'),
        },
      }),
    }),
  ],
  providers: [AuthService, JwtBlacklistService, AuthStrategy],
  exports: [AuthService, JwtBlacklistService],
})
export class JwtAuthModule {}
