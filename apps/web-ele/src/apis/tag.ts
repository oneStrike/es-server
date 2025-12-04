import type {
  TagCreateRequest,
  TagCreateResponse,
  TagDeleteRequest,
  TagDeleteResponse,
  TagDetailRequest,
  TagDetailResponse,
  TagOrderRequest,
  TagOrderResponse,
  TagPageRequest,
  TagPageResponse,
  TagUpdateRequest,
  TagUpdateResponse,
  TagUpdateStatusRequest,
  TagUpdateStatusResponse,
} from './types/tag.d';

import { requestClient } from '#/utils/request';

/**
 * 创建标签
 */
export async function tagCreateApi(
  params: TagCreateRequest,
): Promise<TagCreateResponse> {
  return requestClient.post<TagCreateResponse>(
    '/api/admin/work/tag/create',
    params,
  );
}

/**
 * 分页查询标签列表
 */
export async function tagPageApi(
  params?: TagPageRequest,
): Promise<TagPageResponse> {
  return requestClient.get<TagPageResponse>('/api/admin/work/tag/page', {
    params,
  });
}

/**
 * 获取标签详情
 */
export async function tagDetailApi(
  params: TagDetailRequest,
): Promise<TagDetailResponse> {
  return requestClient.get<TagDetailResponse>('/api/admin/work/tag/detail', {
    params,
  });
}

/**
 * 更新标签信息
 */
export async function tagUpdateApi(
  params: TagUpdateRequest,
): Promise<TagUpdateResponse> {
  return requestClient.post<TagUpdateResponse>(
    '/api/admin/work/tag/update',
    params,
  );
}

/**
 * 标签拖拽排序
 */
export async function tagOrderApi(
  params: TagOrderRequest,
): Promise<TagOrderResponse> {
  return requestClient.post<TagOrderResponse>(
    '/api/admin/work/tag/order',
    params,
  );
}

/**
 * 更新标签状态
 */
export async function tagUpdateStatusApi(
  params: TagUpdateStatusRequest,
): Promise<TagUpdateStatusResponse> {
  return requestClient.post<TagUpdateStatusResponse>(
    '/api/admin/work/tag/update-status',
    params,
  );
}

/**
 * 删除标签
 */
export async function tagDeleteApi(
  params: TagDeleteRequest,
): Promise<TagDeleteResponse> {
  return requestClient.post<TagDeleteResponse>(
    '/api/admin/work/tag/delete',
    params,
  );
}
