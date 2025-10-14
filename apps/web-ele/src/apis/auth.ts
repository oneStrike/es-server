import { requestClient } from '#/utils/request';
import type { PublicKeyResponse, RsaPublicKeyDto } from './types/auth.d';

/**
 * 获取Admin专用RSA公钥
 */
export async function publicKeyApi(): Promise<PublicKeyResponse> {
  return requestClient.get<PublicKeyResponse>('/api/admin/auth/public-key');
}
