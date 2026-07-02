---
title: 从零搭建PVZ游戏引擎——状态机与主循环
date: 2026-07-02
author: myWorldmakerTonyczk
---

# 从零搭建PVZ游戏引擎——状态机与主循环

作为课程大作业，我们小组选择了**植物大战僵尸（Plants vs Zombies）Web 版**。技术栈是 HTML5 Canvas + JavaScript + SQL.js。这篇文章记录我负责的**游戏核心引擎**部分的搭建过程。

## 项目架构

分层结构，5 人各司其职：

```
gamePVZ/
├── Data/       ← 数据配置（植物/僵尸数值）
├── Service/    ← JS 游戏逻辑（核心引擎放这）
├── UI/         ← HTML/CSS 页面和动画
├── assets/     ← 图片音效静态资源
├── docs/       ← 文档
└── db/         ← SQLite 数据库
```

我负责 `Service/core/` 下的核心引擎。

---

## 一个游戏引擎最少需要什么？

在写任何代码之前，我先问了自己一个问题：**一个能跑起来的游戏引擎，最基础的三样东西是什么？**

### 1. 状态机（State Machine）

游戏不是"一直在运行"这么简单。它有明确的阶段：

```
开始界面 → 战斗中 → 暂停 → 胜利/失败 → 回到菜单
```

每个阶段能做什么、不能做什么，必须有一套规则管着。这就是状态机——**管理"游戏当前处于什么阶段"**，并控制阶段之间的切换。

比如：
- 菜单界面不能移动植物
- 暂停时僵尸不能继续走
- 胜利后不能再种植物

没有状态机，这些逻辑会散落在各处，变成一锅粥。

### 2. 游戏主循环（Game Loop）

游戏不像普通网页——用户不点就不动。游戏需要**持续运行**：僵尸不断前进、子弹不断飞行、阳光不断掉落。

这靠的是一个无限循环，每帧做三件事：

```
接收输入 → 更新逻辑 → 渲染画面 → 接收输入 → ...
```

浏览器提供了 `requestAnimationFrame` 来做这件事——它会在每次屏幕刷新时回调你的函数，形成永不停止的链。

### 3. 对象更新（Entity Update）

游戏里有植物、僵尸、子弹、阳光……每帧都要更新它们的状态：僵尸往前走了多少？子弹打到僵尸了吗？植物还活着吗？

需要一个统一的入口，每帧遍历所有对象，调用各自的 `update()`。

---

**三者的关系：**

```
状态机 ──决定"现在该不该更新"──→ 主循环 ──调用──→ 对象更新
                                  │
                                  └──→ 渲染画面
```

举个例子：
- 状态机说现在是 `PLAYING` → 主循环每帧调用所有僵尸的 `update()` → 僵尸往前移动
- 玩家点了暂停 → 状态机切成 `PAUSED` → 主循环跳过 `update()`，僵尸原地不动，但画面继续渲染

---

搞清楚了这三样东西，问题就来了：**它们之间怎么通信？**

## 状态怎么通知其他模块？

最 naive 的写法是在主循环里硬编码：

```javascript
function update(dt) {
    if (currentState === PLAYING) {
        world.update(dt);
        economy.update(dt);
        audio.playBgm();
        ui.showHud();
    }
}
```

这有什么问题？每加一个模块，就要改主循环代码。5 个人的项目，今天成员 4 加一个粒子系统，明天成员 5 加一个成就系统，难道每次都让组长改 `update()`？这不现实。

我需要的是**控制反转**：不是主循环去叫各个模块，而是**各个模块自己注册进来，状态变化时自动被通知**。

这就是 hooks 的由来。

## hooks 结构是什么？

`GameLoop.js` 里最核心的是这个 hooks 对象：

```javascript
const hooks = {
    onEnter: {},
    onExit: {},
    onUpdate: {}
};
```

本质上是一个 **"按游戏状态分类的事件订阅系统"**。

Java 里等价于：

```java
Map<GameState, List<Runnable>>
```

实际运行时的结构：

```javascript
onEnter = {
    PLAYING: [fn1, fn2],  // 进入 PLAYING 时要调的所有函数
    PAUSED:  [fn3]
}
```

| 类型 | 触发时机 | 例子 |
|------|----------|------|
| `onEnter` | 进入某个状态时 | 进入 PLAYING → 播放 BGM、显示 HUD |
| `onExit` | 离开某个状态时 | 离开 PLAYING → 暂停 BGM、隐藏 HUD |
| `onUpdate` | 当前状态下每一帧 | PLAYING 每帧 → 移动僵尸、检测碰撞 |

理解关键——不是"UI 属于 PLAYING 状态"，而是**"进入 PLAYING 时要通知 UI 系统"**：

