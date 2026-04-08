import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AdminSeedService } from './admin-seed.service';
import { AuthContextService } from './auth-context.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { TokenService } from './token.service';

@Global()
@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    AuthContextService,
    AdminSeedService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
  exports: [AuthService, AuthContextService, TokenService],
})
export class AuthModule {}
