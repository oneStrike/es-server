## 问题分析

通过分析docker-compose.yml文件和用户反馈，我发现了Redis连接失败的根本原因：

1. **PostgreSQL连接正常**：因为在admin-server和client-server服务中显式设置了`DATABASE_URL`环境变量，其中使用了`${DB_HOST}`作为主机名，而`DB_HOST=postgres`（服务名称），这是Docker Compose网络中正确的通信方式

2. **Redis连接失败**：应用服务输出的Redis连接地址是`redis://:259158@localhost:6379`，这表明应用服务正在尝试连接到`localhost:6379`而不是Redis服务的名称`redis:6379`

3. **Docker Compose网络通信规则**：在Docker Compose网络中，服务之间应该使用服务名称作为主机名进行通信，而不是`localhost`。`localhost`会指向容器内部的回环地址，而不是Docker网络中的其他服务

## 解决方案

确保应用服务使用正确的Redis主机名（服务名称`redis`）而不是`localhost`。我们可以通过在应用服务的环境变量中显式设置`REDIS_HOST`来解决这个问题。

### 修改步骤

1. **编辑docker-compose.yml文件**
2. **为admin-server服务显式设置REDIS_HOST环境变量**：确保它使用服务名称`redis`
3. **为client-server服务显式设置REDIS_HOST环境变量**：确保它使用服务名称`redis`
4. **确保其他Redis相关环境变量也被正确设置**

### 具体修改内容

在admin-server服务的environment部分添加：
```yaml
- REDIS_HOST=${REDIS_HOST}
- REDIS_PORT=${REDIS_PORT}
- REDIS_PASSWORD=${REDIS_PASSWORD}
```

在client-server服务的environment部分添加：
```yaml
- REDIS_HOST=${REDIS_HOST}
- REDIS_PORT=${REDIS_PORT}
- REDIS_PASSWORD=${REDIS_PASSWORD}
```

## 预期效果

修改后，应用服务将使用正确的Redis主机名（服务名称`redis`）来连接Redis服务，而不是使用`localhost`，从而能够成功连接到Redis服务。