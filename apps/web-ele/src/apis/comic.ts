import { requestClient } from '#/utils/request'
import type {
  ComicPageRequest,
  ComicPageResponse,
  CreateComicRequest,
  CreateComicResponse,
  ComicDetailRequest,
  ComicDetailResponse,
  UpdateComicRequest,
  UpdateComicResponse,
  BatchUpdateComicStatusRequest,
  BatchUpdateComicStatusResponse,
  BatchUpdateComicRecommendedRequest,
  BatchUpdateComicRecommendedResponse,
  BatchUpdateComicHotRequest,
  BatchUpdateComicHotResponse,
  BatchUpdateComicNewRequest,
  BatchUpdateComicNewResponse,
  DeleteComicRequest,
  DeleteComicResponse,
  BaseComicDto,
  ComicCategoryDto,
  ComicAuthorDto,
  CreateComicDto,
  IdDto,
  UpdateComicDto,
  UpdateComicStatusDto,
  CountDto,
  UpdateComicRecommendedDto,
  UpdateComicHotDto,
  UpdateComicNewDto
} from './types/comic.d'


  /**
   * 分页查询漫画列表
   */
  export async function comicPageApi(params: ComicPageRequest): Promise<ComicPageResponse> {
    return requestClient.get<ComicPageResponse>('/api/admin/work/comic/comic-page', { params });
  }


  /**
   * 创建漫画
   */
  export async function createComicApi(params: CreateComicRequest): Promise<CreateComicResponse> {
    return requestClient.post<CreateComicResponse>('/api/admin/work/comic/create-comic', params);
  }


  /**
   * 获取漫画详情
   */
  export async function comicDetailApi(params: ComicDetailRequest): Promise<ComicDetailResponse> {
    return requestClient.get<ComicDetailResponse>('/api/admin/work/comic/comic-detail', { params });
  }


  /**
   * 更新漫画信息
   */
  export async function updateComicApi(params: UpdateComicRequest): Promise<UpdateComicResponse> {
    return requestClient.post<UpdateComicResponse>('/api/admin/work/comic/update-comic', params);
  }


  /**
   * 批量更新漫画发布状态
   */
  export async function batchUpdateComicStatusApi(params: BatchUpdateComicStatusRequest): Promise<BatchUpdateComicStatusResponse> {
    return requestClient.post<BatchUpdateComicStatusResponse>('/api/admin/work/comic/batch-update-comic-status', params);
  }


  /**
   * 批量更新漫画推荐状态
   */
  export async function batchUpdateComicRecommendedApi(params: BatchUpdateComicRecommendedRequest): Promise<BatchUpdateComicRecommendedResponse> {
    return requestClient.post<BatchUpdateComicRecommendedResponse>('/api/admin/work/comic/batch-update-comic-recommended', params);
  }


  /**
   * 批量更新漫画热门状态
   */
  export async function batchUpdateComicHotApi(params: BatchUpdateComicHotRequest): Promise<BatchUpdateComicHotResponse> {
    return requestClient.post<BatchUpdateComicHotResponse>('/api/admin/work/comic/batch-update-comic-hot', params);
  }


  /**
   * 批量更新漫画新作状态
   */
  export async function batchUpdateComicNewApi(params: BatchUpdateComicNewRequest): Promise<BatchUpdateComicNewResponse> {
    return requestClient.post<BatchUpdateComicNewResponse>('/api/admin/work/comic/batch-update-comic-new', params);
  }


  /**
   * 软删除漫画
   */
  export async function deleteComicApi(params: DeleteComicRequest): Promise<DeleteComicResponse> {
    return requestClient.post<DeleteComicResponse>('/api/admin/work/comic/delete-comic', params);
  }
