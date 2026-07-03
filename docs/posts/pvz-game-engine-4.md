---
title: 从零搭建PVZ游戏引擎（四）——START界面、System生命周期与资源管理器
date: 2026-07-03
author: myWorldmakerTonyczk
---

# 从零搭建PVZ游戏引擎（四）——START界面、System生命周期与资源管理器

> GitHub 仓库：[https://github.com/myWorldmakerTonyczk/gamePVZ](https://github.com/myWorldmakerTonyczk/gamePVZ)

[上一篇](/posts/pvz-game-engine-3) 完成了 importmap、架构解耦、鼠标输入和 Overlay 贴片系统。今天的内容分为两块：一是补全 START 状态的开始界面、并统一所有 System 的 `onEnter/onUpdate/onExit` 生命周期模式；二是实现资源管理器，为后续贴图做准备。

## START 开始界面

状态机一开始就定义了 START 状态，但从来没真正用过——main.js 里直接 `transition(GameState.PLAYING)` 跳过了。今天把它用起来，做成一个开始界面。

### 设计：用 Overlay 画 UI

上一篇刚做完 Overlay 贴片系统，正好复用来画开始界面——一个覆盖全屏的半透明遮罩 + 标题 + 提示文字：

```js
// Service/OverLay/pojo/StartScreen.js
export class StartScreen extends Overlay {
    constructor(w, h) {
        super({ x: 0, y: 0, duration: 0 });  // duration=0 永久
        this.w = w;
        this.h = h;
    }

    render(ctx) {
        // 半透明遮罩
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, this.w, this.h);

        // 标题
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 48px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('植物大战僵尸', this.w / 2, this.h / 2 - 30);

        // 提示
        ctx.font = '20px sans-serif';
        ctx.fillStyle = '#aaa';
        ctx.fillText('点击画面 或 按空格 开始游戏', this.w / 2, this.h / 2 + 30);
    }
}
```

### StartSystem：统一的生命周期模式

和 PauseSystem 一样放在 `Service/system/systemPojo/` 下，三个钩子各司其职：

```js
// StartSystem.js
let screen = null;

onEnter(GameState.START, HookLabel.START_SYSTEM, () => {
    const canvas = document.getElementById('game');
    screen = new StartScreen(canvas.width, canvas.height);
    overlayManager.add(screen);
});

onUpdate(GameState.START, HookLabel.START_SYSTEM, () => {
    if (isJustPressed(KEY_MAP.Space) || isJustClicked(MouseMap.LEFT)) {
        transition(GameState.PLAYING);
    }
});

onExit(GameState.START, HookLabel.START_SYSTEM, () => {
    overlayManager.remove(screen);
    screen = null;
});
```

### 踩坑：初始状态的 onEnter 不会自动触发

游戏初始状态是 `GameState.START`（State Machine 的默认值），但这是"生来就是"，从来没人调过 `transition(START)`。**onEnter 只在 transition 时触发，初始状态永远不会触发 onEnter**。

结果：StartScreen 根本没创建，点击也没反应，只有绿屏。

解决：main.js 里显式调用一次：

```js
start(ctx, canvas);
transition(GameState.START);  // 手动触发 onEnter[START]
```

## System 生命周期统一

回过头看，所有 System 其实都在做同一套模式：

```
onEnter   → 初始化（找 entity、注册监听、创建 UI）
onUpdate  → 每帧逻辑（检测输入、调用方法）
onExit    → 清理（注销监听、删除 UI、置 null）
```

各个 System 的对应关系：

| System | onEnter | onUpdate | onExit |
|--------|---------|----------|--------|
| StartSystem | 创建开始界面 | 检测点击/空格 | 删除界面 |
| PlayerSystem | 从 Scene 找 player | 检测射击输入 | player = null |
| CollisionSystem | 注册 COLLISION 监听 | 遍历检测碰撞 | 注销监听 |
| BulletSpawner | 注册 PLAYER_SHOOT 监听 | — | 注销监听 |
| PauseSystem | — | 检测 P 键 | — |

### 踩坑：const 和 function 的提升差异

重构 PauseSystem 时把函数改成 `const toggle = () => {}`，但 `onUpdate` 调用写在了声明前面：

```js
onUpdate(GameState.PLAYING, HookLabel.PAUSE, toggle);  // ← toggle 还不存在

const toggle = () => { ... };  // const 不提升，报 ReferenceError
```

`const` 有暂时性死区（TDZ），声明前访问直接报错。改成 `function toggle()` 就行——函数声明会被提升到作用域顶部。

### 踩坑：漏了 import onExit

PlayerSystem 加 `onExit` 时忘了在 import 里加 `onExit`：

```js
import { onEnter, onUpdate } from '@core/GameLoop.js';  // ← 缺 onExit
onExit(GameState.PLAYING, ...)  // ← 直接报 ReferenceError
```

一个 System 报错，整个 `@system/index.js` 加载链中断，后面的 StartSystem 没注册上——最终表现为绿屏。

## 资源管理器

### 问题

游戏需要图片、音频、JSON 数据。如果不管理会出现：
- 同一张图片被多个实体重复加载（浪费网络）
- 加载状态混乱，不知道哪些已加载、哪些还在等
- 异步顺序无法控制

### 核心设计：cache + loaders

```js
const cache = new Map();   // key → 已加载的资源对象（Image/Audio/JSON）
const loaders = new Map(); // key → 正在加载中的 Promise（防重复）
```

一个资源只有三种状态：

```text
① 未加载        cache ❌  loaders ❌
② 加载中        cache ❌  loaders ✔
③ 已加载        cache ✔   loaders ❌
```

### 四个方法

```js
// 1️⃣ 加载单个资源（自动去重）
export function load(path) {
    if (cache.has(path)) return Promise.resolve(cache.get(path));  // 已缓存，直接返回
    if (loaders.has(path)) return loaders.get(path);                // 加载中，复用 Promise
    return loadOne(path);                                           // 第一次，开始加载
}

// 真正的加载逻辑：按后缀选 Image / Audio / JSON 加载器
function loadOne(path) {
    let promise;
    if (path.endsWith('.png')) promise = loadImage(path);
    // ... audio、json 同理

    promise = promise.then(res => {
        cache.set(path, res);     // 加载完 → 放入缓存
        loaders.delete(path);     // 移除加载中状态
        return res;
    });

    loaders.set(path, promise);   // 标记"正在加载"
    return promise;
}

// 3️⃣ 获取缓存（同步，不等待）
export function get(path) {
    if (!cache.has(path)) {
        console.warn(`资源未加载: ${path}`);
        return null;
    }
    return cache.get(path);
}

// 4️⃣ 预加载：启动时一次性加载所有资源
export async function preload(paths) {
    return Promise.all(paths.map(p => loadOne(p)));
}
```

### 为什么 loaders 必须存在

没有 loaders 的情况下，三个系统同时请求同一张图片——三次网络请求。

有 loaders：A 创建 Promise 写入 loaders，B 和 C 发现自己也在请求同一个 key，直接复用 A 的 Promise。一次网络请求，三个系统共享结果。

### Promise 是什么

图片加载需要网络请求——不能同步等待，不然游戏卡死。Promise 是 JS 的异步标准：

```js
// START 时：去加载，返回 Promise
await preload(['zombie.png']);  // 等待网络下载完成

// 游戏里：同步取缓存，不等待
render(ctx) {
    ctx.drawImage(get('zombie.png'), this.x, this.y);
}
```

预加载时用 `await` 等它完成，游戏运行时 `get` 直接从内存拿——不等待。

### 一句话总结

> ResourceManager = 用 cache 保存成品，用 loaders 控制并发加载，用 Promise 统一异步流程的资源状态机系统。

### 升级方向

当前已经达到基础引擎级，后续可以扩展：
- 引用计数（自动释放不用的资源）
- 分包加载（按关卡拆分资源包）
- SpriteSheet 支持（配合动画系统）
- 加载进度回调

## 当前项目结构

```
gamePVZ/
├── main.js                 ← start + transition(START)
├── Service/
│   ├── core/               ← 引擎核心
│   ├── Entity/             ← 实体层
│   ├── OverLay/            ← 贴片系统
│   │   ├── Overlay.js
│   │   ├── OverlayManager.js
│   │   └── pojo/
│   │       ├── HealthBar.js
│   │       └── StartScreen.js   ← 开始界面
│   ├── Input/              ← 输入系统
│   ├── Utils/
│   │   ├── Collision.js
│   │   └── ResourceManager.js   ← 资源管理器
│   └── system/
│       └── systemPojo/
│           ├── StartSystem.js   ← START 状态管理
│           ├── PauseSystem.js
│           ├── PlayerSystem.js
│           ├── CollisionSystem.js
│           ├── BulletSpawner.js
│           └── OverlaySystem.js
└── level/
    └── level1.js
```

[返回首页](/) | [上一篇](/posts/pvz-game-engine-3) | [GitHub 仓库](https://github.com/myWorldmakerTonyczk/gamePVZ)
