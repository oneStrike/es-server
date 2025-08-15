import { requestClient } from '#/utils/request'
import type {
  DictionaryPageRequest,
  DictionaryPageResponse,
  DictionaryDetailRequest,
  DictionaryDetailResponse,
  CreateDictionaryRequest,
  CreateDictionaryResponse,
  UpdateDictionaryRequest,
  UpdateDictionaryResponse,
  DeleteDictionaryRequest,
  DeleteDictionaryResponse,
  BatchUpdateDictionaryStatusRequest,
  BatchUpdateDictionaryStatusResponse,
  DictionaryItemsRequest,
  DictionaryItemsResponse,
  CreateDictionaryItemRequest,
  CreateDictionaryItemResponse,
  UpdateDictionaryItemRequest,
  UpdateDictionaryItemResponse,
  DeleteDictionaryItemRequest,
  DeleteDictionaryItemResponse,
  UpdateDictionaryItemStatusRequest,
  UpdateDictionaryItemStatusResponse,
  DictionaryDto,
  CreateDictionaryDto,
  IdDto,
  IdsDto,
  BatchEnabledDto,
  CountDto,
  DictionaryItemDto,
  CreateDictionaryItemDto,
  UpdateDictionaryItemDto
} from './types/dictionary'


  /**
   * 分页查询字典
   */
  export async function dictionaryPageApi(params: DictionaryPageRequest): Promise<DictionaryPageResponse> {
    return requestClient.get<DictionaryPageResponse>('/api/admin/dictionary/dictionary-page', { params });
  }


  /**
   * 获取字典详情
   */
  export async function dictionaryDetailApi(params: DictionaryDetailRequest): Promise<DictionaryDetailResponse> {
    return requestClient.get<DictionaryDetailResponse>('/api/admin/dictionary/dictionary-detail', { params });
  }


  /**
   * 创建字典
   */
  export async function createDictionaryApi(params: CreateDictionaryRequest): Promise<CreateDictionaryResponse> {
    return requestClient.post<CreateDictionaryResponse>('/api/admin/dictionary/create-dictionary', params);
  }


  /**
   * 更新字典
   */
  export async function updateDictionaryApi(params: UpdateDictionaryRequest): Promise<UpdateDictionaryResponse> {
    return requestClient.post<UpdateDictionaryResponse>('/api/admin/dictionary/update-dictionary', params);
  }


  /**
   * 删除字典
   */
  export async function deleteDictionaryApi(params: DeleteDictionaryRequest): Promise<DeleteDictionaryResponse> {
    return requestClient.post<DeleteDictionaryResponse>('/api/admin/dictionary/delete-dictionary', params);
  }


  /**
   * 批量启用禁用字典
   */
  export async function batchUpdateDictionaryStatusApi(params: BatchUpdateDictionaryStatusRequest): Promise<BatchUpdateDictionaryStatusResponse> {
    return requestClient.post<BatchUpdateDictionaryStatusResponse>('/api/admin/dictionary/batch-update-dictionary-status', params);
  }


  /**
   * 获取字典项
   */
  export async function dictionaryItemsApi(params: DictionaryItemsRequest): Promise<DictionaryItemsResponse> {
    return requestClient.get<DictionaryItemsResponse>('/api/admin/dictionary/dictionary-items', { params });
  }


  /**
   * 创建字典项
   */
  export async function createDictionaryItemApi(params: CreateDictionaryItemRequest): Promise<CreateDictionaryItemResponse> {
    return requestClient.post<CreateDictionaryItemResponse>('/api/admin/dictionary/create-dictionary-item', params);
  }


  /**
   * 更新字典项
   */
  export async function updateDictionaryItemApi(params: UpdateDictionaryItemRequest): Promise<UpdateDictionaryItemResponse> {
    return requestClient.post<UpdateDictionaryItemResponse>('/api/admin/dictionary/update-dictionary-item', params);
  }


  /**
   * 删除字典项
   */
  export async function deleteDictionaryItemApi(params: DeleteDictionaryItemRequest): Promise<DeleteDictionaryItemResponse> {
    return requestClient.post<DeleteDictionaryItemResponse>('/api/admin/dictionary/delete-dictionary-item', params);
  }


  /**
   * 启用禁用字典项
   */
  export async function updateDictionaryItemStatusApi(params: UpdateDictionaryItemStatusRequest): Promise<UpdateDictionaryItemStatusResponse> {
    return requestClient.post<UpdateDictionaryItemStatusResponse>('/api/admin/dictionary/update-dictionary-item-status', params);
  }