```javascript
onEnter(PLAYING, "UI", showUI);
onEnter(PLAYING, "Music", playBgm);
```

**状态机不知道有哪些模块存在。** 经济系统、音效系统、UI 系统各自在初始化时注册回调，状态切换时状态机遍历调用即可。各模块之间零耦合。

---

## 踩坑实录

### 第一回合：数组 vs 对象

最初存储钩子用的是数组：

```javascript
hooks.onEnter[state].push([label, fn]);
```

调用时：

```javascript
hooks.onEnter[newState]?.forEach(h => h.fn());
```

直接报错——`h` 是数组 `[label, fn]`，根本没有 `.fn` 属性。正确写法应该是 `h[1]()`。更恶心的是，代码里三处混用了 `h.fn()`、`h[1].fn()`、`h[1]()`，全部不一致。

**解决方案**：统一改成对象存储，语义清晰：

```javascript
// 存储
hooks.onEnter[state].push({ label, fn });

// 调用
hooks.onEnter[state]?.forEach(h => h.fn());
```

### 第二回合：死代码——写完的 GameLoop 从来没被调用

我写了一个 `GameLoop()` 函数，里面有 `switch(currentState)` 分发逻辑：

```javascript
function GameLoop() {
    switch (currentState) {
        case GameState.START:   break;
        case GameState.PLAYING: break;
        // ...
    }
    hooks.onUpdate[currentState]?.forEach(h => h.fn(dt));
}
```

但主循环 `tick()` 里调的是另一个叫 `update()` 的函数，`GameLoop()` 根本没人调——死代码。

**解决方案**：把 switch 逻辑合并进 `update()`，删掉 `GameLoop()`：

```javascript
function update(dt) {
    switch (currentState) {
        case GameState.START:   break;
        case GameState.PLAYING: break;
        case GameState.PAUSED:  break;
        case GameState.WIN:     break;
        case GameState.LOSE:    break;
    }
    hooks.onUpdate[currentState]?.forEach(h => h.fn(dt));
}
```

### 第三回合：`currentState` 初始值是 undefined

```javascript
export let currentState; // undefined！
```

`transition()` 第一行读 `hooks.onExit[currentState]`，`currentState` 是 `undefined`，直接炸。

**解决方案**：

```javascript
export let currentState = GameState.START;
```

---

## 核心概念逐个拆解

以下是我写引擎过程中逐个搞懂的概念，记录在这里。

### fn 是什么？JS 里函数就是变量

```javascript
function hello() {
    console.log("hi");
}

onEnter(PLAYING, "test", hello);  // 传函数本体
//                         ^^^^^ 注意没有括号
// hello → 传函数，hello() → 立即执行
```

Java 对比：

```java
Runnable fn = () -> {};
```

### push 是什么？

数组追加元素，等价于 Java 的 `list.add(fn)`：

```javascript
const arr = [];
arr.push(1);
arr.push(2);
// 结果：[1, 2]
```

### transition 做什么？

只做一件事——**切换 GameState**：

```
onExit(旧状态) → currentState = 新状态 → onEnter(新状态)
```

```javascript
export function transition(newState) {
    hooks.onExit[currentState]?.forEach(h => h.fn());
    const oldState = currentState;
    currentState = newState;
    hooks.onEnter[newState]?.forEach(h => {
        console.log(`[SM] ${oldState} → ${newState}  |  ${h.label}`);
        h.fn();
    });
}
```

### `hooks.onExit[current]?.forEach(...)` 逐字拆解

1. `hooks.onExit[currentState]` — 找到当前状态的退出函数列表
2. `?.` — 可选链，不存在就不执行（防空指针）
3. `forEach(h => h.fn())` — 遍历执行每一个回调

Java 等价：

```java
List<Runnable> list = map.get(state);
if (list != null) {
    for (Runnable r : list) {
        r.run();
    }
}
```

### dt 是什么？

**距离上一帧经过的时间（秒）**。核心作用：让游戏不依赖帧率。

```javascript
position += speed * dt;
```

不管 60Hz 屏幕还是 144Hz，物体移动速度一致。`dt` 就是**时间校准器**。

### requestAnimationFrame 是什么？

浏览器帮你执行"下一帧回调"，等价于：

```java
while (true) {
    update();
}
```

JS 写法：

```javascript
function loop(time) {
    update();
    requestAnimationFrame(loop);  // 注册自己，形成永动
}
```

特点：和屏幕刷新同步；页面切后台自动暂停。

### 固定时间步长（最难的一段）

`accumulator + while(FIXED_DT)` 到底在干嘛？

**本质：把"真实时间"拆成"固定 16.67ms 的游戏逻辑帧"。**

