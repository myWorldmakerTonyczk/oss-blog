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

### 资源系统在解决什么问题

在游戏里会不断用到图片（player.png）、音频（bgm.mp3）、数据（level.json）。

如果不管理会出现：

- 同一资源重复加载（浪费网络）
- 多个模块重复创建 Image / Audio
- 加载状态混乱
- 无法控制异步顺序

所以资源管理器的目标是：**同一个资源只加载一次、所有人共享加载结果、支持异步加载、支持缓存复用**。

### 核心结构设计

```js
const cache = new Map();   // 已加载完成的资源
const loaders = new Map(); // 正在加载中的 Promise
```

### 两个核心状态

**cache（成品仓库）**：key → 资源对象（Image / Audio / JSON）。已经加载完成，可直接使用，永久缓存（除非 clear）。

**loaders（生产流水线）**：key → Promise。表示"正在加载"，防止重复请求，多个请求共享同一个 Promise。

### 资源生命周期（核心状态机）

一个资源只有三种状态：

| 状态 | cache | loaders |
|------|-------|---------|
| 未加载 | ❌ | ❌ |
| 加载中 | ❌ | ✔ |
| 已加载 | ✔ | ❌ |

### 完整调用链

假设调用 `load("player.png")`：

**STEP 1：进入 load()**

```js
export function load(path) {
    if (cache.has(path)) return Promise.resolve(cache.get(path));  // cache 有 → 直接返回
    if (loaders.has(path)) return loaders.get(path);                // loaders 有 → 复用 Promise
    return loadOne(path);                                           // 都没有 → 开始加载
}
```

**STEP 2：进入 loadOne（真正执行加载）**

做三件事：

```js
function loadOne(path) {
    // 1️⃣ 创建加载任务（按后缀选 Image/Audio/JSON 加载器）
    let promise;
    if (path.endsWith('.png') || path.endsWith('.jpg')) promise = loadImage(path);
    else if (path.endsWith('.mp3') || path.endsWith('.wav')) promise = loadAudio(path);
    else if (path.endsWith('.json')) promise = loadJSON(path);

    // 2️⃣ 写入 loaders（关键："这个资源正在加载中"）
    loaders.set(path, promise);

    // 3️⃣ 绑定完成逻辑
    promise = promise.then(res => {
        cache.set(path, res);    // 放入缓存
        loaders.delete(path);    // 移除加载状态
        return res;
    });

    return promise;
}
```

**get 和 load 的区别**

| | load(path) | get(path) |
|---|-----------|----------|
| 干嘛 | 去加载资源 | 取缓存资源 |
| 返回 | Promise（异步） | 资源对象（同步） |
| 在哪用 | 加载界面 | render / update 里 |

```js
// START 时：去加载
await preload(['zombie.png']);   // 等网络下载完

// 游戏里：直接拿
render(ctx) {
    ctx.drawImage(get('zombie.png'), this.x, this.y);  // 立刻拿到，不等待
}
```

### 真正的异步流程（时间线）

```text
load("player.png")
        ↓
检查 cache（没有）
        ↓
检查 loaders（没有）
        ↓
进入 loadOne
        ↓
创建 Promise（开始下载图片）
        ↓
loaders 记录"加载中状态"
        ↓
浏览器下载图片
        ↓
img.onload 触发
        ↓
resolve(img)
        ↓
promise.then 执行
        ↓
cache.set(img)  +  loaders.delete(path)
        ↓
返回 img
```

### 为什么 loaders 必须存在

如果没有 loaders：

```text
A 请求 player.png → load（开始加载）
B 请求 player.png → load（又开一个加载，重复！）
C 请求 player.png → load（又开一个，重复！）
```

❌ 三次网络请求。 

有 loaders：

```text
A → 创建 Promise，写入 loaders
B → check loaders → 有 → 复用 A 的 Promise
C → check loaders → 有 → 复用 A 的 Promise
```

✔ 一次网络请求，全局共享。

### cache 和 loaders 的本质区别

| | cache | loaders |
|---|------|---------|
| 存什么 | 资源对象 | Promise |
| 状态 | 已完成 | 加载中 |
| 是否可用 | ✔ 直接用 | ❌ 等待 |
| 生命周期 | 长期 | 临时 |

### 一句话总结

> ResourceManager = 用 cache 保存成品，用 loaders 控制并发加载，用 Promise 统一异步流程的资源状态机系统。

### 升级方向

