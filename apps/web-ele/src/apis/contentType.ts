import { requestClient } from '#/utils/request';
import type {
  CreateContentTypeRequest,
  CreateContentTypeResponse,
  UpdateContentTypeRequest,
  UpdateContentTypeResponse,
  ContentTypeListRequest,
  ContentTypeListResponse,
  CreateContentTypeDto,
  IdDto,
  UpdateContentTypeDto,
  BaseContentTypeDto,
} from './types/contentType.d';

/**
 * 创建内容类型
 */
export async function createContentTypeApi(
  params: CreateContentTypeRequest,
): Promise<CreateContentTypeResponse> {
  return requestClient.post<CreateContentTypeResponse>(
    '/api/admin/work/content-type/create-content-type',
    params,
  );
}

/**
 * 更新内容类型
 */
export async function updateContentTypeApi(
  params: UpdateContentTypeRequest,
): Promise<UpdateContentTypeResponse> {
  return requestClient.post<UpdateContentTypeResponse>(
    '/api/admin/work/content-type/update-content-type',
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
    '/api/admin/work/content-type/content-type-list',
    { params },
  );
}
