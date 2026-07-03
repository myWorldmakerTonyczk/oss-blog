---
title: 从零搭建PVZ游戏引擎（二）——Entity/Scene、Input 与 EventBus
date: 2026-07-02
author: myWorldmakerTonyczk
---

# 从零搭建PVZ游戏引擎（二）——Entity/Scene、Input 与 EventBus

[上一篇](/posts/pvz-game-engine-1) 搭好了状态机 + 主循环骨架。有了心跳，接下来要让东西出现在画面上，并且能交互。

## Entity 基类 + Scene 容器

所有游戏对象（植物、僵尸、子弹、阳光）都需要位置、更新逻辑、绘制方法。抽一个基类：

```javascript
export class Entity {
    x = 0;
    y = 0;
    update(dt) {}    // 子类覆写：移动、攻击、死亡判定
    render(ctx) {}   // 子类覆写：画自己
}
```

Scene 是容器，管着所有实体，每帧遍历：
 
```javascript
export class Scene {
    entities = [];
    add(e)    { this.entities.push(e); }
    update(dt){ this.entities.forEach(e => e.update(dt)); }
    render(ctx){ this.entities.forEach(e => e.render(ctx)); }
}
```

**为什么不用 EntityManager？** 最初写了一个 EntityManager 类来"总管所有实体"，但命名抽象（"管家"），中文组员理解成本高。改成 Entity/Scene 后一目了然——"场景里有一堆东西"。这个改名是 5 人协作的教训：命名要贴近直觉而非设计模式。

Scene 通过 hook 注册到引擎，不硬编码在 GameLoop 里：

```javascript
// Scene.js 模块级注册
onUpdate(GameState.PLAYING, 'Scene', (dt) => {
    scene.update(dt);
});
```

GameLoop 只通过 `setWorld(scene)` 知道"要渲染谁"，不关心世界里有几个实体。引擎层和业务层解耦。

## 键盘输入：isAction vs isJustPressed

输入系统监听 `keydown`/`keyup`，维护按键状态表。关键设计是两种查询函数：

```javascript
// 持续检测——按住期间一直返回 true
isAction('left')   // 适合移动

// 防抖检测——只在按下的第一帧返回 true
isJustPressed('pause')  // 适合暂停、开火
```

`KEY_MAP` 把方向键和 WASD 统一到同一个动作名：

```javascript
const KEY_MAP = {
    ArrowLeft: "left",  KeyA: "left",
    ArrowRight:"right", KeyD: "right",
    ArrowUp:   "up",    KeyW: "up",
    ArrowDown: "down",  KeyS: "down",
    Space: "fire",      KeyP: "pause",
};
```

调用方只关心动作名，不关心物理键位。

## EventBus 事件总线

随着模块增多，如果互相 import——`economy.js` import `zombie.js`、`zombie.js` import `collision.js`、`collision.js` import `plant.js`——很快就是循环依赖地狱。

解决方案：发布-订阅模式。各模块只依赖 EventBus，通过事件通信。僵尸死亡时发事件，经济系统听到后加阳光，两者零耦合。

## 遇到的问题

### Canvas 谁来管？

一开始引擎不知道自己要在哪个画布上画——GameLoop 里 `const ctx = null` 定死了，start 时参数又和外层变量同名，`ctx = ctx` 是自己赋自己，外层永远 null。更折腾的是中间有一版我让引擎自己去 `document.getElementById('canvas')` 找画布，但 HTML 里 id 是 `'game'`，ID 写错了直接崩。

最终方案：main.js 拿到 canvas 后通过参数传给 start，引擎不碰 DOM。引擎的职责是画，不是找画布在哪。参数名用 `_ctx` / `_canvas` 区分模块变量，避免遮蔽。

### 状态切换频率 = 输入检测频率？

PauseSystem 最初用 `isAction('pause')` 检测。按一下 P 约 200ms，期间跑了 ~12 帧，每帧都检测到键按着 → 每帧切一次状态：PLAYING → PAUSED → PLAYING → PAUSED → ... 疯狂翻跳，最终停在哪个状态全看运气。

问题本质是**输入检测频率**和**状态切换频率**没有对齐——`isAction` 返回的是"当前是否按着"，每帧都触发；而暂停切换需要的是"按下的那一瞬间"。

解决：拆成两种接口——`isAction` 持续检测（移动），`isJustPressed` 读一次清零（暂停、开火）。

### render 被调了两次

有段时间 `update()` 里也调了 `render()`，`tick()` 里也调了 `render()`。而且 `update()` 在 while 循环里——如果 accumulator 积了两帧，render 会被调三次。

问题本质是没想清楚 update 和 render 的边界：**update 在逻辑循环里追赶时间差，render 在循环外面跟屏幕走**。render 只该出现在 tick 里一次。

### EntityManager 为什么改名

最初写了一个 EntityManager 来"总管所有实体"，但命名太抽象。改成 Entity 基类 + Scene 容器后，中文组员一眼懂——"场景里有一堆东西"。5 人协作的教训：命名要贴近直觉。

## 完整代码

### Entity 基类（`Service/Entity/Entity.js`）

```javascript
export class Entity {
    x = 0;
    y = 0;
    width = 0;
    height = 0;

    update(dt) {}
    render(ctx){}

    getBounds() {
        return { x: this.x, y: this.y, w: this.width, h: this.height };
    }
}
```

### Scene 容器（`Service/Entity/Scene.js`）

