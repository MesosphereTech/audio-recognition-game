# 身临其境 - 音频识别游戏

一个基于音频识别和分析的互动游戏，玩家通过录制不同物品的声音来完成挑战。

## 功能特点

- 🎤 实时音频录制和分析
- 🔊 智能音频特征识别
- 🎮 多关卡游戏模式
- 📊 详细的音频波形和音量可视化
- 🎵 丰富的音效和背景音乐系统
- 📱 响应式界面设计

## 游戏玩法

1. 选择关卡和物品
2. 录制指定物品的声音
3. 系统分析音频特征（音量、音调变化、节奏等）
4. 根据分析结果获得分数
5. 解锁新关卡和挑战

## 技术栈

- **前端**: 原生 JavaScript + HTML5 + CSS3
- **音频处理**: Web Audio API
- **录音功能**: MediaRecorder API
- **可视化**: Canvas API

## 文件结构

```
├── index.html          # 主页面
├── app.js              # 应用主控制器
├── game.js             # 游戏逻辑
├── audio.js            # 音频管理和分析
├── menu.js             # 菜单系统
├── data.js             # 游戏数据配置
├── levels.js           # 关卡配置
├── styles.css          # 样式文件
├── GDD.md              # 游戏设计文档
└── assets/             # 资源文件
    ├── audio/          # 音频文件
    ├── video/          # 视频文件
    └── ui/             # UI资源
```

## 快速开始

1. 克隆仓库
```bash
git clone [repository-url]
cd 身临其境
```

2. 打开项目
- 直接在浏览器中打开 `index.html`
- 或使用本地服务器（推荐）

3. 允许浏览器访问麦克风权限

## 浏览器兼容性

- Chrome 66+ （推荐）
- Firefox 60+
- Safari 11.1+
- Edge 79+

*注意：需要 HTTPS 或 localhost 环境才能使用麦克风功能*

## 开发说明

### 音频分析特性

游戏分析以下音频特征：
- 音量强度
- 音调变化
- 节奏检测
- 音频清晰度
- 峰值振幅

### 添加新物品

在 `data.js` 中的 `GAME_DATA.items` 对象中添加新物品配置：

```javascript
"item_id": {
    name: "物品名称",
    description: "物品描述",
    analysisHint: {
        volume: { min: 30, max: 80 },
        pitchVariation: { min: 20, max: 60 }
    }
}
```

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License 