当前已经达到基础引擎级，后续可以扩展：
- 引用计数（自动释放不用的资源）
- 分包加载（按关卡拆分资源包）
- SpriteSheet 支持（配合动画系统）
- 加载进度回调
- 资源优先级队列（先加载关键资源）

### Promise 进阶答疑

写 ResourceManager 时遇到不少 Promise 相关的问题，一并记录在这里。

#### resolve 和 reject 是什么

```js
new Promise((resolve, reject) => {
    // resolve = "搞定了，结果在这"
    // reject  = "出错了，原因在这"
});
```

这两个名字只是约定俗成，本质上是 `new Promise` 传给你的两个函数参数——第一个是成功回调，第二个是失败回调。你决定什么时候调谁。

#### img.onload 和 img.onerror

```js
const img = new Image();
img.onload  = () => resolve(img);  // 下载成功 → 调 resolve 交出 img
img.onerror = reject;              // 下载失败 → 调 reject 报告错误
img.src = 'player.png';           // 最后才触发下载
```

`img.src` 必须写在最后：一旦赋值，浏览器立刻开始下载。如果图片很小或者在缓存里，可能瞬间就下载完了——此时 `onload` 还没绑定，事件就错过了。先绑监听，再放老鼠。

#### 为什么 loadJSON 结构和 loadImage 不一样

`loadImage` 用 `new Promise` 手动包装，因为 `new Image()` 是事件驱动的，不返回 Promise。

`loadJSON` 用 `async/await`，因为 `fetch()` 本身就返回 Promise，不需要手动包装。

两种写法殊途同归——都返回 Promise：

```js
function loadImage(src) {
    return new Promise((resolve, reject) => {  // fetch/audio 同理
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

async function loadJSON(src) {
    const res = await fetch(src);          // fetch 返回 Promise，await 等它完成
    if (!res.ok) throw new Error(...);     // async 里 throw = reject
    return res.json();                     // async 里 return = resolve
}
```

#### Promise 是什么——它叫"承诺"不是"结果"

```js
const promise = loadJSON('data.json');
console.log(promise);  // Promise { <pending> } ← 还没结果！
```

调用 `loadJSON` 时，函数里 `await fetch` 让函数暂停了，立刻返回一个 pending 的 Promise。这个 Promise 是"承诺"——"我现在没有结果，但我保证未来会有"。等 fetch 完成，Promise 从 pending 变成 fulfilled，值就在里面了。

**Promise 会变，但只变一次：**

```text
pending ──成功──→ fulfilled（拿到值，永久冻结）
       ──失败──→ rejected（拿到错误，永久冻结）
```

后续再 `await` 同一个 Promise，缓存直接返回同一个结果，不会重新触发下载。

#### `.then()` 里的代码不是立刻执行的

```js
promise = promise.then(res => {
    cache.set(path, res);      // ← 图片下载完才跑
    loaders.delete(path);      // ← 图片下载完才跑
});

loaders.set(path, promise);    // ← 现在立刻跑（标记"加载中"）
return promise;                // ← 现在立刻返回（pending Promise）
```

`.then()` 注册的是一个"等完成了再跑"的回调。所以先 `loaders.set`（立刻标记生产线上有这个资源），后 `loaders.delete`（下载完了才从生产线移除）。两个操作隔着整个下载过程。

#### 为什么 cache 命中了还要用 Promise.resolve 包一层

```js
export function load(path) {
    if (cache.has(path)) return Promise.resolve(cache.get(path));
    return loadOne(path);
}
```

保证返回值类型一致——`load` **永远返回 Promise**。调用方永远 `await`，不用管这次到底走了缓存还是走了下载：

```js
const img = await load('player.png');  // 第一次等 200ms，第二次 0ms 立刻到
```

#### 怎么从 Promise 里取值

两种方式等价：

```js
// 方式 1：await（只能在 async 函数里用）
const img = await load('player.png');
ctx.drawImage(img, 0, 0);

// 方式 2：.then()
load('player.png').then(img => {
    ctx.drawImage(img, 0, 0);
});
```

`await` 就是 `.then()` 的语法糖，把 `resolve(值)` 塞进去的那个值掏出来给你。

#### isCached 的必要性

```js
export function isCached(path) {
    return cache.has(path);
}
```

和 `get` 不同：`get` 没缓存会 `console.warn` 并返回 null，`isCached` 只是悄悄问一句"加载好了没"，不触发警告，不尝试加载。纯查询工具，用于加载界面判断是否能进入游戏。

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
