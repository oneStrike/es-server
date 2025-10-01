import { requestClient } from '#/utils/request'
import type {
  CreateAuthorRequest,
  CreateAuthorResponse,
  AuthorPageRequest,
  AuthorPageResponse,
  AuthorDetailRequest,
  AuthorDetailResponse,
  UpdateAuthorRequest,
  UpdateAuthorResponse,
  BatchUpdateAuthorStatusRequest,
  BatchUpdateAuthorStatusResponse,
  BatchUpdateAuthorFeaturedRequest,
  BatchUpdateAuthorFeaturedResponse,
  DeleteAuthorRequest,
  DeleteAuthorResponse,
  CreateAuthorDto,
  IdDto,
  AuthorPageResponseDto,
  AuthorDetailResponseDto,
  UpdateAuthorDto,
  BatchEnabledDto,
  CountDto,
  UpdateAuthorFeaturedDto
} from './types/author.d'


  /**
   * 创建作者
   */
  export async function createAuthorApi(params: CreateAuthorRequest): Promise<CreateAuthorResponse> {
    return requestClient.post<CreateAuthorResponse>('/api/admin/work/author/create-author', params);
  }


  /**
   * 分页查询作者列表
   */
  export async function authorPageApi(params: AuthorPageRequest): Promise<AuthorPageResponse> {
    return requestClient.get<AuthorPageResponse>('/api/admin/work/author/author-page', { params });
  }


  /**
   * 获取作者详情
   */
  export async function authorDetailApi(params: AuthorDetailRequest): Promise<AuthorDetailResponse> {
    return requestClient.get<AuthorDetailResponse>('/api/admin/work/author/author-detail', { params });
  }


  /**
   * 更新作者信息
   */
  export async function updateAuthorApi(params: UpdateAuthorRequest): Promise<UpdateAuthorResponse> {
    return requestClient.post<UpdateAuthorResponse>('/api/admin/work/author/update-author', params);
  }


  /**
   * 批量更新作者状态
   */
  export async function batchUpdateAuthorStatusApi(params: BatchUpdateAuthorStatusRequest): Promise<BatchUpdateAuthorStatusResponse> {
    return requestClient.post<BatchUpdateAuthorStatusResponse>('/api/admin/work/author/batch-update-author-status', params);
  }


  /**
   * 批量更新作者推荐状态
   */
  export async function batchUpdateAuthorFeaturedApi(params: BatchUpdateAuthorFeaturedRequest): Promise<BatchUpdateAuthorFeaturedResponse> {
    return requestClient.post<BatchUpdateAuthorFeaturedResponse>('/api/admin/work/author/batch-update-author-featured', params);
  }


  /**
   * 软删除作者
   */
  export async function deleteAuthorApi(params: DeleteAuthorRequest): Promise<DeleteAuthorResponse> {
    return requestClient.post<DeleteAuthorResponse>('/api/admin/work/author/delete-author', params);
  }
