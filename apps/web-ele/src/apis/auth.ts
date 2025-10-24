import type {
  CaptchaResponse,
  LoginRequest,
  LoginResponse,
  LogoutRequest,
  LogoutResponse,
  PublicKeyResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
} from './types/auth.d';

import { requestClient } from '#/utils/request';

/**
 * 获取Admin专用RSA公钥
 */
export async function publicKeyApi(): Promise<PublicKeyResponse> {
  return requestClient.get<PublicKeyResponse>('/api/admin/auth/public-key');
}

/**
 * 获取验证码
 */
export async function captchaApi(): Promise<CaptchaResponse> {
  return requestClient.get<CaptchaResponse>('/api/admin/auth/captcha');
}

/**
 * 管理员登录
 */
export async function loginApi(params: LoginRequest): Promise<LoginResponse> {
  return requestClient.post<LoginResponse>('/api/admin/auth/login', params);
}

/**
 * 管理员登出
 */
export async function logoutApi(
  params: LogoutRequest,
): Promise<LogoutResponse> {
  return requestClient.post<LogoutResponse>('/api/admin/auth/logout', params);
}

/**
 * 刷新访问令牌
 */
export async function refreshTokenApi(
  params: RefreshTokenRequest,
): Promise<RefreshTokenResponse> {
  return requestClient.post<RefreshTokenResponse>(
    '/api/admin/auth/refresh-token',
    params,
  );
}
