---
title: 从零搭建PVZ游戏引擎（七）——实体行为系统设计：组件化脚本 + EventBus驱动 + 四层解耦
date: 2026-07-05
author: myWorldmakerTonyczk
series: 从零搭建PVZ游戏引擎
seriesOrder: 7
---

# 从零搭建PVZ游戏引擎（七）——实体行为系统设计：组件化脚本 + EventBus驱动 + 四层解耦

> GitHub 仓库：[https://github.com/myWorldmakerTonyczk/gamePVZ](https://github.com/myWorldmakerTonyczk/gamePVZ)

[上一篇](/posts/pvz-game-engine-6) 重构了动画系统的架构。动画做完之后，自然要回答下一个问题：实体什么时候从走路切换成攻击？什么时候死亡？这个"行为切换"的逻辑应该放在哪？

---

## 一、问题：行为的切换逻辑写在哪

当前 Zombie 只有一个裸 `update`：

```js
// Zombie.js — 现在
update(dt) {
    this.x -= this.speed * dt;   // 永远走路
}
```

但实际游戏里 Zombie 有多种行为：走路、攻击、死亡。这些行为之间需要切换——碰到玩家就攻击、hp 归零就死亡、攻击结束恢复走路。

这个切换逻辑如果写在 Entity 里，很快就会变成：

```js
// 本能反应是这么写——但会爆炸
update(dt) {
    if (this.hp <= 0) {
        this.state = 'dead';
        // 死亡逻辑...
    } else if (this.nearPlayer()) {
        this.state = 'attack';
        // 攻击逻辑...
    } else {
        this.state = 'walk';
        // 走路逻辑...
    }
}
```

一个实体还好，所有实体都这样写，每个类的 `update` 都是一大坨 if-else，而且行为之间的转换规则散落各地，改一个条件要翻十几个文件。

动画系统的经验告诉我们：**Entity 不应该管"什么时候干什么"，它只应该管"怎么干"。**

---

## 二、从三层到组件化

最初设想的是三层架构：Entity 能力层 → 行为生命周期 → BehaviorController 决策层。但随着讨论深入，逐渐发现这个思路本质上就是在往**组件化（Component-based）**方向走。

组件化的核心思想：实体是一组独立脚本的集合，每个脚本只做一件事，脚本之间通过 EventBus 通信，可以任意拆装组合。

```
僵尸 = Entity
        ├── MoveScript        "每帧向左走"
        ├── HealthScript      "hp≤0 触发死亡"
        ├── AttackScript      "碰到玩家造成伤害"
        └── AnimComponent     "state 变化 → 切动画"（已有）

向日葵 = Entity
          ├── HealthScript    （复用）
          ├── SunProducer     "定时产生阳光"
          └── AnimComponent   （复用）
```

HealthScript 和 AnimComponent 僵尸和向日葵共用，不用写两遍。加一个新能力就是加一个新脚本文件，不改任何旧代码。

---

## 三、一个脚本长什么样

**每个脚本写成 `{ enter, update, exit }` 三段式**。即使用了 update，预留 enter/exit 也是好的：

```js
// MoveScript.js
export const MoveScript = {
    enter(entity) {
        entity.speed = 50;              // 初始化速度
    },

    update(entity, dt) {
        if (entity.state !== 'walk') return;  // 不是走路状态 → 不做事
        entity.x -= entity.speed * dt;
    },

    exit(entity) {
        // 走路结束，无特殊清理
    },
};
```

**enter/exit 是脚本的挂载/卸载**，不是状态切换回调。最重要的 cleanup 在 exit 里——注销 EventBus 监听：

```js
// AttackScript.js
export const AttackScript = {
    enter(entity) {
        // 注册碰撞监听
        eventBus.on(EventTypes.COLLISION, this._onCollision);

        // 保存引用以便 exit 时注销
        entity._attackHandlers = { onCollision: this._onCollision };
    },

    _onCollision({ a, b }) {
        if (a.type !== EntityType.ENEMY) return;
        if (b.type !== EntityType.PLAYER) return;

        // 通知其他脚本 + 切 state
        eventBus.emit(EventTypes.STOP_MOVE, { entity: a });
        a.state = 'attack';            // ← 动画系统自动感知
    },

    update(entity, dt) {},  // 纯事件驱动，无 update

    exit(entity) {
        // ⚠️ 关键：注销监听，防止实体销毁后事件仍触发
        const h = entity._attackHandlers;
        if (h) {
            eventBus.off(EventTypes.COLLISION, h.onCollision);
        }
    },
};
```

exit 里的事件注销是最容易漏的——僵尸死了但 COLLISION 监听还在，下次碰撞事件触发时崩一片。

---

## 四、脚本之间怎么通信

### 两条通道，各司其职

```
通道 1：entity.state（共享数据）       通道 2：EventBus（事件链）
─────────────────────────────         ──────────────────────────
读写数据，多脚本共享                  跨脚本通知，隐式调用链

MoveScript 读 state 决定行为          AttackScript emit STOP_MOVE
HealthScript 写 state='dead'          MoveScript on STOP_MOVE → 停步
AnimationSystem 读 state → 切帧        HealthScript on DAMAGE → 扣血
```

### 协调方式：事件驱动，而非集中管控

讨论时纠结过两种方案：

| | A. 集中协调 | B. 事件驱动 |
|---|---|---|
| 样子 | ScriptSystem 里有一个大的决策表 | 每个脚本自己监听 EventBus |
| 加新脚本 | 改 System | 不改任何旧代码 |
| 排错 | 一个地方看所有转换 | 链条跨多个文件 |
| 执行顺序 | 显式控制 | 取决于监听顺序 |

**最终选 B——事件驱动**。扩展性强：加一个 DropLootScript 监听 `ENTITY_DIED`，HealthScript 一行不用改。

关键约束：**脚本不指定"下一个脚本是谁"**。脚本只做两件事——读/写 `entity.state` 和收发 EventBus 事件。脚本之间不互相 import、不互相调用、不互相知道对方存在。

### 一个完整的事件链

```
AttackScript 检测到碰撞
    │
    ├─→ entity.state = 'attack'        ← 动画系统自动切攻击动画
    │
    └─→ emit('entity:stopMove', { entity })
            │
            └─→ MoveScript 监听到 → 暂停移动

HealthScript 监听到 DAMAGE 事件
    │
    ├─→ entity.hp -= 10
    │
    ├─→ entity.state = 'hurt'          ← 动画系统切受伤动画
    │
    └─→ if (hp <= 0):
          ├─→ entity.state = 'dead'    ← 动画系统切死亡动画
          └─→ emit('entity:died', { entity })
                  │
                  ├─→ DeathScript → 延迟移除实体
                  └─→ DropLootScript → 掉落物品（将来加，不影响上面任何一行）
```

---

## 五、ScriptSystem —— 机械调度器

ScriptSystem 不管逻辑决策，只做机械调度。它和 GameLoop 挂钩，负责两件事：挂载时调 enter、每帧调 update、卸载时调 exit。

```js
// ScriptSystem — 纯机械，不参与任何逻辑决策
onUpdate(GameState.PLAYING, 'ScriptSystem', (dt) => {
    for (const entity of scene.getEntities()) {
        for (const script of entity._scripts) {
            script.update(entity, dt);
        }
    }
});
```

### 执行顺序问题

事件驱动时脚本的执行顺序不确定。需要显式控制时，用**阶段（stage）**分组：

```js
const STAGES = ['INPUT', 'LOGIC', 'EFFECT', 'CLEANUP'];

for (const stage of STAGES) {
    for (const script of entity._scripts) {
        if (script.stage === stage) {
            script.update(entity, dt);
        }
    }
}
```

```js
// HealthScript 在 LOGIC 阶段扣血
export const HealthScript = { stage: 'LOGIC', update(entity, dt) { ... } };

// DeathScript 在 EFFECT 阶段播动画
export const DeathScript = { stage: 'EFFECT', update(entity, dt) { ... } };
```

同一个事件链，但执行顺序是确定的——LOGIC 阶段所有脚本先跑完，再跑 EFFECT 阶段。

---

## 六、EventBus 调试追踪

事件驱动最大的痛点是隐式调用链——很难追踪"这个事件是谁发的、谁在听"。三个改动，加起来不超过 10 行：

### 1. emit 内置日志

```js
// EventBus.js — 生产环境关掉 DEBUG
const DEBUG = true;

emit(event, data, source = 'unknown') {
    if (DEBUG) console.log(`[EventBus] ▶ ${event}  ← ${source}`, data);

    const list = this.events[event];
    if (!list) return;
    list.forEach(fn => fn(data));
}
```

控制台立刻变成可读的事件链：

```
[EventBus] ▶ collision        ← AttackScript   {a: Zombie#a3f, b: Player#b2e}
[EventBus] ▶ enemy:damaged    ← AttackScript   {entity: Zombie#a3f, damage: 10}
[EventBus] ▶ entity:stopMove  ← AttackScript   {entity: Zombie#a3f}
[EventBus] ▶ entity:died      ← HealthScript   {entity: Zombie#a3f}
```

不用打断点，不用到处加 console.log，控制台就是完整的时序追踪器。

### 2. 调用时传 source

```js
eventBus.emit('enemy:damaged', { entity, damage: 10 }, 'AttackScript');
eventBus.emit('entity:stopMove', { entity }, 'HealthScript');
```

追 bug 时看到异常事件链，直接定位是哪个脚本发的。

### 3. 全局开关

开发时 `DEBUG = true`，打包时改 `false`。一个开关控制全部事件日志。

---

## 七、四层最终架构

经过讨论后确定的完整架构：

```
┌──────────────────────────────────────────┐
│  ScriptSystem（调度层）                    │
│  机械调度，按 stage 分组跑 enter/update/exit │
│  和 GameLoop 挂钩                          │
└──────────────┬───────────────────────────┘
               │
    ┌──────────┴──────────┐
    │                     │
    ▼                     ▼
┌──────────────┐  ┌──────────────────┐
│  entity.state │  │  EventBus（事件层）│
│  共享数据      │  │  脚本间通信        │
│  脚本写        │  │  emit / on / off  │
│  动画读        │  │  + 调试日志        │
└──────┬───────┘  └────────┬─────────┘
       │                   │
       └────────┬──────────┘
                │ 每个脚本独立读/写/监听
                ▼
┌──────────────────────────────────────────┐
│  脚本集合（组件层）                         │
│  { enter, update, exit, stage }            │
│  MoveScript / AttackScript / HealthScript  │
│  彼此不 import、不调用、不知道对方存在        │
└──────────────┬───────────────────────────┘
               │ 脚本读写 entity 的属性
               ▼
┌──────────────────────────────────────────┐
│  Entity（数据层）                          │
│  x, y, w, h, hp, maxHp, speed, state      │
│  纯数据 + 纯方法，不持有任何脚本逻辑          │
│  完全不知道脚本、动画、EventBus 的存在        │
└──────────────────────────────────────────┘
```

四层各司其职：

| 层 | 职责 | 依赖方向 |
|---|---|---|
| ScriptSystem | 调度脚本的 enter/update/exit | → 读场景实体列表 |
| EventBus + state | 通信基础设施 | 独立，不依赖任何层 |
| 脚本（Component） | 具体行为逻辑 | → 读 entity 属性，收发 EventBus |
| Entity | 纯数据 | 独立，不 import 任何上层 |

依赖全部向下——Entity 不知道脚本存在，脚本不知道 System 存在。加一个脚本不影响任何已有代码。

---

## 八、后续设计决策记录

### 为什么 enter/exit 不是 state 切换回调

state 切换是"行为在变"，enter/exit 是"脚本的生命周期"。一个脚本可能被挂载到实体上使用很久（从创建到销毁），但这期间 state 会变很多次。`MoveScript` 挂载一次，`update` 里通过 `if state !== 'walk' return` 来响应 state 变化，而不是每次 state 变化都重新挂载。

**exit 最重要的职责是 `eventBus.off`**——实体销毁时清理所有监听，防止悬空事件。

### 为什么不选集中式 ScriptSystem

集中式一个大的决策表确实简单且容易排错，但每次新增跨实体的交互逻辑都要改 System。事件驱动每个脚本独立，加新脚本不影响旧代码，代价是排错时需要看事件链日志——这个问题通过 EventBus 的 DEBUG 日志解决。

### 动画系统完全不改动

AnimationSystem 已经在读 `entity.state`，脚本改 state → AnimationSystem 自动感知。两套系统通过 `entity.state` 对接，零耦合，各改各的。

---

## 九、后续方向

下次实现脚本系统时带着这些讨论结果开始写代码。当前项目已经做好了所有准备：

- EventBus 已有 COLLISION 等事件
- AnimationSystem 已经监听 state 变化
- Entity 已经是纯数据层
- 动画系统已经解耦完毕

加入 ScriptSystem 和第一批脚本（MoveScript、AttackScript、HealthScript）不需要改动任何现有模块。

[返回首页](/) | [上一篇](/posts/pvz-game-engine-6) | [GitHub 仓库](https://github.com/myWorldmakerTonyczk/gamePVZ)
