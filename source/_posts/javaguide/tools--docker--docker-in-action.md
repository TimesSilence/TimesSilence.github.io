---
title: "Docker 实战"
date: 2023-01-10 10:54:00
updated: 2023-01-10 10:54:00
permalink: knowledge/tools/docker/docker-in-action/
categories:
  - 开发工具
tags:
  - 开发工具
description: "Docker 实战指南：按起服务、排查问题、清理环境三类场景组织常用命令，用 docker compose 编排多服务，并给出 Java 应用容器化的完整示例。"
---

概念再熟，不动手跑一遍等于没学。本文按真实工作场景组织 Docker 常用命令：起服务、排查问题、清理环境，再用 docker compose 编排一个多服务应用，最后走完一个 Java 应用容器化的完整流程。

<!-- more -->

## 场景一：起服务

本地开发最常见的需求是快速拉起一个 MySQL 或 Redis。以 MySQL 8 为例：

```bash
docker run -d \
  --name mysql8 \
  -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=root123 \
  -e MYSQL_DATABASE=demo \
  -v mysql-data:/var/lib/mysql \
  mysql:8.0
```

逐参数拆解：`-d` 后台运行；`--name` 起个名字方便管理；`-p 3306:3306` 把宿主机端口映射到容器端口；`-e` 注入环境变量；`-v mysql-data:/var/lib/mysql` 用命名卷保存数据，容器删了数据还在。Redis 更简单：`docker run -d --name redis -p 6379:6379 redis:7`。

镜像相关：`docker pull nginx:1.25` 拉取镜像，`docker images` 看本地镜像，`docker ps` 看运行中的容器（加 `-a` 包括已停止的），`docker stop mysql8` / `docker start mysql8` 控制启停。

## 场景二：排查问题

容器行为不符合预期时，按「看状态 → 看日志 → 进容器」的顺序查：

```bash
# 看日志，-f 持续跟踪，--tail 只看末尾
docker logs -f --tail 100 mysql8

# 进容器开个 shell 现场检查
docker exec -it mysql8 bash

# 看容器的完整配置（端口、挂载、环境变量、网络）
docker inspect mysql8

# 看资源占用
docker stats
```

进程退出导致容器挂掉时，`docker ps -a` 看到 `Exited (1)` 状态，先用 `docker logs` 找报错；想以交互方式调试一个启动即退出的镜像，可以用 `docker run -it --entrypoint bash 镜像名` 覆盖入口命令。

宿主机与容器之间拷文件用 `docker cp`：`docker cp mysql8:/var/log/mysql/error.log ./` 把容器里的日志拷出来分析。

## 场景三：清理环境

Docker 用久了磁盘会被镜像和停止的容器吃光：

```bash
# 删除已停止的容器、悬空镜像、未用网络（安全，先跑这个）
docker system prune

# 更彻底：连未使用的镜像和构建缓存一起清
docker system prune -a

# 删指定容器/镜像
docker rm mysql8
docker rmi mysql:8.0
```

`docker system df` 可以看各类资源占了多少磁盘，清理前先心中有数。

## docker compose：编排多服务

一个应用通常要应用 + MySQL + Redis 三件套，挨个 `docker run` 既繁琐又难复现。compose 用一份 YAML 描述整个服务栈：

```yaml
services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      SPRING_DATASOURCE_URL: jdbc:mysql://mysql:3306/demo
      SPRING_DATA_REDIS_HOST: redis
    depends_on:
      - mysql
      - redis

  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: root123
      MYSQL_DATABASE: demo
    volumes:
      - mysql-data:/var/lib/mysql

  redis:
    image: redis:7

volumes:
  mysql-data:
```

`docker compose up -d` 一键拉起全部服务，`docker compose logs -f app` 看日志，`docker compose down` 整体停止并删除容器（加 `-v` 连卷一起删）。同一 compose 内的服务在同一个网络里，直接用服务名互相访问——上面 JDBC URL 里的 `mysql` 就是服务名，不是 localhost。

## Java 应用容器化完整示例

以一个 Spring Boot 项目为例，目标是打出可运行的镜像。

第一步，项目根目录写 `Dockerfile`（多阶段构建）：

```dockerfile
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline
COPY src ./src
RUN mvn package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

第二步，加 `.dockerignore` 排除无关文件，加快构建、避免泄漏：

```bash
target/
.git/
*.log
.idea/
```

第三步，构建并运行：

```bash
docker build -t demo-app:1.0 .
docker run -d --name demo -p 8080:8080 demo-app:1.0
curl http://localhost:8080/actuator/health
```

注意容器内应用必须监听 `0.0.0.0`（Spring Boot 默认就是），只监听 `127.0.0.1` 会导致端口映射后依然访问不通。验证通过后，把服务接入前面的 compose 文件，整个本地环境就实现了一键复现。

## 小结

- 日常命令按场景记：起服务用 `docker run`（端口、环境变量、数据卷三件套），排查用 `logs` / `exec` / `inspect` / `stats`，清理由轻到重用 `system prune`。
- 多服务用 docker compose 声明式编排，服务名即域名。
- Java 应用容器化 = 多阶段 Dockerfile + .dockerignore + 监听 0.0.0.0，构建后接 compose 即得完整本地环境。