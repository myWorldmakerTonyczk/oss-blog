---
title: 从零搭建PVZ游戏引擎（六）——动画系统重构：Config/Player拆分、Registry收敛、Entity去渲染化
date: 2026-07-05
author: myWorldmakerTonyczk
series: 从零搭建PVZ游戏引擎
seriesOrder: 6
---

# 从零搭建PVZ游戏引擎（六）——动画系统重构：Config/Player 拆分、Registry 收敛、Entity 去渲染化

> GitHub 仓库：[https://github.com/myWorldmakerTonyczk/gamePVZ](https://github.com/myWorldmakerTonyczk/gamePVZ)

[上一篇](/posts/pvz-game-engine-5) 搭好了动画系统的基础架构。跑起来之后发现了三个结构性问题，这篇记录重构过程。

---

## 问题诊断

### 问题 1：所有实体共享同一个 Animation 实例

动画注册时 `new Animation({...})` 存入了 Registry，然后每个实体的 animator 都通过 `getAnimation(key)` 拿到**同一个引用**：

```js
// zombieAnimationWalk.js
registerAnimation('zombieWalk', new Animation({...}));  // Map 里存了实例_A

// AnimationSystem.js resolveAnim()
a.anim = getAnimation(key);   // 每个 animator 拿到的都是 实例_A
a.anim?.update(dt);           // 5 个僵尸，同一帧 update 被调 5 次
```

`Animation` 内部有可变状态 `#index`、`#timer`、`playing`，5 个僵尸共享同一份：

```
僵尸A ──┐
僵尸B ──┼── 全部调用 实例_A.update(dt)  ← #timer 被叠加 5 次
僵尸C ──┤
...    ──┘
```

后果：

- **帧速错误** — `#timer` 累加了 N 倍时间，帧索引推进速度是正常的 N 倍
- **状态互相干扰** — 一个僵尸触发 `reset()`，所有僵尸的动画都跳回第 0 帧
- **Registry 被架空** — 存进去的实例因为共享问题根本无法正常使用

本质原因：**Animation 一个类同时扛了不可变配置和可变状态**。配置可以共享（frames、frameTime、loop），但播放状态（#index、#timer、playing）必须每个实体独立。

### 问题 2：注册流程分散

每个动画文件自己调 `getPhotoPathAsc` + `setResource` + `registerAnimation`：

```js
// 旧 zombieAnimationWalk.js — 每加一个动画都要写这三步
const frames = getPhotoPathAsc('assets/images/.../walk', 20, 'png', 1);
frames.forEach(f => setResource(f));
registerAnimation('zombieWalk', new Animation({ frames, frameTime: 0.20, loop: true }));
```

10 个动画就写 10 遍。帧路径生成和资源注册应该由 Registry 统一处理，动画文件只管声明参数。

### 问题 3：STATE_ANIM_MAP 和 AnimationRegistry 功能重叠

两个映射串联工作：

```
(entityType, state) ──STATE_ANIM_MAP──▶ animKey ──AnimationRegistry──▶ Animation
```

第一个映射硬编码在 AnimationSystem 里，第二个在 Registry 里。看起来像两个注册表，但本质是同一件事——"哪个实体类型的哪个状态对应哪个动画"。应该收归一处。

### 问题 4：Entity 持有了渲染逻辑

`Entity.js` 里有 `drawSprite()`、`_ratios` 比例缓存、`render()` 方法。但按照动画系统的设计初衷——**Entity 是纯数据+逻辑层，动画是独立视觉层**——Entity 不应该知道自己怎么被画。`drawSprite` 应该属于动画系统。

---

## 重构方案

讨论后确定的三个核心改动：

| 问题 | 方案 |
|------|------|
| 共享 Animation 实例 | 拆成 **AnimationConfig**（不可变配置）+ **AnimationPlayer**（可变状态，每个 animator 各自 new） |
| 注册分散 | `registerAnimation` 一个入口：内部完成帧路径生成 + 资源注册 + Config 存储 + type/state 映射 |
| 两个 Map 重叠 | STATE_ANIM_MAP 收归 Registry，`getConfigByState(type, state)` 一步到位 |
| Entity 持有渲染 | `drawSprite` 移到 AnimationSystem，Entity 去渲染化 |

---

## 一、AnimationConfig + AnimationPlayer 拆分

### AnimationConfig — 不可变配置

存于 Registry，多实体共享。只描述"动画长什么样"，不包含任何运行时状态：

```js
// Service/Animation/AnimationConfig.js
export class AnimationConfig {
    frames = [];          // 帧图片路径数组
    frameTime = 0.1;      // 每帧持续秒数
    loop = true;          // 是否循环

    constructor({ frames, frameTime = 0.1, loop = true }) {
        this.frames = frames;
        this.frameTime = frameTime;
        this.loop = loop;
    }
}
```

纯数据对象，没有方法，没有私有字段。存进 Registry 后永远不会被修改。

### AnimationPlayer — 可变播放状态

每个 animator `new` 一个，各自维护独立的帧索引和计时器：

```js
// Service/Animation/AnimationPlayer.js
export class AnimationPlayer {
    #config;          // 引用 AnimationConfig（只读）
    #index = 0;       // 当前帧索引
    #timer = 0;       // 累计时间
    playing = false;

    constructor(config) {
        this.#config = config;
    }

    update(dt) {
        if (!this.playing) return;
        this.#timer += dt;
        if (this.#timer >= this.#config.frameTime) {
            this.#timer -= this.#config.frameTime;
            this.#index++;
            if (this.#index >= this.#config.frames.length) {
                if (this.#config.loop) { this.#index = 0; }
                else { this.#index = this.#config.frames.length - 1; this.playing = false; }
            }
        }
    }

    getCurrentFrame() { return this.#config.frames[this.#index] ?? null; }
    play()  { this.playing = true; }
    stop()  { this.playing = false; this.#index = 0; this.#timer = 0; }
    pause() { this.playing = false; }
    reset() { this.#index = 0; this.#timer = 0; this.playing = true; }
}
```

`#config` 是私有字段——外部拿不到，只能通过 Player 暴露的方法间接访问。Player 只读 Config，从不修改 Config。

### 拆分前后对比

```
拆分前:
  Animation
    ├─ frames[]     ← 想共享
    ├─ frameTime    ← 想共享
    ├─ loop         ← 想共享
    ├─ #index       ← 不能共享
    ├─ #timer       ← 不能共享
    └─ playing      ← 不能共享

拆分后:
  AnimationConfig（Registry 存一份）
    ├─ frames[]
    ├─ frameTime
    └─ loop

  AnimationPlayer（每个 animator new 一个）
    ├─ #config  →  指向 Config（只读）
    ├─ #index
    ├─ #timer
    └─ playing
```

类型层面杜绝了"误共享"——Config 根本没 `#index`，你想 share 也 share 不了播放状态。

---

## 二、AnimationRegistry 收敛

重写 Registry，`registerAnimation` 一次性完成四件事：

```js
// Service/Animation/AnimationRegistry.js

// 双 Map 存储
const configMap = new Map();   // animKey → AnimationConfig
const stateMap = new Map();    // entityType → Map<state, animKey>

export function registerAnimation({ key, entityType, state, config }) {
    // 1. 生成帧路径
    const frames = getPhotoPathAsc(
        config.dir, config.count, config.ext ?? 'png', config.start ?? 1
    );

    // 2. 注册资源（供 LoadSystem 预加载）
    frames.forEach(f => setResource(f));

    // 3. 创建 Config 存入 configMap
    configMap.set(key, new AnimationConfig({
        frames,
        frameTime: config.frameTime ?? 0.1,
        loop: config.loop ?? true,
    }));

    // 4. 建立 type+state → key 映射
    if (!stateMap.has(entityType)) stateMap.set(entityType, new Map());
    stateMap.get(entityType).set(state, key);
}
```

两个查询入口：

```js
// 按 key 查（直接取配置）
export function getConfig(key) {
    return configMap.get(key) ?? null;
}

// 按 type+state 查（AnimationSystem 主入口，一步到位）
export function getConfigByState(entityType, state) {
    const key = stateMap.get(entityType)?.get(state);
    if (!key) return null;
    return configMap.get(key) ?? null;
}
```

### 动画注册文件简化

旧文件 10 行，新文件只需声明参数：

```js
// Service/Animation/pojo/zombie/walk/zombieAnimationWalk.js — 新写法
registerAnimation({
    key: 'zombieWalk',
    entityType: EntityType.ENEMY,
    state: 'walk',
    config: {
        dir: 'assets/images/Entity/animation/zombie/walk',
        count: 20,
        frameTime: 0.20,
        loop: true,
    },
});
```

不再 import `getPhotoPathAsc`、`setResource`、`Animation`。加一个新动画就是 10 行配置，零重复代码。

---

## 三、AnimationSystem 重写

### STATE_ANIM_MAP 移除

之前：

```js
// AnimationSystem 内部硬编码
const STATE_ANIM_MAP = {
    [EntityType.ENEMY]: { walk: 'zombieWalk' },
    ...
};
const key = STATE_ANIM_MAP[e.type]?.[e.state];
const anim = getAnimation(key);
```

现在：

```js
// 一步从 Registry 查
const config = getConfigByState(e.type, e.state);
```

### animator 持有实体引用

核心改动——animator 结构从 `{ anim, animKey, lastState }` 变成 `{ entity, player, lastState }`：

```js
/**
 * animators: entity.id → { entity, player, lastState }
 *
 * - entity:  持有实体引用，渲染时直接读 x, y, w
 *            （实体完全不知道动画系统的存在）
 * - player:  AnimationPlayer 实例，每个实体独立的播放状态
 * - lastState: 上一次的 entity.state，用于检测状态变化
 */
const animators = new Map();

function bindEntity(entity) {
    animators.set(entity.id, {
        entity,
        player: null,
        lastState: null,
    });
}
```

**为什么持有引用而不是每帧遍历 scene 查**：

- 渲染时直接从 `a.entity.x` 读坐标，不需要从 scene 反查
- 实体删除时 animator 跟着清，不会残留
- 以后做 UI 动画，`bindEntity` 换成 `bindPosition({x, y})` 即可——动画系统不需要知道数据源是实体还是固定坐标

### 状态变化检测

`resolveAnim` 简化：不再需要 `animKey` 中间变量，直接比较 state：

```js
function resolveAnim(e, dt) {
    if (!e.state) return;

    const config = getConfigByState(e.type, e.state);
    if (!config) return;

    const a = animators.get(e.id);
    if (!a) return;

    // 状态变化 → new Player，从第 0 帧重新开始
    if (e.state !== a.lastState) {
        a.player = new AnimationPlayer(config);
        a.player.reset();
        a.lastState = e.state;
    }

    a.player?.update(dt);
}
```

**为什么 state 变化时 new 一个 Player 而不是复用**：切换动画意味着上一动画的 `#index` / `#timer` 已经没有意义了，直接 new 比手动 reset 所有字段更干净，不会有遗漏的残留状态。

### 懒绑定

不在 `scene.add()` 时绑定，而是在 `tickAnimators` 里首次见到实体时自动绑定：

```js
function tickAnimators(dt) {
    const entities = scene.getEntities();
    const alive = new Set();

    for (const e of entities) {
        alive.add(e.id);

        // 首次见到 → 自动绑定
        if (!animators.has(e.id)) {
            bindEntity(e);
        }

        resolveAnim(e, dt);
    }

    // 实体已从 scene 移除 → 解绑
    cleanupStale(alive);
}
```

不耦合 Scene 的 add/remove，动画系统保持独立。

---

## 四、drawSprite 移出 Entity

### Entity 去渲染化

之前 Entity 承担了部分渲染职责：

```js
// 旧 Entity.js
import { get } from '@resource/ResourceManager.js';

export class Entity {
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
}
```

问题：

- Entity 依赖 `ResourceManager`（import get）
- Entity 维护 `_ratios` 缓存（图片比例）
- `drawSprite` 是视觉层逻辑，不应该出现在数据层

移出后：

```js
// 新 Entity.js — 零 import，零渲染
export class Entity {
    maxHp = 100;
    hp = 100;
    id = crypto.randomUUID();
    x = 0; y = 0; w = 0; h = 0;
    speed = 0;
    type = null;
    state = null;

    update(dt) {}
    render(ctx) {}

    getBounds() {
        return { x: this.x, y: this.y, w: this.w, h: this.h };
    }
}
```

`render()` 保留为空方法——Scene.render 仍然遍历调用它，非动画实体（如 Player 画红色矩形）可以 override。但基于贴图的渲染全部归 AnimationSystem。

### drawSprite 迁入 AnimationSystem

比例缓存从实例属性变成模块级 Map：

```js
// AnimationSystem.js 内部
const _ratioCache = new Map();

function drawSprite(ctx, key, x, y, w) {
    const img = get(key);
    if (!img) return false;

    if (!_ratioCache.has(key)) {
        _ratioCache.set(key, img.naturalHeight / img.naturalWidth);
    }
    const h = w * _ratioCache.get(key);

    ctx.drawImage(img, x, y, w, h);
    return true;
}
```

### 渲染入口

直接遍历 animators，从持有的实体引用读坐标：

```js
function renderAnimators(ctx) {
    for (const a of animators.values()) {
        const frame = a.player?.getCurrentFrame();
        if (!frame) continue;
        // entity 不知道被画——动画系统单向读取 x, y, w
        drawSprite(ctx, frame, a.entity.x, a.entity.y, a.entity.w);
    }
}

setAfterEntityRender(renderAnimators);
```

---

## 重构后的架构

### 控制方向

```
Entity（纯逻辑层）
  ├─ state: 'walk'         ← 行为状态
  ├─ x, y, w               ← 位置数据
  └─ update(dt)            ← 逻辑更新
       │
       │  被动读取（实体完全不知道动画存在）
       ▼
AnimationSystem（独立视觉层）
  ├─ animators  ──→ 持有 entity 引用
  ├─ resolveAnim ──→ 读 state → 查 Config → new Player → update
  └─ renderAnimators ──→ 读 x, y → drawSprite → ctx.drawImage
```

单向依赖：AnimationSystem → Entity。Entity 永远不 import 动画相关的东西。

### 完整调用链

```
注册阶段:
  zombieAnimationWalk.js
    → registerAnimation({key, entityType, state, config})
    → Registry: getPhotoPathAsc + setResource + new AnimationConfig + 双 Map

每帧 update:
  tickAnimators(dt)
    ├─ 新实体 → bindEntity(e)          // 持有引用，player=null
    └─ resolveAnim(e, dt)
         ├─ getConfigByState(type, state)  // Registry 一步查
         ├─ state 变 → new AnimationPlayer(config) + reset()
         └─ player.update(dt)              // 独立推进帧

每帧 render:
  Scene.render(ctx)
    ├─ entity.render()                    // 实体自定义（矩形色块等）
    ├─ renderAnimators(ctx)               // 动画帧覆盖
    │    └─ 遍历 animators → player.getCurrentFrame()
    │         → drawSprite(ctx, frame, entity.x, entity.y, entity.w)
    └─ overlayManager.render(ctx)         // UI 最上层
```

### 文件变更总览

| 操作 | 文件 | 说明 |
|------|------|------|
| 新建 | `AnimationConfig.js` | 不可变配置（frames、frameTime、loop） |
| 新建 | `AnimationPlayer.js` | 可变播放状态（每个 animator 独立） |
| 删除 | `Animation.js` | 旧文件，被上面两个替代 |
| 重写 | `AnimationRegistry.js` | 统一入口：帧路径 + 资源 + Config + type/state 映射 |
| 重写 | `AnimationSystem.js` | animator 持有 entity + getConfigByState + new Player + drawSprite 内迁 |
| 简化 | `zombieAnimationWalk.js` | 只传 `{key, entityType, state, config}` |
| 清理 | `Entity.js` | 移除 drawSprite、_ratios、ratio、ResourceManager 依赖 |

---

## 总结

这次重构解决了三个核心问题：

1. **类型分离** — Config/Player 拆分从类型层面杜绝了共享播放状态的 bug
2. **注册收敛** — Registry 一个入口完成四件事，加新动画只需声明参数
3. **控制反转** — Entity 去渲染化，动画系统单向读取实体数据，实体零感知

本质上是在建立**数据驱动动画系统**的清晰边界：Entity 是数据源，AnimationConfig 是模板，AnimationPlayer 是状态机，AnimationSystem 是调度器。四层各司其职，互不越界。

---

## 后续方向

- **动画事件** — Entity 的 state 变化通过 EventBus 通知 AnimationSystem，替代当前每帧轮询 state 的方式
- **bindPosition** — 支持传入 `{x, y}` 而非 entity，用于 UI 特效、爆炸等不绑定实体的动画
- **动画过渡** — Player 切换时加 blend 过渡，而非立即跳帧
- **多个 Player** — 一个实体可能同时播多个动画（如走路 + 武器闪光）

[返回首页](/) | [上一篇](/posts/pvz-game-engine-5) | [GitHub 仓库](https://github.com/myWorldmakerTonyczk/gamePVZ)
