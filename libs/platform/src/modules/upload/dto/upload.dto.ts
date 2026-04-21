import { DateProperty } from '@libs/platform/decorators/validate/date-property'
import { NumberProperty } from '@libs/platform/decorators/validate/number-property'
import { StringProperty } from '@libs/platform/decorators/validate/string-property'

export class UploadFileDto {
  @StringProperty({
    description: '上传场景',
    required: false,
    default: 'shared',
    example: 'shared',
  })
  scene?: string
}

export class UploadResponseDto {
  @StringProperty({
    description: '文件名',
    required: true,
    example: 'document_20231107.pdf',
    validation: false,
  })
  filename!: string

  @StringProperty({
    description: '文件路径',
    required: true,
    example: '/files/shared/document/2026-03-28/document_20231107.pdf',
    validation: false,
  })
  filePath!: string

  @StringProperty({
    description: '文件场景',
    required: true,
    example: 'shared',
    validation: false,
  })
  scene!: string

  @NumberProperty({
    description: '文件大小',
    required: true,
    example: 1024000,
    validation: false,
  })
  fileSize!: number

  @StringProperty({
    description: '文件 MIME 类型',
    required: true,
    example: 'application/pdf',
    validation: false,
  })
  mimeType!: string

  @StringProperty({
    description: '文件扩展名',
    required: true,
    example: 'pdf',
    validation: false,
  })
  fileType!: string

  @StringProperty({
    description: '原始文件名',
    required: true,
    example: '原始文档.pdf',
    validation: false,
  })
  originalName!: string

  @DateProperty({
    description: '上传时间',
    required: true,
    example: '2023-11-07T10:30:00.000Z',
    validation: false,
  })
  uploadTime!: Date
}
