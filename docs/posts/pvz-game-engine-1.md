---
title: 从零搭建PVZ游戏引擎（一）——状态机与主循环
date: 2026-07-02
author: myWorldmakerTonyczk
---

# 从零搭建PVZ游戏引擎（一）——状态机与主循环

作为课程大作业，小组选择了**植物大战僵尸（Plants vs Zombies）Web 版**。技术栈 HTML5 Canvas + JavaScript，无框架手写引擎。我负责 `Service/core/` 下的核心引擎。这篇文章记录第一天搭骨架的过程。

## 一个游戏引擎最少需要什么？

在写代码之前，我先问了自己一个问题：**一个能跑起来的游戏引擎，最基础的三样东西是什么？**

### 1. 状态机（State Machine）

游戏不是"一直在运行"这么简单。它有明确的阶段：

```
开始界面 → 战斗中 → 暂停 → 胜利/失败
```

每个阶段能做什么、不能做什么，必须有一套规则管着——菜单界面不能移动植物、暂停时僵尸不能继续走。

### 2. 游戏主循环（Game Loop）

游戏不像普通网页——用户不点就不动。僵尸前进、子弹飞行、阳光掉落，这些都要**持续运行**。靠的是一个无限循环，每帧：**接收输入 → 更新逻辑 → 渲染画面**。

浏览器提供了 `requestAnimationFrame` 来做这件事——每次屏幕刷新时回调你的函数，形成永不停止的链。

### 3. 对象更新（Entity Update）

植物、僵尸、子弹、阳光……每帧都要更新状态。需要一个统一入口，遍历所有对象，调用各自的 `update()`。

**三者的关系：**

```
状态机 ──决定"现在该不该更新"──→ 主循环 ──调用──→ 对象更新
                                  │
                                  └──→ 渲染画面
```

## hooks：为什么不用硬编码？

最粗暴的写法是在主循环里 `if/else` 判断状态然后调模块。但这是 5 人项目——今天加粒子系统、明天加成就系统，每次都改主循环不现实。

我需要**控制反转**：不是主循环去叫各模块，而是各模块自己注册进来，状态变化时自动被通知。

```javascript
const hooks = {
    onEnter:  {},   // 进入某状态时触发
    onExit:   {},   // 离开某状态时触发
    onUpdate: {},   // 某状态下每帧触发
};
```

本质是一个 **"按游戏状态分类的事件订阅系统"**。经济系统、音效系统、UI 系统各自在初始化时注册回调，状态机不知道它们的存在——零耦合。

在写 hooks 的过程中踩了几个坑：最初用数组 `[label, fn]` 存储，调用时 `h.fn()` 报错，因为 h 是数组不是对象，应改为 `{label, fn}`。这个看起来简单，但反映出 hook 数据结构的选择会直接影响调用方的代码清晰度。另一个问题是 `GameLoop()` 函数写完后没有任何地方调用它——写了死代码。根本原因是 `tick()` 里实际调的是 `update()`，而我把 `switch(currentState)` 分发逻辑写在 `GameLoop()` 里，两个函数各做各的，没人串联。最终把 switch 合并进 `update()`，删掉了 `GameLoop()`。

而 `export let currentState` 初始值是 `undefined` 直接导致 `transition()` 崩溃——`hooks.onExit[undefined]` 取不到任何东西，状态切换第一步就炸了。所以状态机必须有一个确定的初始状态。

更隐蔽的一个问题：写完发现 switch 里五个 case 全是空的 `break;`。原因是我混淆了**框架层**和**钩子层**的职责——`switch` 应该只处理不同状态之间的**差异逻辑**（比如 PLAYING 才推进实体），而公共的钩子分发放在 switch 外面。否则 switch 就是死代码。

还有一个 ES Module 的坑：`import { currentState }` 后在 GameLoop 里写 `currentState = newState`，直接报 `Assignment to constant variable`。即使 State Machine 里声明的是 `export let`，import 方也是只读的。解决办法是原模块导出 `setCurrentState()` 函数，外面调函数修改，不直接赋值。

## 固定时间步长

不同设备刷新率不同（60Hz / 120Hz / 144Hz），如果每帧都跑一次 `update()`，游戏快慢不一致。需要把"真实时间"拆成"固定 16.67ms 的逻辑帧"。

`Math.min(dt, 200)` 的作用：用户切到后台几分钟再回来，dt 可能是几千毫秒，accumulator 瞬间要求跑几百帧，游戏卡死。上限 200ms 防止"时间爆炸"。update 每秒精确 60 次，render 跟着显示器走。

## 完整代码

### State Machine（`Service/core/State Machine.js`）

```javascript
//状态机
export const GameState = {
    START: "Start",    // 开始界面
    PLAYING: "Playing",// 进行中状态
    PAUSED: "Paused",
    WIN: "WIN",
    LOSE: "LOSE"
}

//当前状态
export let currentState = GameState.START;

export function getCurrentState() {
    return currentState;
}

export function setCurrentState(newState) {
    currentState = newState;
}
```

### GameLoop（`Service/core/GameLoop.js`）

```javascript
import { GameState, currentState, setCurrentState, getCurrentState } from './State Machine.js';
export { GameState };

// ==================== 引擎持有的全局引用 ====================

let canvas, ctx;
let world = null;

export function setWorld(w) { world = w; }

// ==================== 帧率控制 ====================

let lastTime = 0;
const FIXED_DT = 1000 / 60; // 16.67ms，锁60帧
let accumulator = 0;

// 启动入口
export function start(_ctx, _canvas) {
    ctx = _ctx;
    canvas = _canvas;
    lastTime = performance.now();
    requestAnimationFrame(tick);
}

function tick(timestamp) {
    const dt = timestamp - lastTime;
    lastTime = timestamp;
    accumulator += Math.min(dt, 200); // 防切后台时间爆炸

    while (accumulator >= FIXED_DT) {
        update(FIXED_DT / 1000);
        accumulator -= FIXED_DT;
    }

    render();
    requestAnimationFrame(tick);
}

// ==================== 每帧逻辑更新 ====================

export function update(dt) {
    // 各模块注册的每帧钩子（Scene 更新也走这里）
    hooks.onUpdate[currentState]?.forEach(h => h.fn(dt));
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    world?.render(ctx);  // 渲染不依赖状态，有 world 就画
}

// ==================== 钩子系统 ====================

export const hooks = {
    onEnter: {},
    onExit: {},
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

// ==================== 状态转换 ====================

export function transition(newState) {
    // 离开旧状态
    hooks.onExit[currentState]?.forEach(h => h.fn());

    const oldState = getCurrentState();
    setCurrentState(newState);

    // 进入新状态
    hooks.onEnter[newState]?.forEach(h => {
        console.log(`[SM] ${oldState} → ${newState}  |  ${h.label}`);
        h.fn();
    });
}
```

## 调用链

```
start() → tick → while(accumulator >= FIXED_DT) → update(dt)
                                                    ├─ hooks.onUpdate[当前状态] → 各模块钩子
                                                    └─ (render 在 while 外面，每帧只画一次)
               → render() → clearRect + world.render(ctx)
               → requestAnimationFrame(tick) → 循环
```

下一篇：[Entity/Scene 模式 + Input + EventBus](/posts/pvz-game-engine-2)
