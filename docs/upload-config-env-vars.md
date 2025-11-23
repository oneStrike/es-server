# 文件上传配置环境变量文档

本文档详细列出了 `upload.config.ts` 文件中使用的所有环境变量及其具体含义。

## 核心配置环境变量

### 1. UPLOAD_MAX_FILE_SIZE
- **类型**: 数字（字节）
- **默认值**: `104857600` (100MB)
- **含义**: 允许上传的单个文件的最大大小
- **使用场景**: 限制用户上传的文件大小，防止过大文件占用过多服务器资源
- **注意事项**: 若设置的值不是有效数字或小于等于0，则使用默认值

### 2. UPLOAD_MAX_FILES
- **类型**: 数字
- **默认值**: `50`
- **含义**: 单次允许上传的文件数量上限
- **使用场景**: 限制批量上传的文件数量，控制并发上传负载
- **注意事项**: 若设置的值不是有效数字或小于等于0，则使用默认值

### 3. UPLOAD_DIR
- **类型**: 字符串（路径）
- **默认值**: 
  - Docker环境: `/app/uploads`
  - 非Docker环境: `{APP_DATA_DIR}/uploads` 或 `uploads`
- **含义**: 文件上传的目标目录
- **使用场景**: 自定义文件存储位置
- **注意事项**: 路径可以是相对路径或绝对路径，取决于UPLOAD_ABSOLUTE_PATH设置

### 4. APP_DATA_DIR
- **类型**: 字符串（路径）
- **默认值**: 无（可选）
- **含义**: 应用数据目录，用于构建默认的上传路径
- **使用场景**: 当未设置UPLOAD_DIR时，可通过此环境变量指定应用数据目录，上传目录将自动设置为其子目录

### 5. UPLOAD_ABSOLUTE_PATH
- **类型**: 布尔值（字符串形式）
- **默认值**: `false`
- **含义**: 指示UPLOAD_DIR是否为绝对路径
- **使用场景**: 当设置为'true'时，UPLOAD_DIR将被视为绝对路径，否则会根据需要转换为绝对路径

### 6. UPLOAD_PRESERVE_ORIGINAL_NAME
- **类型**: 布尔值（字符串形式）
- **默认值**: `true`
- **含义**: 是否保留上传文件的原始文件名
- **使用场景**: 控制文件命名策略，设为true时保留原始名称相关信息
- **接受值**: 'true', '1', 'yes'（不区分大小写）将被解析为true，其他值为false

### 7. UPLOAD_FILENAME_STRATEGY
- **类型**: 字符串
- **默认值**: `uuid`
- **含义**: 文件名生成策略
- **可选值**: 
  - `uuid`: 仅使用UUID生成文件名
  - `uuid_original`: 使用UUID + 原始文件名
  - `hash`: 使用哈希值生成文件名
  - `hash_original`: 使用哈希值 + 原始文件名
- **使用场景**: 根据安全和可识别性需求选择不同的文件命名方式

## 文件类型相关环境变量

### 图片类型配置

#### UPLOAD_IMAGE_MIME_TYPES
- **类型**: 字符串（逗号分隔的MIME类型列表）
- **默认值**: 包含常见图片格式
- **含义**: 允许上传的图片MIME类型
- **默认包含**: image/jpeg, image/png, image/gif, image/webp, image/svg+xml等
- **使用场景**: 自定义允许上传的图片格式

#### UPLOAD_IMAGE_EXTENSIONS
- **类型**: 字符串（逗号分隔的扩展名列表）
- **默认值**: 包含常见图片扩展名
- **含义**: 允许上传的图片文件扩展名
- **默认包含**: .jpg, .jpeg, .png, .gif, .webp, .svg等
- **使用场景**: 自定义允许上传的图片文件扩展名

### 音频类型配置

#### UPLOAD_AUDIO_MIME_TYPES
- **类型**: 字符串（逗号分隔的MIME类型列表）
- **默认值**: 包含常见音频格式
- **含义**: 允许上传的音频MIME类型
- **默认包含**: audio/mpeg, audio/wav, audio/ogg, audio/flac, audio/aac等
- **使用场景**: 自定义允许上传的音频格式

