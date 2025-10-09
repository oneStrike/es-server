import { requestClient } from '#/utils/request'
import type {
  CreateContentTypeRequest,
  CreateContentTypeResponse,
  ContentTypePageRequest,
  ContentTypePageResponse,
  UpdateContentTypeRequest,
  UpdateContentTypeResponse,
  CreateContentTypeDto,
  IdDto,
  BaseContentTypeDto,
  UpdateContentTypeDto
} from './types/contentType.d'


  /**
   * 创建内容类型
   */
  export async function createContentTypeApi(params: CreateContentTypeRequest): Promise<CreateContentTypeResponse> {
    return requestClient.post<CreateContentTypeResponse>('/api/admin/work/content-type/create-content-type', params);
  }


  /**
   * 内容类型分页
   */
  export async function contentTypePageApi(params: ContentTypePageRequest): Promise<ContentTypePageResponse> {
    return requestClient.get<ContentTypePageResponse>('/api/admin/work/content-type/content-type-page', { params });
  }


  /**
   * 更新内容类型
   */
  export async function updateContentTypeApi(params: UpdateContentTypeRequest): Promise<UpdateContentTypeResponse> {
    return requestClient.post<UpdateContentTypeResponse>('/api/admin/work/content-type/update-content-type', params);
  }
