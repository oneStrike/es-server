import type {
  BatchDeleteClientPageRequest,
  BatchDeleteClientPageResponse,
  ClientPageDetailByCodeRequest,
  ClientPageDetailByCodeResponse,
  ClientPageDetailByIdRequest,
  ClientPageDetailByIdResponse,
  ClientPagePageRequest,
  ClientPagePageResponse,
  CreateClientPageRequest,
  CreateClientPageResponse,
  UpdateClientPageRequest,
  UpdateClientPageResponse,
} from './types/clientPage.d';

import { requestClient } from '#/utils/request';

/**
 * 创建页面配置
 */
export async function createClientPageApi(
  params: CreateClientPageRequest,
): Promise<CreateClientPageResponse> {
  return requestClient.post<CreateClientPageResponse>(
    '/api/admin/client-page/create-client-page',
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
    '/api/admin/client-page/client-page-page',
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
    '/api/admin/client-page/client-page-detail-by-id',
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
    '/api/admin/client-page/client-page-detail-by-code',
    { params },
  );
}

/**
 * 更新页面配置
 */
export async function updateClientPageApi(
  params: UpdateClientPageRequest,
): Promise<UpdateClientPageResponse> {
  return requestClient.post<UpdateClientPageResponse>(
    '/api/admin/client-page/update-client-page',
    params,
  );
}

/**
 * 批量删除页面配置
 */
export async function batchDeleteClientPageApi(
  params: BatchDeleteClientPageRequest,
): Promise<BatchDeleteClientPageResponse> {
  return requestClient.post<BatchDeleteClientPageResponse>(
    '/api/admin/client-page/batch-delete-client-page',
    params,
  );
}
