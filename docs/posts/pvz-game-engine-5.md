---
title: 从零搭建PVZ游戏引擎（五）——LOADING状态、资源管线完善、僵尸实体与动画系统
date: 2026-07-04
author: myWorldmakerTonyczk
series: 从零搭建PVZ游戏引擎
seriesOrder: 5
---

# 从零搭建PVZ游戏引擎（五）——LOADING状态、资源管线完善、僵尸实体与动画系统

> GitHub 仓库：[https://github.com/myWorldmakerTonyczk/gamePVZ](https://github.com/myWorldmakerTonyczk/gamePVZ)

[上一篇](/posts/pvz-game-engine-4) 完成了 START 界面和 ResourceManager。今天做了四件事：补全资源加载链路（LOADING 状态 + ResourceList + LoadSystem）、完善资源管线（日志/错误检测/图片比例）、创建僵尸实体跑通全流程、搭建动画系统。

---

## 一、资源加载链路补全

### 问题：ResourceManager 做好了，但没人用它

上一篇写好了 ResourceManager（cache + loaders 双 Map + preload/get/load），但没有接入启动流程。资源什么时候加载？谁决定加载什么？

### LOADING 状态

在 START 之前插入一个专门的加载阶段：

```
LOADING ──→ START ──→ PLAYING ──→ ...
```

之前状态机只有 5 个状态，加一个 `LOADING`：

```js
export const GameState = {
    LOADING: "Loading",
    START: "Start",
    PLAYING: "Playing",
    PAUSED: "Paused",
    WIN: "WIN",
    LOSE: "LOSE"
};
```

`currentState` 初始值也改为 `GameState.LOADING`。游戏启动第一件事就是进 LOADING。

### ResourceList — 各模块自己声明依赖

资源清单独立于 ResourceManager，各模块在 import 时调用 `setResource()` 声明自己需要什么：

```js
// Service/Resource/ResourceList.js
const resourceList = new Set();

export function setResource(...paths) {
    paths.forEach(path => resourceList.add(path));
}

export function getList() {
    return [...resourceList];
}
```

Set 自动去重。比如僵尸模块调用 `setResource('assets/zombie/walk_1.png', ...)`，子弹模块调用 `setResource('assets/bullet.png')`，都进同一个清单。

**为什么不放 ResourceManager 里**：ResourceManager 管"已加载的资源"（运行时缓存），ResourceList 管"需要加载哪些资源"（静态清单）。两个不同职责，分开更清晰。

### LoadSystem — 调度加载

LOADING 状态进入时，读 ResourceList，调 preload，完成后切 START：

```js
// Service/system/systemPojo/LoadSystem.js
onEnter(GameState.LOADING, HookLabel.LOAD_SYSTEM, async () => {
    const paths = getList();
    try {
        await preload(paths);
    } catch (err) {
        console.error('[LoadSystem] 部分资源加载失败，继续启动');
    }
    transition(GameState.START);
});
```

加载失败不阻塞游戏——控制台报错但继续进 START，方便开发时调试。

main.js 启动改为：

```js
start(ctx, canvas);
transition(GameState.LOADING);  // 先加载资源
```

### 完整加载链路

```
各模块 import 时:
  Zombie.js → setResource('assets/zombie.png')
  动画文件  → setResource('walk_1.png') ... setResource('walk_20.png')

LOADING 状态:
  LoadSystem.onEnter
    → getList() → 拿到所有路径
    → preload(paths)
        → ResourceManager.loadOne × N
            → cache: path → <img> / <Audio> / JSON
    → transition(START)
```

---

## 二、资源管线完善

### ResourceManager 日志与错误检测

`loadOne` 里加了详细日志，每个资源的加载状态一目了然：

```js
function loadOne(path) {
    if (path.startsWith('@')) {
        console.warn(`[ResourceManager] ⚠️ 路径包含 @，可能误用了 importmap 别名，请改为真实路径: ${path}`);
    }
    console.log(`[ResourceManager] 加载: ${path}`);
    // ... 加载逻辑 ...
    promise = promise.then(res => {
        console.log(`[ResourceManager] 加载完成: ${path}`);
        // ...
    }).catch(err => {
        console.error(`[ResourceManager] 加载失败: ${path}`, err.message);
        throw err;
    });
}
```

**踩坑：importmap 别名不能用于资源路径**

`@assets/images/zombie.png` 这种路径浏览器不认识——importmap 只对 JS `import` 语句生效，`new Image()` 的 `src` 不会经过 importmap 解析。加了 `@` 开头检测，避免以后踩同样的坑。

### 图片防变形：drawSprite 比例缓存

实体画图时如果直接 `drawImage(img, x, y, w, h)`，w 和 h 不匹配图片原始比例就会拉伸变形。解决方法：以 w 为基准，高度自动按比例算：

```js
// Entity.js
_ratios = {};

drawSprite(ctx, key, x, y, w) {
    const img = get(key);
    if (!img) return false;

    if (!this._ratios[key]) {
        this._ratios[key] = img.naturalHeight / img.naturalWidth;
    }
    const h = w * this._ratios[key];
    ctx.drawImage(img, x, y, w, h);
    return true;
}
```

`_ratios` 缓存保证每个图片只算一次 `naturalHeight / naturalWidth`。返回 `false` 表示图片未就绪，调用方用色块 `fillRect` 兜底。

### 资源目录整理

`ResourceManager` 从 `Service/Utils/` 移到 `Service/Resource/`，和 `ResourceList` 统一管理。importmap 和 jsconfig.json 加 `@resource/` 别名。

---

## 三、僵尸实体——跑通全流程

用僵尸把资源管线、动画系统、碰撞扣血全部串起来验证。

```js
// Service/Entity/pojo/Zombie.js
export class Zombie extends Entity {
    type = EntityType.ENEMY;
    speed = 50;
    w = 60;
    h = 60;
    state = 'walk';              // 行为状态，动画系统读取

    update(dt) {
        this.x -= this.speed * dt;   // 向左走
    }
}
```

没有 render，没有动画代码。`state='walk'` 是它跟动画唯一的联系。

render 不在 Zombie 里——动画系统负责。但兜底逻辑还是要：如果图片没加载好，用绿色方块占位：

```js
render(ctx) {
    if (!this.drawSprite(ctx, frame, this.x, this.y, this.w)) {
        ctx.fillStyle = '#4a4';
        ctx.fillRect(this.x, this.y, this.w, this.h);
    }
}
```

level1.js 里把原来的 Box 替换成 Zombie，绑定血条：

```js
const zombie = new Zombie();
zombie.x = 700; zombie.y = 200;
scene.add(zombie);
overlayManager.add(new HealthBar(zombie));
```

至此完整链路跑通：**LOADING → 加载资源 → START → 空格 → 僵尸从右向左走 → 开枪 → 碰撞扣血 → 血条变色 → hp 归零消失**。

---

## 四、动画系统

### 设计：Entity.state 驱动

核心思路：Entity 只管"我现在在干什么"（`state`），怎么画动画完全由 AnimationSystem 决定。

```
Entity.state = 'walk'
       ↓
AnimationSystem  读 state → 查表翻译 → 取动画 → 驱动帧 → 渲染
```

这个模式跟 CollisionSystem 一样——系统读取实体数据，处理，输出。Entity 不知道动画存在。

### Animation — 时间驱动切帧

```js
export class Animation {
    frames = [];
    frameTime = 0.1;
    loop = true;
    playing = false;

    #index = 0;
    #timer = 0;

    constructor({ frames, frameTime = 0.1, loop = true }) {
        this.frames = frames;
        this.frameTime = frameTime;
        this.loop = loop;
    }

    update(dt) {
        if (!this.playing) return;
        this.#timer += dt;
        if (this.#timer >= this.frameTime) {
            this.#timer -= this.frameTime;
            this.#index++;
            if (this.#index >= this.frames.length) {
                if (this.loop) { this.#index = 0; }
                else { this.#index = this.frames.length - 1; this.playing = false; }
            }
        }
    }

    getCurrentFrame() { return this.frames[this.#index] ?? null; }
    play()  { this.playing = true; }
    stop()  { this.playing = false; this.#index = 0; this.#timer = 0; }
    pause() { this.playing = false; }
    reset() { this.#index = 0; this.#timer = 0; this.playing = true; }
}
```

几个设计点：

- **时间驱动，不是帧驱动** — GameLoop 的 dt 传进来，掉帧不减速只跳过中间帧
- **`frameTime` 不是 FPS** — 是每张精灵图显示多久，和屏幕刷新率无关。0.1 秒一帧，20 帧走完一圈 2 秒
- **`loop` 控制循环** — 走路 `true` 循环播；攻击/死亡 `false` 播完停住
- **`play` vs `reset`** — `play` 只恢复不重置位置；`reset` 回第 0 帧从头来

### AnimationRegistry — key → Animation

```js
const _map = new Map();
export function registerAnimation(key, animation) { _map.set(key, animation); }
export function getAnimation(key) { return _map.get(key) ?? null; }
```

Entity 只知道 `'zombieWalk'` 这个字符串，不知道动画文件在哪、几帧、帧率多少。

### AnimationSystem — 中枢

这是整个动画系统的大脑，分三个核心部分：翻译表、驱动循环、渲染挂载。

#### 整体架构

```
Entity（实体）
   ↓ state（行为状态）
STATE_ANIM_MAP（状态 → 动画 key）
   ↓
animators Map（entity.id → Animator）
   ↓
Animation 实例（帧数组 + 计时切帧）
   ↓
renderAnimators（真正画出来）
```

四层分层设计，每一层只关心自己的事。Entity 不知道动画存在，Animator 不知道 Entity 的 position，渲染层只管画当前帧。

#### STATE_ANIM_MAP — 翻译表

把 `实体类型 × 行为状态` 翻译成动画 key：

```js
const STATE_ANIM_MAP = {
    [EntityType.ENEMY]:  { walk: 'zombieWalk' },
    [EntityType.PLAYER]: { /* 后续添加 */ },
    [EntityType.BULLET]: { /* 后续添加 */ },
};
```

一个实体类型对应多种状态，每种状态对应一个动画 key。比如 ENEMY 以后可能有 `walk`、`attack`、`idle`、`dead`。

#### animators Map — 每个实体独立的动画状态

```js
// entity.id → { anim, animKey, lastState }
const animators = new Map();
```

每个 Animator 对象存了三个东西：

| 字段 | 作用 |
|------|------|
| `anim` | 当前正在播放的 Animation 实例 |
| `animKey` | 当前动画的名字（`'zombieWalk'`） |
| `lastState` | 上一次的行为状态（`'walk'`） |

**`animKey` 和 `state` 的区别** — 这是最容易混淆的地方：

```
state     = 行为（walk / attack / idle）    — "我在干什么"
animKey   = 具体动画资源（zombieWalk_v2）   — "播哪个动画"
```

为什么需要 `animKey`？一个 state 不一定固定一个动画。比如僵尸受伤后 `state` 还是 `walk`，但动画可能换成 `zombieWalk_damage`（跛脚走路）。`STATE_ANIM_MAP` 改了映射规则，`animKey` 就会跟着变。`lastState` 只管"状态变了没"，`animKey !== key` 管"最终播的动画是不是目标动画"。

#### resolveAnim — 核心逻辑逐行拆解

每帧对每个实体调用一次，是整个系统的核心：

```js
function resolveAnim(e, dt) {
    // ① 没状态 → 跳过
    if (!e.state) return;

    // ② 查翻译表：实体类型 → 状态 → 动画 key
    const key = STATE_ANIM_MAP[e.type]?.[e.state];
    if (!key) return;  // 该类型/状态没配动画

    // ③ 获取或创建 Animator
    const a = getOrCreateAnimator(e);

    // ④ 判断是否需要切换动画（重点）
    if (e.state !== a.lastState || a.animKey !== key) {
        a.anim     = getAnimation(key);   // 从 Registry 取动画
        a.animKey  = key;                  // 记录当前动画名
        a.lastState = e.state;             // 记录当前状态
        a.anim?.reset();                   // 从头播放
    }

    // ⑤ 驱动动画计时
    a.anim?.update(dt);
}
```

**④ 的判断条件拆开看**：

```js
if (e.state !== a.lastState || a.animKey !== key)
```

两种情况会触发切换：

- `state 变了` — 上次 walk，这次 attack → 必须切
- `state 没变但动画 key 变了` — 比如换皮肤 / 受伤 / 加速，映射表改了，`key` 跟 `animKey` 不一致 → 也要切

两个条件都满足时才跳过切动画——状态没变、动画也没换，当前动画继续跑。

**`?.` 是什么**：可选链。`a.anim?.reset()` 等价于 `if (a.anim) a.anim.reset()`，防止 `anim` 为 null 时崩。

#### renderAnimators — 渲染钩子

动画必须在 Entity 之后、Overlay 之前渲染。Scene 提供了一个钩子：

```js
// Scene.js
let _afterEntityRender = null;
export function setAfterEntityRender(fn) { _afterEntityRender = fn; }

render(ctx) {
    for (const e of this.entities) e.render(ctx);  // ① 实体（兜底色块）
    _afterEntityRender?.(ctx);                       // ② 动画帧
    overlayManager.render(ctx);                      // ③ 血条等贴片
}
```

AnimationSystem 初始化时注册：

```js
setAfterEntityRender((ctx) => {
    for (const e of scene.getEntities()) {
        const a = animators.get(e.id);
        if (!a?.anim) continue;
        const frame = a.anim.getCurrentFrame();
        if (frame) e.drawSprite(ctx, frame, e.x, e.y, e.w);
    }
});
```

动画必须在这三个里的中间层——不然血条会被动画图盖住，或者动画图盖住实体。

#### getPhotoPathAsc — 帧路径拼图器

浏览器不能扫描文件夹，但素材有命名规范就可以自动拼路径：

```js
// 命名规范：文件夹名_序号.拓展名
// walk_1.png  walk_2.png  ...  walk_20.png
getPhotoPathAsc('assets/images/.../walk', 20, 'png', 1);
// → ['...walk_1.png', '...walk_2.png', ...]

// 不传 count → Promise，自动逐张检测到 404 停止（开发用）
await getPhotoPathAsc('assets/images/.../walk', undefined, 'png');
```

传 count 时同步返回数组，在 import 阶段立刻注册到 ResourceList。自动检测模式只在不知道帧数时用。

#### 动画注册与完整流程

```js
// ① 注册阶段（import 时，同步）
const frames = getPhotoPathAsc('assets/images/Entity/animation/zombie/walk', 20, 'png', 1);
frames.forEach(f => setResource(f));       // → ResourceList
registerAnimation('zombieWalk', new Animation({
    frames, frameTime: 0.10, loop: true
}));                                       // → AnimationRegistry

// ② 驱动阶段（PLAYING 每帧 onUpdate）
tickAnimators(dt)
  → for entity in scene:
       resolveAnim(e, dt)
         → 读 e.state='walk', e.type=ENEMY
         → STATE_ANIM_MAP[ENEMY]['walk'] → 'zombieWalk'
         → getAnimation('zombieWalk') → Animation 实例
         → anim.update(dt) → 计时切帧

// ③ 渲染阶段（每帧 render）
Scene.render(ctx)
  → entity.render()           ← 色块兜底
  → renderAnimators(ctx)       ← 画当前动画帧
  → overlayManager.render(ctx) ← 血条最上层
```

#### 加新动画只需三步

```js
// 1. 新建动画定义 → 注册帧 + Animation
// 2. STATE_ANIM_MAP 加映射 [TYPE]: { state: 'animKey' }
// 3. 实体设 this.state = 'state'
```

#### 这套系统已经做到什么水平

本质是一个**数据驱动动画系统（Data-driven Animator）**，相当于 Unity Animator 的简化版核心：

- 状态 → 动画自动映射
- Animator 独立缓存（每个实体一份）
- 自动切换 + 从头播放
- 渲染管线挂钩（setAfterEntityRender）
- 垃圾回收（实体删除自动清理 Animator）

后续可升级方向：动画过渡（blend）、动画优先级（attack 打断 walk）、雪碧图打包。

---

## 完整调用链

```
① 注册阶段（import 时，同步）
──────────────────────────
Entity/Zombie.js → setResource('zombie.png')
Animation/...Walk.js → getPhotoPathAsc(...) → setResource × 20
                     → registerAnimation('zombieWalk', new Animation(...))
AnimationSystem.js → onUpdate(PLAYING, tickAnimators)
                  → setAfterEntityRender(renderAnimators)

② 加载阶段（LOADING，一次）
──────────────────────────
LoadSystem.onEnter → getList() → preload(paths)
  → ResourceManager.loadOne × N
  → cache: key → <img>

③ 驱动阶段（PLAYING 每帧）
──────────────────────────
tickAnimators(dt)
  → 读 e.state='walk', e.type=ENEMY
  → STATE_ANIM_MAP[ENEMY]['walk'] → 'zombieWalk'
  → getAnimation('zombieWalk') → Animation 实例
  → anim.update(dt) → 计时切帧

④ 渲染阶段（每帧 render）
──────────────────────────
Scene.render(ctx)
  → entity.render()           ← 色块兜底
  → renderAnimators(ctx)       ← 画当前动画帧
  → overlayManager.render(ctx) ← 血条最上层
```

---

## 当前项目结构

```
gamePVZ/
├── main.js
├── Service/
│   ├── core/               ← 引擎核心
│   │   ├── State Machine.js    ← + LOADING 状态
│   │   ├── GameLoop.js
│   │   └── EventBus/
│   ├── Entity/
│   │   ├── Entity.js       ← + drawSprite(ratio 缓存)
│   │   ├── Scene.js        ← + setAfterEntityRender 钩子
│   │   └── pojo/
│   │       ├── Zombie.js   ← 新建，state='walk'
│   │       ├── player.js
│   │       └── Bullet.js
│   ├── Animation/          ← 新建
│   │   ├── Animation.js
│   │   ├── AnimationRegistry.js
│   │   └── pojo/
│   ├── Resource/           ← 从 Utils 迁出
│   │   ├── ResourceManager.js  ← + 日志 + @检测
│   │   └── ResourceList.js     ← 新建
│   ├── OverLay/
│   ├── Input/
│   ├── Utils/
│   │   ├── Collision.js
│   │   └── getPhotoPathAsc.js  ← 新建
│   └── system/
│       └── systemPojo/
│           ├── AnimationSystem.js  ← 新建
│           ├── LoadSystem.js       ← 新建
│           ├── StartSystem.js
│           ├── CollisionSystem.js
│           └── ...
└── level/
    └── level1.js
```

---

## 后续方向

- **雪碧图打包**：散图 → 运行时拼接雪碧图 → drawImage 裁切单帧
- **多动画切换**：STATE_ANIM_MAP 加 attack/idle/dead，Entity 切 state 自动换
- **动画事件**：非循环动画播到最后一帧触发回调

[返回首页](/) | [上一篇](/posts/pvz-game-engine-4) | [GitHub 仓库](https://github.com/myWorldmakerTonyczk/gamePVZ)
