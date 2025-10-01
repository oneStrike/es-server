import { requestClient } from '#/utils/request'
import type {
  CreateCategoryRequest,
  CreateCategoryResponse,
  CategoryPageRequest,
  CategoryPageResponse,
  CategoryDetailRequest,
  CategoryDetailResponse,
  UpdateCategoryRequest,
  UpdateCategoryResponse,
  BatchUpdateCategoryStatusRequest,
  BatchUpdateCategoryStatusResponse,
  CategoryOrderRequest,
  CategoryOrderResponse,
  BatchDeleteCategoryRequest,
  BatchDeleteCategoryResponse,
  CreateCategoryDto,
  IdDto,
  BaseCategoryDto,
  UpdateCategoryDto,
  BatchEnabledDto,
  CountDto,
  OrderDto,
  IdsDto
} from './types/category.d'


  /**
   * 创建分类
   */
  export async function createCategoryApi(params: CreateCategoryRequest): Promise<CreateCategoryResponse> {
    return requestClient.post<CreateCategoryResponse>('/api/admin/work/category/create-category', params);
  }


  /**
   * 分页查询分类列表
   */
  export async function categoryPageApi(params: CategoryPageRequest): Promise<CategoryPageResponse> {
    return requestClient.get<CategoryPageResponse>('/api/admin/work/category/category-page', { params });
  }


  /**
   * 获取分类详情
   */
  export async function categoryDetailApi(params: CategoryDetailRequest): Promise<CategoryDetailResponse> {
    return requestClient.get<CategoryDetailResponse>('/api/admin/work/category/category-detail', { params });
  }


  /**
   * 更新分类信息
   */
  export async function updateCategoryApi(params: UpdateCategoryRequest): Promise<UpdateCategoryResponse> {
    return requestClient.post<UpdateCategoryResponse>('/api/admin/work/category/update-category', params);
  }


  /**
   * 批量更新分类状态
   */
  export async function batchUpdateCategoryStatusApi(params: BatchUpdateCategoryStatusRequest): Promise<BatchUpdateCategoryStatusResponse> {
    return requestClient.post<BatchUpdateCategoryStatusResponse>('/api/admin/work/category/batch-update-category-status', params);
  }


  /**
   * 分类拖拽排序
   */
  export async function categoryOrderApi(params: CategoryOrderRequest): Promise<CategoryOrderResponse> {
    return requestClient.post<CategoryOrderResponse>('/api/admin/work/category/category-order', params);
  }


  /**
   * 批量删除分类
   */
  export async function batchDeleteCategoryApi(params: BatchDeleteCategoryRequest): Promise<BatchDeleteCategoryResponse> {
    return requestClient.post<BatchDeleteCategoryResponse>('/api/admin/work/category/batch-delete-category', params);
  }