不同设备刷新率不同（60Hz / 120Hz / 144Hz），如果每帧都跑一次 `update()`，游戏快慢不一致。

```javascript
const FIXED_DT = 1000 / 60; // 16.67ms，锁60帧逻辑
let accumulator = 0;

function tick(timestamp) {
    const dt = timestamp - lastTime;
    lastTime = timestamp;
    accumulator += Math.min(dt, 200); // 累加真实时间，上限 200ms 防跳帧

    while (accumulator >= FIXED_DT) {
        update(FIXED_DT / 1000);      // 吃满一个固定时间片才更新
        accumulator -= FIXED_DT;
    }

    render();                          // 渲染跟屏幕走，画面丝滑
    requestAnimationFrame(tick);
}
```

`Math.min(dt, 200)` 的作用：用户切到后台几分钟再回来，dt 可能是几千毫秒，accumulator 会瞬间要求跑几百帧，游戏卡死。上限 200ms 防止"时间爆炸"。

效果：`update()` 每秒**恰好 60 次**，`render()` 跟着显示器走，画面流畅，逻辑步调一致。

---

## 当前完整代码

### State Machine（`Service/core/State Machine.js`）

```javascript
export const GameState = {
    START:   "Start",
    PLAYING: "Playing",
    PAUSED:  "Paused",
    WIN:     "WIN",
    LOSE:    "LOSE"
};

export let currentState = GameState.START;

export function getCurrentState() {
    return currentState;
}
```

### GameLoop（`Service/core/GameLoop.js`）

```javascript
import { GameState } from './State Machine.js';
import { currentState } from './State Machine.js';

let lastTime = 0;
const FIXED_DT = 1000 / 60;
let accumulator = 0;

export function start() {
    lastTime = performance.now();
    requestAnimationFrame(tick);
}

function tick(timestamp) {
    const dt = timestamp - lastTime;
    lastTime = timestamp;
    accumulator += Math.min(dt, 200);

    while (accumulator >= FIXED_DT) {
        update(FIXED_DT / 1000);
        accumulator -= FIXED_DT;
    }

    render();
    requestAnimationFrame(tick);
}

export function update(dt) {
    switch (currentState) {
        case GameState.START:   break;
        case GameState.PLAYING: break;
        case GameState.PAUSED:  break;
        case GameState.WIN:     break;
        case GameState.LOSE:    break;
    }
    hooks.onUpdate[currentState]?.forEach(h => h.fn(dt));
}

function render() {
    // Canvas 绘制（待实现）
}

export const hooks = {
    onEnter:  {},
    onExit:   {},
    onUpdate: {},
};

export function onEnter(state, label, fn) {
    if (!hooks.onEnter[state]) hooks.onEnter[state] = [];
    hooks.onEnter[state].push({ label, fn });
}

export function onExit(state, label, fn) {
    if (!hooks.onExit[state]) hooks.onExit[state] = [];
    hooks.onExit[state].push({ label, fn });
}

export function onUpdate(state, label, fn) {
    if (!hooks.onUpdate[state]) hooks.onUpdate[state] = [];
    hooks.onUpdate[state].push({ label, fn });
}

export function transition(newState) {
    hooks.onExit[currentState]?.forEach(h => h.fn());
    const oldState = currentState;
    currentState = newState;
    hooks.onEnter[newState]?.forEach(h => {
        console.log(`[SM] ${oldState} → ${newState}  |  ${h.label}`);
        h.fn();
    });
}
```

---

## 总结：引擎骨架的调用链

```
index.html
  └─ <script type="module">
       import { start } from './Service/core/GameLoop.js'
       start()                              ← 唯一一次手动调用
            │
            └─ requestAnimationFrame(tick)
                 │
                 ├─ update(dt)
                 │    ├─ switch(currentState)  ← 引擎自身逻辑
                 │    └─ hooks.onUpdate        ← 各模块注册的钩子
                 ├─ render()
                 └─ requestAnimationFrame(tick)  ← 循环
```

| 概念 | 一句话 |
|------|--------|
| 状态机 | 管理游戏阶段，控制什么能做什么不能做 |
| 主循环 | `requestAnimationFrame` 驱动的心跳，永不停歇 |
| hooks | 按状态分类的回调订阅表，模块自己注册自己 |
| transition | 离开旧状态 → 进入新状态，通知所有订阅者 |
| dt | 时间校准器，让游戏不依赖帧率 |
| 固定时间步长 | 把真实时间切成固定 16.67ms 逻辑帧 |

下一步：创建 `index.html` 入口文件，浏览器打开让骨架跑起来，然后往 `update()` 的 switch 里填具体的游戏逻辑。

[返回首页](/) | [GitHub 仓库](https://github.com/myWorldmakerTonyczk/gamePVZ)
