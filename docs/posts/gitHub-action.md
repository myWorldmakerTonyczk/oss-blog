---
title: GitHub Actions学习记录
date: 2026-07-01
author: myWorldmakerTonyczk
---

# GitHub Actions学习记录

## 什么是GitHub Actions？

GitHub Actions 是运行在 GitHub 云端服务器上的自动化工作流，可以监听仓库中的**各种事件**，并自动执行预先定义好的**任务**。

## 文件格式
首先至少记得 GitHub Actions 的文件格式是 YAML，文件路径为 `.github/workflows/main.yml`。
注意：文件名可以随意，如 `czk.yml`，只要后缀名为 `.yml` 即可。

## 踩坑实录：从零开始一步步试错

学习的最好方式就是动手试。我新建了一个空文件 `.github/workflows/czk.yml`，push 上去，然后盯着 Actions 面板看报错——**缺什么就加什么**，直到跑通为止。

### 第一回合：空文件 → `on`

空文件 push 上去，Actions 直接报错：

> **Error: No event triggers defined in `on`**

原来 workflow 文件里必须声明**什么时候运行**。好，加上 `on`：

```yaml
on:
  push:
    branches: [main]
```

### 第二回合：有 `on` 没 `jobs` → 继续报错

加上 `on` 后 push，又红了：

> **Invalid workflow file: .github/workflows/czk.yml#L1**
> **(Line: 1, Col: 1): Required property is missing: jobs**

有了"什么时候"，还得有"干什么"。加上 `jobs`：

```yaml
on:
  push:
    branches: [main]

jobs:
  job1:
  job2:
```

### 第三回合：有 `jobs` 但缺 `runs-on` 和正确的 `steps`

满怀信心 push，结果报错更详细了：

> **(Line: 6, Col: 11): Unexpected value 'run:pwd'**
> **(Line: 7, Col: 11): Unexpected value 'run:ls'**
> **(Line: 5, Col: 9): Required property is missing: runs-on**
> **(Line: 9, Col: 9): Required property is missing: runs-on**

这里暴露了三个问题：

1. **`run:pwd` 写法错误**——YAML 中冒号后面必须有空格，应该是 `run: pwd`
2. **每个 job 必须指定 `runs-on`**——告诉 GitHub 在什么操作系统上跑
3. **`run` 命令要放在 `steps` 下面**，不能直接挂在 job 上

修正后：

```yaml
on:
  push:
    branches: [main]

jobs:
  job1:
    runs-on: ubuntu-latest
    steps:
      - run: pwd
      - run: ls

  job2:
    runs-on: ubuntu-latest
    steps:
      - run: echo "hello github actions!"
```

终于一片绿色 ✅，workflow 能跑了！

---

### 第四回合：能跑了，但代码在哪？

workflow 跑通了，但 `pwd` 输出的是 `/home/runner/work/<repo>/<repo>`，`ls` 列出来却是空的——根本看不到我的项目代码。

原来 **GitHub Actions 给你的是一台空白虚拟机**，需要你主动把代码"拉"进来。这就要用到别人写好的 action——`actions/checkout`：

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4    # 拉取仓库代码
      - run: ls
```

push 后 `ls` 终于能看到自己的文件了。

这里引出了一个新概念：**`uses` vs `run`**——`run` 是直接在虚拟机上敲命令，`uses` 是引用别人写好的现成模块（来自 GitHub Marketplace）。

### 第五回合：我要构建 VitePress，Node 呢？

代码有了，下一步是 `npm run docs:build`。直接加上：

```yaml
steps:
  - uses: actions/checkout@v4
  - run: npm run docs:build
```

push 后报错：

> **npm: command not found**

又是新问题——这台 Ubuntu 虚拟机里**没有 Node.js**。需要先安装，于是请出 `actions/setup-node`：

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with:
      node-version: 20
  - run: npm run docs:build
```

又红了：

> **npm error code EUSAGE**
> **npm error `npm ci` can only install with an existing package-lock.json**

原来 `npm run docs:build` 只是运行构建脚本，构建依赖的包还没装呢！得先在构建前加上 `npm ci` 安装依赖。而且 `setup-node` 已经支持缓存，顺手加上：

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with:
      node-version: 20
      cache: npm                  # 缓存依赖，下次构建更快
  - run: npm ci                   # 严格按 lock 文件安装
  - run: npm run docs:build
