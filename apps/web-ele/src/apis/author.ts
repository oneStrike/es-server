import { requestClient } from '#/utils/request';
import type {
  AuthorCreateRequest,
  AuthorCreateResponse,
  AuthorPageRequest,
  AuthorPageResponse,
  AuthorDetailRequest,
  AuthorDetailResponse,
  AuthorUpdateRequest,
  AuthorUpdateResponse,
  AuthorBatchUpdateStatusRequest,
  AuthorBatchUpdateStatusResponse,
  AuthorBatchUpdateFeaturedRequest,
  AuthorBatchUpdateFeaturedResponse,
  AuthorDeleteRequest,
  AuthorDeleteResponse,
  CreateAuthorDto,
  IdDto,
  AuthorPageResponseDto,
  AuthorDetailResponseDto,
  UpdateAuthorDto,
  BatchEnabledDto,
  CountDto,
  UpdateAuthorFeaturedDto,
} from './types/author.d';

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
 * 批量更新作者状态
 */
export async function authorBatchUpdateStatusApi(
  params: AuthorBatchUpdateStatusRequest,
): Promise<AuthorBatchUpdateStatusResponse> {
  return requestClient.post<AuthorBatchUpdateStatusResponse>(
    '/api/admin/work/author/batch-update-status',
    params,
  );
}

/**
 * 批量更新作者推荐状态
 */
export async function authorBatchUpdateFeaturedApi(
  params: AuthorBatchUpdateFeaturedRequest,
): Promise<AuthorBatchUpdateFeaturedResponse> {
  return requestClient.post<AuthorBatchUpdateFeaturedResponse>(
    '/api/admin/work/author/batch-update-featured',
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
