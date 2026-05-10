# 10. 部署与 Runtime 设计

## 文档状态

**状态**：占位草案  
**范围**：Docker、环境变量、runtime 目录、开发/生产启动方式  
**当前约定**：部署目标为 Docker，初版保留 API、worker、scheduler、web 多入口

## 后续需要讨论的问题

1. Docker Compose 初版包含哪些服务？
2. API、worker、scheduler 是否共用同一个 Python 镜像？
3. `runtime/plugins`、`runtime/config`、`runtime/data` 如何挂载？
4. `.env`、本地配置、敏感配置如何分层？
5. 开发环境是否直接用 uv/bun，生产环境用 Docker？
6. 数据库 migration 由哪个容器执行？
7. 日志输出到 stdout、文件，还是两者都要？
8. 后续 Redis Event Bus 如何接入？

## 暂不决策

- 具体 Dockerfile。
- 生产环境编排方式。
- Secret Manager。
- 监控告警方案。