```

这里学到：`with` 是给 action **传参数**的方式，不同 action 支持的参数不同，要查文档。`npm ci` 比 `npm install` 更适合 CI 环境——它严格按 `package-lock.json` 安装，不会擅自改 lock 文件，速度也更快。

构建终于通过了！✅

### 第六回合：构建产物有了，但怎么部署？

构建成功了，但没有任何部署动作。我想把 `docs/.vitepress/dist` 部署到 GitHub Pages。搜了一圈发现需要两步：

1. **上传构建产物**（让 GitHub 保存起来）
2. **部署到 Pages**（从产物发布出去）

先加上传：

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with:
      node-version: 20
      cache: npm
  - run: npm ci
  - run: npm run docs:build
  - uses: actions/upload-pages-artifact@v3
    with:
      path: docs/.vitepress/dist
```

push 后报错：

> **Error: Error: Request failed with status code 403 (Forbidden)**

没有权限！GitHub 默认权限很保守，需要**显式声明**你需要什么权限：

```yaml
permissions:
  contents: read           # 读取仓库代码
  pages: write             # 写入 GitHub Pages
  id-token: write          # OIDC 认证（部署到 Pages 需要）
```

加上后，上传成功了！产物出现在了 Actions 的 Artifacts 里。

这里明白了一个道理：**最小权限原则**——默认情况下 Actions 能做的不多，你要什么权限就声明什么，安全又清晰。

### 第七回合：加 deploy job，它跑得比 build 还快

加上部署 job：

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run docs:build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: docs/.vitepress/dist

  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/deploy-pages@v4
```

push 后 deploy 秒红：

> **Error: Error: No artifact found to deploy. Ensure an artifact was uploaded first.**

原来 **多个 job 默认是并行执行的**！build 还在慢慢装依赖，deploy 已经跑完了——这时候产物还没上传呢，deploy 当然找不到。

解决方案是用 `needs` 让 deploy **等** build 完成：

```yaml
  deploy:
    needs: build          # 等 build 跑完再执行
    runs-on: ubuntu-latest
    steps:
      - uses: actions/deploy-pages@v4
```

push，deploy 终于等 build 完成才启动，部署成功！

### 第八回合：快速连推两次，部署冲突了

兴奋地连改两篇博客，快速 push 了两次，结果第二次的 deploy 报错：

> **Error: Error: Failed to create deployment. A deployment is already in progress.**

两个 workflow 实例在**同时部署**，互相冲突。需要加并发控制：

```yaml
concurrency:
  group: pages
  cancel-in-progress: false    # 不取消正在跑的，排队等它结束
```

这样同一个 `group` 内的 workflow 会排队执行，不会互相踩踏。`cancel-in-progress: false` 的意思是"别取消前面正在跑的，等它跑完我再上"。

### 第九回合：部署完了，链接在哪？

部署成功了，但每次都去 Settings → Pages 找 URL 很麻烦。能不能直接在 Actions 面板看到部署链接？

查了一下，需要在 deploy job 上加 `environment`，并且给 `actions/deploy-pages` 步骤设一个 `id`：

```yaml
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}   # 自动获取部署 URL
    steps:
      - name: Deploy to GitHub Pages
        id: deployment                                  # 给 step 起名，方便引用
        uses: actions/deploy-pages@v4
```

这里又学到了两个东西：
- **`steps.<id>.outputs`**：每个 action 可以产出一些值，通过 `id` 来引用
- **`${{ }}`**：这是 GitHub Actions 的表达式语法，用来取变量值

部署完成后，Actions 面板上直接出现了博客链接，点一下就能访问。

### ✅ 大功告成

回头看这一路，每个报错都教会我一件事：

| 遇到什么 | 原因 | 学到的 |
|----------|------|--------|
| 空文件报错 | 没声明 `on` | workflow 必须知道什么时候触发 |
| 有 `on` 仍报错 | 没声明 `jobs` | 还必须知道要干什么 |
| `run:pwd` 报错 | 冒号后没空格 | YAML 语法：`key: value` |
| `run` 直接挂 job 上报错 | 没包在 `steps` 里 | job → steps → run 是固定层级 |
| `ls` 看不到代码 | 虚拟机是空的 | 需要 `actions/checkout` 拉代码 |
| `npm: not found` | 没装 Node | 需要 `actions/setup-node`，`with` 传参数 |
| `npm ci` 报错 | 依赖没装 | `npm run build` 前要先 `npm ci` |
| 上传 403 | 没有权限 | 必须显式声明 `permissions` |
| deploy 找不到产物 | 两个 job 并行跑 | `needs` 让 job 串行，等前面的完成 |
| 重复 push 冲突 | 并发部署打架 | `concurrency` 排队控制 |
| 不知道部署到哪了 | 没配 environment | `environment.url` + `${{ }}` 表达式语法 |

**核心公式其实就一句话**：`on`（什么时候）+ `jobs`（干什么，分 steps 一步步来）+ 缺什么补什么（permissions、needs、concurrency…）

YAML 的冒号空格、`uses` vs `run`、`with` 传参、`${{ }}` 表达式——这些细节都是踩坑踩出来的。

## 语法

***核心：在什么时间（on）+ 干什么事情（jobs）***

### 1. `on` — 触发工作流的事件

```yaml
on:
  push:
    branches: [main]       # 当 main 分支有推送时触发
  workflow_dispatch:       # 允许手动触发
