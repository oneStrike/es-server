import { requestClient } from '#/utils/request';
import type {
  ContentTypeCreateRequest,
  ContentTypeCreateResponse,
  ContentTypeListRequest,
  ContentTypeListResponse,
  ContentTypeUpdateRequest,
  ContentTypeUpdateResponse,
  CreateContentTypeDto,
  IdDto,
  BaseContentTypeDto,
  UpdateContentTypeDto,
} from './types/contentType.d';

/**
 * 创建内容类型
 */
export async function contentTypeCreateApi(
  params: ContentTypeCreateRequest,
): Promise<ContentTypeCreateResponse> {
  return requestClient.post<ContentTypeCreateResponse>(
    '/api/admin/work/content-type/create',
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
    '/api/admin/work/content-type/list',
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
    '/api/admin/work/content-type/update',
    params,
  );
}
