# 上传与文件名策略

本项目的上传目录在 Docker 中固定为 `/app/uploads`（通过 Compose 将宿主机目录挂载至该路径）。应用启动时会确保该目录存在。

## 文件名生成策略

可通过环境变量 `UPLOAD_FILENAME_STRATEGY` 配置文件名生成方式：

- `uuid`（默认）：`<uuid><ext>`，示例 `a3f2...-b1c9.jpg`
- `uuid_original`: `<sanitized-base>-<short-uuid><ext>`，示例 `report-2024-7fd3.pdf`
- `hash`: `<md5><ext>`，示例 `d41d8cd98f00b204e9800998ecf8427e.png`
- `hash_original`: `<sanitized-base>-<md5-8><ext>`，示例 `avatar-1a2b3c4d.jpg`

说明：
- `sanitized-base` 为原始文件名（去扩展名）清洗后的安全基名，仅允许 `[a-z0-9._-]`，最多 32 字符。
- 冲突处理：若生成的最终文件名已存在，将自动在末尾追加短随机后缀，避免覆盖。

## 安全与校验

- MIME/扩展名校验：扩展名需与 MIME 所属类别一致（图片、音频、视频、文档、压缩包）。
- 魔数（二次检测）：对常见类型进行文件头签名校验（PNG/JPEG/GIF/WEBP、PDF、ZIP/OOXML、GZIP、MP4、OGG、WebM），防止伪造 Content-Type。
- 流式写入：大文件采用 Node.js 流式管道处理，实时监控大小，超过限制立即中断并清理残留。

## 环境变量（示例）

```
UPLOAD_MAX_FILE_SIZE=104857600   # 100MB
UPLOAD_MAX_FILES=50
UPLOAD_FILENAME_STRATEGY=uuid_original
UPLOAD_PRESERVE_ORIGINAL_NAME=true
```

## Compose 与权限

- 服务以非 root 用户运行（UID/GID `1001:1001`）。
- 宿主机需预创建目录并赋权，例如 Linux：
  ```bash
  sudo mkdir -p /srv/es/uploads
  sudo chown -R 1001:1001 /srv/es/uploads
  sudo chmod 775 /srv/es/uploads
  ```

## 静态访问

- 静态前缀：`/uploads/`，禁止目录索引与隐藏文件访问，启用缓存相关响应头。