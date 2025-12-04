import type {
  ContentTypeCreateRequest,
  ContentTypeCreateResponse,
  ContentTypeListRequest,
  ContentTypeListResponse,
  ContentTypeUpdateRequest,
  ContentTypeUpdateResponse,
} from './types/contentType.d';

import { requestClient } from '#/utils/request';

/**
 * 创建内容类型
 */
export async function contentTypeCreateApi(
  params: ContentTypeCreateRequest,
): Promise<ContentTypeCreateResponse> {
  return requestClient.post<ContentTypeCreateResponse>(
    '/api/admin/content-type/create',
    params,
  );
}

/**
 * 内容类型列表
 */
export async function contentTypeListApi(
  params?: ContentTypeListRequest,
): Promise<ContentTypeListResponse> {
  return requestClient.get<ContentTypeListResponse>(
    '/api/admin/content-type/list',
    { params },
  );
}

/**
 * 更新内容类型
 */
export async function contentTypeUpdateApi(
  params: ContentTypeUpdateRequest,
): Promise<ContentTypeUpdateResponse> {
  return requestClient.post<ContentTypeUpdateResponse>(
    '/api/admin/content-type/update',
    params,
  );
}
