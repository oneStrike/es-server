import type {
  DictionaryBatchUpdateStatusRequest,
  DictionaryBatchUpdateStatusResponse,
  DictionaryCreateItemRequest,
  DictionaryCreateItemResponse,
  DictionaryCreateRequest,
  DictionaryCreateResponse,
  DictionaryDeleteItemRequest,
  DictionaryDeleteItemResponse,
  DictionaryDeleteRequest,
  DictionaryDeleteResponse,
  DictionaryDetailRequest,
  DictionaryDetailResponse,
  DictionaryItemsRequest,
  DictionaryItemsResponse,
  DictionaryPageRequest,
  DictionaryPageResponse,
  DictionaryUpdateItemRequest,
  DictionaryUpdateItemResponse,
  DictionaryUpdateItemStatusRequest,
  DictionaryUpdateItemStatusResponse,
  DictionaryUpdateRequest,
  DictionaryUpdateResponse,
} from './types/dictionary.d';

import { requestClient } from '#/utils/request';

/**
 * 分页查询字典
 */
export async function dictionaryPageApi(
  params?: DictionaryPageRequest,
): Promise<DictionaryPageResponse> {
  return requestClient.get<DictionaryPageResponse>(
    '/api/admin/dictionary/page',
    { params },
  );
}

/**
 * 获取字典详情
 */
export async function dictionaryDetailApi(
  params: DictionaryDetailRequest,
): Promise<DictionaryDetailResponse> {
  return requestClient.get<DictionaryDetailResponse>(
    '/api/admin/dictionary/detail',
    { params },
  );
}

/**
 * 创建字典
 */
export async function dictionaryCreateApi(
  params: DictionaryCreateRequest,
): Promise<DictionaryCreateResponse> {
  return requestClient.post<DictionaryCreateResponse>(
    '/api/admin/dictionary/create',
    params,
  );
}

/**
 * 更新字典
 */
export async function dictionaryUpdateApi(
  params: DictionaryUpdateRequest,
): Promise<DictionaryUpdateResponse> {
  return requestClient.post<DictionaryUpdateResponse>(
    '/api/admin/dictionary/update',
    params,
  );
}

/**
 * 删除字典
 */
export async function dictionaryDeleteApi(
  params: DictionaryDeleteRequest,
): Promise<DictionaryDeleteResponse> {
  return requestClient.post<DictionaryDeleteResponse>(
    '/api/admin/dictionary/delete',
    params,
  );
}

/**
 * 批量启用禁用字典
 */
export async function dictionaryBatchUpdateStatusApi(
  params: DictionaryBatchUpdateStatusRequest,
): Promise<DictionaryBatchUpdateStatusResponse> {
  return requestClient.post<DictionaryBatchUpdateStatusResponse>(
    '/api/admin/dictionary/batch-update-status',
    params,
  );
}

/**
 * 获取字典项
 */
export async function dictionaryItemsApi(
  params: DictionaryItemsRequest,
): Promise<DictionaryItemsResponse> {
  return requestClient.get<DictionaryItemsResponse>(
    '/api/admin/dictionary/items',
    { params },
  );
}

/**
 * 创建字典项
 */
export async function dictionaryCreateItemApi(
  params: DictionaryCreateItemRequest,
): Promise<DictionaryCreateItemResponse> {
  return requestClient.post<DictionaryCreateItemResponse>(
    '/api/admin/dictionary/create-item',
    params,
  );
}

/**
 * 更新字典项
 */
export async function dictionaryUpdateItemApi(
  params: DictionaryUpdateItemRequest,
): Promise<DictionaryUpdateItemResponse> {
  return requestClient.post<DictionaryUpdateItemResponse>(
    '/api/admin/dictionary/update-item',
    params,
  );
}

/**
 * 删除字典项
 */
export async function dictionaryDeleteItemApi(
  params: DictionaryDeleteItemRequest,
): Promise<DictionaryDeleteItemResponse> {
  return requestClient.post<DictionaryDeleteItemResponse>(
    '/api/admin/dictionary/delete-item',
    params,
  );
}

/**
 * 启用禁用字典项
 */
export async function dictionaryUpdateItemStatusApi(
  params: DictionaryUpdateItemStatusRequest,
): Promise<DictionaryUpdateItemStatusResponse> {
  return requestClient.post<DictionaryUpdateItemStatusResponse>(
    '/api/admin/dictionary/update-item-status',
    params,
  );
}
