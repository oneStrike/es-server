import { requestClient } from '#/utils/request';
import type {
  AuthPublicKeyResponse,
  AuthCaptchaResponse,
  AuthLoginRequest,
  AuthLoginResponse,
  AuthLogoutRequest,
  AuthLogoutResponse,
  AuthRefreshTokenRequest,
  AuthRefreshTokenResponse,
  RsaPublicKeyDto,
  CaptchaDto,
  UserLoginDto,
  LoginResponseDto,
  TokenDto,
  RefreshTokenDto,
} from './types/auth.d';

/**
 * 获取Admin专用RSA公钥
 */
export async function authPublicKeyApi(): Promise<AuthPublicKeyResponse> {
  return requestClient.get<AuthPublicKeyResponse>('/api/admin/auth/public-key');
}

/**
 * 获取验证码
 */
export async function authCaptchaApi(): Promise<AuthCaptchaResponse> {
  return requestClient.get<AuthCaptchaResponse>('/api/admin/auth/captcha');
}

/**
 * 管理员登录
 */
export async function authLoginApi(
  params: AuthLoginRequest,
): Promise<AuthLoginResponse> {
  return requestClient.post<AuthLoginResponse>('/api/admin/auth/login', params);
}

/**
 * 管理员登出
 */
export async function authLogoutApi(
  params: AuthLogoutRequest,
): Promise<AuthLogoutResponse> {
  return requestClient.post<AuthLogoutResponse>(
    '/api/admin/auth/logout',
    params,
  );
}

/**
 * 刷新访问令牌
 */
export async function authRefreshTokenApi(
  params: AuthRefreshTokenRequest,
): Promise<AuthRefreshTokenResponse> {
  return requestClient.post<AuthRefreshTokenResponse>(
    '/api/admin/auth/refresh-token',
    params,
  );
}
