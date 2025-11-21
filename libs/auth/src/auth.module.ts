import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtModule as NestjsJwtModule } from '@nestjs/jwt/dist/jwt.module'
import { PassportModule } from '@nestjs/passport'
import { AuthService } from './auth.service'
import { JwtBlacklistService } from './jwt-blacklist.service'

@Module({
  imports: [
    PassportModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        defaultStrategy: configService.get<string>('auth.strategyKey'),
      }),
    }),
    NestjsJwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('auth.secret')!,
        signOptions: {
          expiresIn: configService.get<number>('auth.expiresIn'),
        },
      }),
    }),
  ],
  providers: [AuthService, JwtBlacklistService],
  exports: [AuthService, JwtBlacklistService],
})
export class BaseAuthModule {}