```

常用事件：
- `push`：代码推送时触发
- `pull_request`：PR 创建/更新时触发
- `workflow_dispatch`：允许在 GitHub 网页上手动点击运行
- `schedule`：定时触发（cron 表达式）

### 2. `permissions` — 权限控制

GitHub Actions 默认有一定的权限，但建议显式声明最小权限原则：

```yaml
permissions:
  contents: read      # 读取仓库内容
  pages: write        # 写入 GitHub Pages
  id-token: write     # 用于 OIDC 认证（部署到 Pages 需要）
```

### 3. `concurrency` — 并发控制

防止多个工作流同时运行导致冲突：

```yaml
concurrency:
  group: pages
  cancel-in-progress: false   # 不取消正在运行的，而是排队等待
```

### 4. `jobs` — 定义要执行的任务

每个 job 是一个独立的执行单元，可以包含多个 step。

```yaml
jobs:
  build:                            # job 名称
    runs-on: ubuntu-latest          # 运行环境（操作系统）
    steps:                          # 步骤列表
      - name: Checkout              # 步骤名称（可选，但建议写）
        uses: actions/checkout@v4   # 使用官方 action：拉取代码

      - name: Setup Node
        uses: actions/setup-node@v4 # 使用官方 action：安装 Node.js
        with:                       # 传入参数
          node-version: 20
          cache: npm                # 缓存 npm 依赖，加速构建

      - name: Install dependencies
        run: npm ci                 # 直接运行 shell 命令

      - name: Build with VitePress
        run: npm run docs:build

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: docs/.vitepress/dist
```

`uses` vs `run`：
- `uses`：引用别人写好的 action（来自 GitHub Marketplace）
- `run`：直接在虚拟机中执行 shell 命令

### 5. Job 之间的依赖 — `needs`

多个 job 默认**并行**执行，用 `needs` 可以串行化：

```yaml
  deploy:
    needs: build          # 等 build 完成后再执行 deploy
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to GitHub Pages
        uses: actions/deploy-pages@v4
```

### 6. `environment` — 部署环境

```yaml
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}   # 部署完成后显示 URL
```

## 完整示例：部署 VitePress 博客到 GitHub Pages

以下是我这个博客实际使用的 workflow 文件 `.github/workflows/deploy.yml`：

```yaml
name: Deploy VitePress to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20 
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Build with VitePress
        run: npm run docs:build

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: docs/.vitepress/dist

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

## 整体流程解析

1. **触发**：每次 push 到 main 分支（或手动触发）
2. **构建（build job）**：
   - 拉取代码 → 安装 Node.js 20 → `npm ci` 安装依赖 → `npm run docs:build` 构建 → 上传构建产物
3. **部署（deploy job）**：等 build 完成后，将产物部署到 GitHub Pages
4. **结果**：博客自动更新到 `https://<username>.github.io/<repo>/`

## 常见问题

**Q: `npm ci` 和 `npm install` 有什么区别？**
- `npm ci` 严格按 `package-lock.json` 安装，适合 CI/CD 环境，速度更快
- `npm install` 可能更新 `package-lock.json`，适合本地开发

**Q: 如何查看工作流运行状态？**
- GitHub 仓库页面 → Actions 标签页，可以看到每次运行的日志

**Q: 如何调试失败的 workflow？**
- 在 Actions 页面点击失败的运行记录，展开每个 step 查看日志输出