#### UPLOAD_AUDIO_EXTENSIONS
- **类型**: 字符串（逗号分隔的扩展名列表）
- **默认值**: 包含常见音频扩展名
- **含义**: 允许上传的音频文件扩展名
- **默认包含**: .mp3, .wav, .ogg, .flac, .aac, .m4a等
- **使用场景**: 自定义允许上传的音频文件扩展名

### 视频类型配置

#### UPLOAD_VIDEO_MIME_TYPES
- **类型**: 字符串（逗号分隔的MIME类型列表）
- **默认值**: 包含常见视频格式
- **含义**: 允许上传的视频MIME类型
- **默认包含**: video/mp4, video/quicktime, video/x-msvideo, video/x-flv, video/webm等
- **使用场景**: 自定义允许上传的视频格式

#### UPLOAD_VIDEO_EXTENSIONS
- **类型**: 字符串（逗号分隔的扩展名列表）
- **默认值**: 包含常见视频扩展名
- **含义**: 允许上传的视频文件扩展名
- **默认包含**: .mp4, .mov, .avi, .flv, .ogv, .webm等
- **使用场景**: 自定义允许上传的视频文件扩展名

### 文档类型配置

#### UPLOAD_DOCUMENT_MIME_TYPES
- **类型**: 字符串（逗号分隔的MIME类型列表）
- **默认值**: 包含常见文档格式
- **含义**: 允许上传的文档MIME类型
- **默认包含**: application/pdf, text/plain, Microsoft Office格式, OpenDocument格式等
- **使用场景**: 自定义允许上传的文档格式

#### UPLOAD_DOCUMENT_EXTENSIONS
- **类型**: 字符串（逗号分隔的扩展名列表）
- **默认值**: 包含常见文档扩展名
- **含义**: 允许上传的文档文件扩展名
- **默认包含**: .pdf, .txt, .doc, .docx, .xls, .xlsx, .ppt, .pptx, .odt等
- **使用场景**: 自定义允许上传的文档文件扩展名

### 压缩包类型配置

#### UPLOAD_ARCHIVE_MIME_TYPES
- **类型**: 字符串（逗号分隔的MIME类型列表）
- **默认值**: 包含常见压缩包格式
- **含义**: 允许上传的压缩包MIME类型
- **默认包含**: application/zip, application/x-rar-compressed, application/x-7z-compressed等
- **使用场景**: 自定义允许上传的压缩包格式

#### UPLOAD_ARCHIVE_EXTENSIONS
- **类型**: 字符串（逗号分隔的扩展名列表）
- **默认值**: 包含常见压缩包扩展名
- **含义**: 允许上传的压缩包文件扩展名
- **默认包含**: .zip, .rar, .7z, .gz, .tar
- **使用场景**: 自定义允许上传的压缩包文件扩展名

## Docker相关环境变量

### DOCKER
- **类型**: 布尔值（字符串形式）
- **默认值**: 无（自动检测）
- **含义**: 显式指定是否在Docker环境中运行
- **使用场景**: 手动控制Docker环境检测
- **检测机制**: 除了此环境变量外，系统还会通过检查工作目录是否为'/app'或是否存在'/.dockerenv'文件来自动判断

## 使用示例

以下是一个典型的环境变量配置示例：

```dotenv
# 核心配置
UPLOAD_MAX_FILE_SIZE=52428800    # 50MB
UPLOAD_MAX_FILES=20
UPLOAD_DIR=./custom_uploads
UPLOAD_ABSOLUTE_PATH=false
UPLOAD_PRESERVE_ORIGINAL_NAME=true
UPLOAD_FILENAME_STRATEGY=uuid_original

# 自定义图片类型
UPLOAD_IMAGE_MIME_TYPES=image/jpeg,image/png,image/webp
UPLOAD_IMAGE_EXTENSIONS=.jpg,.jpeg,.png,.webp

# 自定义文档类型
UPLOAD_DOCUMENT_MIME_TYPES=application/pdf,text/plain
UPLOAD_DOCUMENT_EXTENSIONS=.pdf,.txt
```

## 注意事项

1. 所有文件类型相关的环境变量（MIME类型和扩展名）在配置时，多个值之间使用逗号分隔
2. 扩展名配置必须以点（.）开头
3. 环境变量配置会覆盖默认值，但不会与默认值合并
4. 对于Docker环境，默认上传路径会自动设置为`/app/uploads`