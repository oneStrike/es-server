import type {
  PlatformResponse,
  SearchRequest,
  SearchResponse,
} from './types/thirdParty.d';

import { requestClient } from '#/utils/request';

/**
 * 获取第三方漫画平台列表
 */
export async function platformApi(): Promise<PlatformResponse> {
  return requestClient.get<PlatformResponse>(
    '/api/admin/work/comic/third-party/platform',
  );
}

/**
 * 搜索第三方平台漫画
 */
export async function searchApi(
  params: SearchRequest,
): Promise<SearchResponse> {
  return requestClient.get<SearchResponse>(
    '/api/admin/work/comic/third-party/search',
    { params },
  );
}
