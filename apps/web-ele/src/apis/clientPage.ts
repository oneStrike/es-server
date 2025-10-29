import type {
  ClientPageBatchDeleteRequest,
  ClientPageBatchDeleteResponse,
  ClientPageCreateRequest,
  ClientPageCreateResponse,
  ClientPageDetailByCodeRequest,
  ClientPageDetailByCodeResponse,
  ClientPageDetailByIdRequest,
  ClientPageDetailByIdResponse,
  ClientPagePageRequest,
  ClientPagePageResponse,
  ClientPageUpdateRequest,
  ClientPageUpdateResponse,
} from './types/clientPage.d';

import { requestClient } from '#/utils/request';

/**
 * 创建页面配置
 */
export async function clientPageCreateApi(
  params: ClientPageCreateRequest,
): Promise<ClientPageCreateResponse> {
  return requestClient.post<ClientPageCreateResponse>(
    '/api/admin/client-page/create',
    params,
  );
}

/**
 * 分页查询页面配置列表
 */
export async function clientPagePageApi(
  params?: ClientPagePageRequest,
): Promise<ClientPagePageResponse> {
  return requestClient.get<ClientPagePageResponse>(
    '/api/admin/client-page/page',
    { params },
  );
}

/**
 * 根据ID查询页面配置详情
 */
export async function clientPageDetailByIdApi(
  params: ClientPageDetailByIdRequest,
): Promise<ClientPageDetailByIdResponse> {
  return requestClient.get<ClientPageDetailByIdResponse>(
    '/api/admin/client-page/detail-by-id',
    { params },
  );
}

/**
 * 根据页面编码查询页面配置详情
 */
export async function clientPageDetailByCodeApi(
  params: ClientPageDetailByCodeRequest,
): Promise<ClientPageDetailByCodeResponse> {
  return requestClient.get<ClientPageDetailByCodeResponse>(
    '/api/admin/client-page/detail-by-code',
    { params },
  );
}

/**
 * 更新页面配置
 */
export async function clientPageUpdateApi(
  params: ClientPageUpdateRequest,
): Promise<ClientPageUpdateResponse> {
  return requestClient.post<ClientPageUpdateResponse>(
    '/api/admin/client-page/update',
    params,
  );
}

/**
 * 批量删除页面配置
 */
export async function clientPageBatchDeleteApi(
  params: ClientPageBatchDeleteRequest,
): Promise<ClientPageBatchDeleteResponse> {
  return requestClient.post<ClientPageBatchDeleteResponse>(
    '/api/admin/client-page/batch-delete',
    params,
  );
}
