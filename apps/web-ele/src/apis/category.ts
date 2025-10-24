import { requestClient } from '#/utils/request';
import type {
  CategoryCreateRequest,
  CategoryCreateResponse,
  CategoryPageRequest,
  CategoryPageResponse,
  CategoryDetailRequest,
  CategoryDetailResponse,
  CategoryUpdateRequest,
  CategoryUpdateResponse,
  CategoryBatchUpdateStatusRequest,
  CategoryBatchUpdateStatusResponse,
  CategoryBatchDeleteRequest,
  CategoryBatchDeleteResponse,
  CategoryOrderRequest,
  CategoryOrderResponse,
  CreateCategoryDto,
  IdDto,
  BaseCategoryDto,
  CategoryContentTypeItemDto,
  BaseContentTypeDto,
  UpdateCategoryDto,
  BatchEnabledDto,
  CountDto,
  IdsDto,
  OrderDto,
} from './types/category.d';

/**
 * 创建分类
 */
export async function categoryCreateApi(
  params: CategoryCreateRequest,
): Promise<CategoryCreateResponse> {
  return requestClient.post<CategoryCreateResponse>(
    '/api/admin/work/category/create',
    params,
  );
}

/**
 * 分页查询分类列表
 */
export async function categoryPageApi(
  params?: CategoryPageRequest,
): Promise<CategoryPageResponse> {
  return requestClient.get<CategoryPageResponse>(
    '/api/admin/work/category/page',
    { params },
  );
}

/**
 * 获取分类详情
 */
export async function categoryDetailApi(
  params: CategoryDetailRequest,
): Promise<CategoryDetailResponse> {
  return requestClient.get<CategoryDetailResponse>(
    '/api/admin/work/category/detail',
    { params },
  );
}

/**
 * 更新分类信息
 */
export async function categoryUpdateApi(
  params: CategoryUpdateRequest,
): Promise<CategoryUpdateResponse> {
  return requestClient.post<CategoryUpdateResponse>(
    '/api/admin/work/category/update',
    params,
  );
}

/**
 * 批量更新分类状态
 */
export async function categoryBatchUpdateStatusApi(
  params: CategoryBatchUpdateStatusRequest,
): Promise<CategoryBatchUpdateStatusResponse> {
  return requestClient.post<CategoryBatchUpdateStatusResponse>(
    '/api/admin/work/category/batch-update-status',
    params,
  );
}

/**
 * 批量删除分类
 */
export async function categoryBatchDeleteApi(
  params: CategoryBatchDeleteRequest,
): Promise<CategoryBatchDeleteResponse> {
  return requestClient.post<CategoryBatchDeleteResponse>(
    '/api/admin/work/category/batch-delete',
    params,
  );
}

/**
 * 分类拖拽排序
 */
export async function categoryOrderApi(
  params: CategoryOrderRequest,
): Promise<CategoryOrderResponse> {
  return requestClient.post<CategoryOrderResponse>(
    '/api/admin/work/category/order',
    params,
  );
}
