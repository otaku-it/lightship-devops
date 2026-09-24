# 轻舟 DevOps 发布平台

基于产品 Demo 落地的轻量级发布平台 MVP。

## 技术栈

- 前端：Vue 3、TypeScript、Vite、Pinia、Vue Router
- 后端：Python 3.11、FastAPI、SQLAlchemy
- 数据库：MySQL 8.4
- 部署：Docker Compose、Nginx

## 已实现

- JWT 登录与管理员初始化
- Java、Frontend、Python、PHP 项目接入，支持文件部署与 Docker 容器部署
- GitHub、GitLab、Gitee 代码托管连接，支持公有云和私有化站点、连接测试、仓库选择与分支识别
- 测试、预发、生产环境管理
- 项目 → 发布环境 → 目标服务器三级发布范围建模
- Agent、SSH、Kubernetes 目标服务器建模
- SSH 部署目标真实连接测试（认证、服务器指纹、只读系统检查）
- 发布单真实执行：Git 拉取、项目构建、制品打包、SFTP 上传、版本软链接切换、重启命令、健康检查和单目标失败回滚
- Docker 真实发布：上传构建上下文、目标机执行 `docker build`、固定容器名更新、端口映射、健康检查和上一镜像回滚
- 发布目标级结果、真实部署路径和实时日志
- Dashboard、项目、环境、发布记录 Vue 页面
- MySQL 初始化与演示数据

默认 Docker Compose 使用 `EXECUTOR_MODE=real`。真实发布目前支持 SSH 目标：必须先填写项目 Git 凭证（私有仓库需要）、配置目标 SSH 密码或私钥，点击“测试真实连接”通过后才能发布。Agent 和 Kubernetes 页面保留了产品入口，但真实执行器尚未接入，发布时会明确跳过并失败，不会伪造成功。

如果只想演示页面流程，可手动把 `EXECUTOR_MODE` 改成 `mock`；模拟发布会明确显示“仅模拟完成，未操作服务器”。

真实发布链路：

1. 项目：配置 HTTP/HTTPS Git 仓库并选择部署方式。文件模式配置构建命令和制品路径；Docker 模式配置 Dockerfile、容器端口、镜像名称和运行参数。私有仓库保存加密 Git Token。
2. 发布环境：选择目标所属项目和测试/预发/生产环境，再新增 SSH 服务器，配置地址、SSH 端口、登录用户、密码或私钥、应用端口、部署目录、启动命令和健康检查命令。同一环境中其他项目的服务器不会被选入本次发布。
3. 连接：首次测试可固定 SHA-256 服务器指纹，后续指纹变化会拒绝连接。
4. 发布：平台在构建节点拉取和构建，打包后通过 SFTP 上传到 `/opt/apps/{project}/releases/{version}`，切换 `current` 软链接，执行启动/重启与健康检查；失败时回滚该目标上一版本。

Docker 发布链路：

1. 目标服务器安装 Docker，SSH 用户需要能直接执行 `docker info`。
2. 平台拉取 Git 仓库并上传 Docker 构建上下文到目标服务器。
3. 目标服务器执行 `docker build`，镜像标签格式为 `<镜像名>:<版本>-<发布单号>`。
4. 平台用固定容器名替换旧容器，自动配置 `--restart unless-stopped` 和宿主机/容器端口映射。
5. 健康检查失败时移除新容器，并使用上一镜像恢复容器。

PHP 文件部署会在构建节点执行 Composer 依赖安装，默认发布整个应用目录（包含 `vendor`）；PHP-FPM、Nginx、MySQL、Redis 等组合工程建议使用 Docker Compose，并在仓库中提供 `docker-compose.yml`。

## 接入代码托管平台

进入“代码托管”页面，新建 GitHub、GitLab 或 Gitee 连接：

1. 填写平台地址。公有云使用默认地址，私有 GitLab 或 GitHub Enterprise 填写站点根地址。
2. 填写 Personal Access Token。GitHub 建议具备 `repo` 读取权限；GitLab 至少需要 `read_api`、`read_repository`；Gitee 需要项目读取权限。
3. 保存后点击“测试连接”，平台会验证令牌并识别授权账号。
4. 接入项目时选择“从托管平台选择”，即可搜索仓库、自动带入 HTTPS Clone 地址和默认分支。

平台管理员可以为每条连接勾选可见角色。未授权角色不会在菜单和连接列表中看到该连接，也不能调用仓库列表、分支识别或项目绑定接口。连接的新建、编辑、测试和删除仅平台管理员可操作。

访问令牌经过 Fernet 加密后存入 MySQL，不会通过查询接口返回前端。发布任务拉取代码时优先使用项目绑定的托管连接；原有的手工 Git 地址和项目独立凭证仍然兼容。

## 一键启动

```bash
docker compose up --build
```

启动后访问：

- Web：http://localhost:8088
- API 文档：http://localhost:8000/docs
- 健康检查：http://localhost:8000/health
- MySQL：Compose 内部通过 `mysql:3306` 访问；宿主机通过 `127.0.0.1:3308` 访问

初始账号：

```text
用户名：admin
密码：change-me-now
```

首次登录后请更换默认密码，并在生产环境修改 `SECRET_KEY` 和数据库密码。

## 本地开发

后端：

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
cp .env.example .env
uvicorn app.main:app --reload
```

前端：

```bash
cd frontend
npm install
npm run dev
```

## 生产化待办

1. 用 Vault/KMS 替换应用内 Fernet 加密密钥，数据库只保存凭证引用。
2. 增加制品签名验证、制品仓库和构建缓存。
3. 对启动/健康检查命令使用服务端模板白名单，禁止任意 Shell。
4. 将后台任务从 FastAPI `BackgroundTasks` 迁移到 Celery/RQ，并增加任务取消、重试和并发控制。
5. 接入 Agent 双向认证、心跳和任务签名。
6. 增加 Kubernetes Deployment/Helm 执行器和多实例滚动策略。
