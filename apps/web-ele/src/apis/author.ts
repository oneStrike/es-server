import type {
  AuthorCreateRequest,
  AuthorCreateResponse,
  AuthorDeleteRequest,
  AuthorDeleteResponse,
  AuthorDetailRequest,
  AuthorDetailResponse,
  AuthorPageRequest,
  AuthorPageResponse,
  AuthorUpdateFeaturedRequest,
  AuthorUpdateFeaturedResponse,
  AuthorUpdateRequest,
  AuthorUpdateResponse,
  AuthorUpdateStatusRequest,
  AuthorUpdateStatusResponse,
} from './types/author.d';

import { requestClient } from '#/utils/request';

/**
 * 创建作者
 */
export async function authorCreateApi(
  params: AuthorCreateRequest,
): Promise<AuthorCreateResponse> {
  return requestClient.post<AuthorCreateResponse>(
    '/api/admin/work/author/create',
    params,
  );
}

/**
 * 分页查询作者列表
 */
export async function authorPageApi(
  params?: AuthorPageRequest,
): Promise<AuthorPageResponse> {
  return requestClient.get<AuthorPageResponse>('/api/admin/work/author/page', {
    params,
  });
}

/**
 * 获取作者详情
 */
export async function authorDetailApi(
  params: AuthorDetailRequest,
): Promise<AuthorDetailResponse> {
  return requestClient.get<AuthorDetailResponse>(
    '/api/admin/work/author/detail',
    { params },
  );
}

/**
 * 更新作者信息
 */
export async function authorUpdateApi(
  params: AuthorUpdateRequest,
): Promise<AuthorUpdateResponse> {
  return requestClient.post<AuthorUpdateResponse>(
    '/api/admin/work/author/update',
    params,
  );
}

/**
 * 删除作者
 */
export async function authorDeleteApi(
  params: AuthorDeleteRequest,
): Promise<AuthorDeleteResponse> {
  return requestClient.post<AuthorDeleteResponse>(
    '/api/admin/work/author/delete',
    params,
  );
}

/**
 * 更新作者状态
 */
export async function authorUpdateStatusApi(
  params: AuthorUpdateStatusRequest,
): Promise<AuthorUpdateStatusResponse> {
  return requestClient.post<AuthorUpdateStatusResponse>(
    '/api/admin/work/author/update-status',
    params,
  );
}

/**
 * 更新作者推荐状态
 */
export async function authorUpdateFeaturedApi(
  params: AuthorUpdateFeaturedRequest,
): Promise<AuthorUpdateFeaturedResponse> {
  return requestClient.post<AuthorUpdateFeaturedResponse>(
    '/api/admin/work/author/update-featured',
    params,
  );
}
