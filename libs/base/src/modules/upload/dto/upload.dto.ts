import { DateProperty, NumberProperty, StringProperty } from '@libs/base/decorators'

export class FileUploadResponseDto {
  @StringProperty({
    description: '文件名',
    example: 'avatar.jpg',
    required: true,
    maxLength: 255,
    validation: false,
  })
  filename: string

  @StringProperty({
    description: '原始文件名',
    example: 'avatar.jpg',
    required: true,
    maxLength: 255,
    validation: false,
  })
  originalName: string

  @StringProperty({
    description: '文件路径',
    example: '/uploads/avatar.jpg',
    required: true,
    maxLength: 500,
    validation: false,
  })
  filePath: string

  @NumberProperty({
    description: '文件大小',
    example: 1024,
    required: true,
    validation: false,
  })
  fileSize: number

  @StringProperty({
    description: 'MIME 类型',
    example: 'image/jpeg',
    required: true,
    maxLength: 255,
    validation: false,
  })
  mimeType: string

  @StringProperty({
    description: '文件类型',
    example: 'image',
    required: true,
    maxLength: 255,
    validation: false,
  })
  fileType: string

  @StringProperty({
    description: '场景',
    example: 'avatar',
    required: true,
    maxLength: 255,
    validation: false,
  })
  scene: string

  @DateProperty({
    description: '上传时间',
    example: '2023-01-01T00:00:00.000Z',
    required: true,
    validation: false,
  })
  uploadTime: Date
}
