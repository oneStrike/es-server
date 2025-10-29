import type {
  ThirdPartyPlatformResponse,
  ThirdPartySearchRequest,
  ThirdPartySearchResponse,
} from './types/thirdParty.d';

import { requestClient } from '#/utils/request';

/**
 * 获取第三方漫画平台列表
 */
export async function thirdPartyPlatformApi(): Promise<ThirdPartyPlatformResponse> {
  return requestClient.get<ThirdPartyPlatformResponse>(
    '/api/admin/work/comic/third-party/platform',
  );
}

/**
 * 搜索第三方平台漫画
 */
export async function thirdPartySearchApi(
  params: ThirdPartySearchRequest,
): Promise<ThirdPartySearchResponse> {
  return requestClient.get<ThirdPartySearchResponse>(
    '/api/admin/work/comic/third-party/search',
    { params },
  );
}