```javascript
import { onUpdate } from '../core/GameLoop.js';
import { GameState } from '../core/State Machine.js';

export class Scene {
    entities = [];

    add(e){
        this.entities.push(e);
    }

    update(dt){
        for(const e of this.entities){
            e.update(dt);
        }
    }

    del(e){
        this.entities = this.entities.filter(entity => entity !== e);
    }

    clear(){
        this.entities = [];
    }

    render(ctx){
        for(const e of this.entities){
            e.render(ctx);
        }
    }
}

export const scene = new Scene();

// Scene 在 PLAYING 状态下每帧更新自身
onUpdate(GameState.PLAYING, 'Scene', (dt) => {
    scene.update(dt);
});
```

### Box 测试方块（`Service/Entity/pojo/Box.js`）

```javascript
import { Entity } from '../Entity.js';

export class Box extends Entity {
    update(dt){
        this.x += 50 * dt;
    }
    render(ctx){
        ctx.fillRect(this.x, this.y, 20, 20);
    }
    getBounds() {
        return { x: this.x, y: this.y, w: 20, h: 20 };
    }
}
```

### Player 玩家方块（`Service/Entity/pojo/player.js`）

```javascript
import { Entity } from "../../Entity/Entity.js";
import { isAction } from "../../Input/Input.js";

export class Player extends Entity {
    speed = 200;
    x = 0;
    y = 0;
    width = 20;
    height = 20;

    update(dt) {
        this.keyBoardMove(dt);
    }

    render(ctx){
        ctx.fillStyle = 'red';
        ctx.fillRect(this.x, this.y, 20, 20);
    }

    getBounds() {
        return { x: this.x, y: this.y, w: this.width, h: this.height };
    }

    keyBoardMove(dt_) {
        if(isAction("left"))  this.x -= this.speed * dt_;
        if(isAction("right")) this.x += this.speed * dt_;
        if(isAction("up"))    this.y -= this.speed * dt_;
        if(isAction("down"))  this.y += this.speed * dt_;
    }
}
```

### 键盘输入（`Service/Input/Input.js`）

```javascript
//记录按键状态
export const keyState = {
    keys: {},
};

const _justPressed = {};  // 只在按下的第一帧为 true

window.addEventListener("keydown", function(e) {
    if (!keyState.keys[e.code]) {   // 真正的新按下（排除系统按键重复）
        _justPressed[e.code] = true;
    }
    keyState.keys[e.code] = true;
});

window.addEventListener("keyup", function(e) {
    keyState.keys[e.code] = false;
});

export const KEY_MAP = {
    ArrowLeft: "left",  ArrowRight: "right",
    ArrowUp: "up",      ArrowDown: "down",
    KeyW: "up",         KeyA: "left",
    KeyS: "down",       KeyD: "right",
    Space: "fire",      KeyP: "pause"
};

export function isAction(action) {
    for (const [code, name] of Object.entries(KEY_MAP)) {
        if (name === action && keyState.keys[code]) return true;
    }
    return false;
}

// 只在按下的第一帧返回 true，之后持续按住也不会重复触发
export function isJustPressed(action) {
    for (const [code, name] of Object.entries(KEY_MAP)) {
        if (name === action && _justPressed[code]) {
            _justPressed[code] = false;  // 读一次就清零
            return true;
        }
    }
    return false;
}
```

### EventBus（`Service/core/EventBus.js`）

```javascript
export class EventBus {
    events = {};

    //监听
    on(event, fn){
        if(!this.events[event]){
            this.events[event] = [];
        }
        this.events[event].push(fn);
    }

    //触发
    emit(event, data){
        const list = this.events[event];
        if (!list) return;
        list.forEach(fn => fn(data));
    }

    //移除监听
    off(event, fn) {
        const list = this.events[event];
        if (!list) return;
        this.events[event] = list.filter(f => f !== fn);
    }
}

export const eventBus = new EventBus();
```

### 暂停系统（`Service/system/PauseSystem.js`）

```javascript
import { onUpdate, transition } from '../core/GameLoop.js';
import { GameState, getCurrentState } from '../core/State Machine.js';
import { isJustPressed } from '../Input/Input.js';

export function initPauseSystem() {
    const toggle = () => {
        if (!isJustPressed('pause')) return;
        const s = getCurrentState();
        if (s === GameState.PLAYING) transition(GameState.PAUSED);
        else if (s === GameState.PAUSED) transition(GameState.PLAYING);
    };
    onUpdate(GameState.PLAYING, 'Pause', toggle);
    onUpdate(GameState.PAUSED,  'Pause', toggle);
}
```

### 入口文件（`main.js`）

```javascript
import { scene } from './Service/Entity/Scene.js';
import { Box } from './Service/Entity/pojo/Box.js';
import { Player } from './Service/Entity/pojo/player.js';
import { start, setWorld, transition, GameState } from './Service/core/GameLoop.js';
import { initPauseSystem } from './Service/system/PauseSystem.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// 创建场景 + 加实体
const box = new Box();
box.x = 50;
box.y = 200;
scene.add(box);

const player = new Player();
player.x = 100;
player.y = 100;
scene.add(player);

// 告诉引擎当前世界
setWorld(scene);

// 初始化系统
initPauseSystem();

// 启动
transition(GameState.PLAYING);
start(ctx, canvas);
```

## 调用流

```
main.js
  ├─ setWorld(scene)                    ← 告诉引擎世界是谁
  ├─ initPauseSystem()                  ← 注册暂停钩子
  └─ transition(PLAYING) → start()
         │
         ▼
      tick()
       ├─ update(dt)
       │    └─ hooks.onUpdate[当前状态]
       │         ├─ Scene  → scene.update(dt) → 遍历所有实体
       │         └─ Pause → isJustPressed → PLAYING ↔ PAUSED
       └─ render()
            └─ clearRect + world.render(ctx)
```

下一步：子弹实体 + 碰撞检测系统。

[返回首页](/) | [上一篇](/posts/pvz-game-engine-1) | [GitHub 仓库](https://github.com/myWorldmakerTonyczk/gamePVZ)
