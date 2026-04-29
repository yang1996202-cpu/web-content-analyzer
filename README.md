# Web Content Analyzer

> 分析网页内容长度，智能选择给 AI 的策略

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.2.0-blue.svg)](https://github.com/yang1996202-cpu/web-content-analyzer)

## 为什么需要这个工具？

### 问题背景

和 AI 对话时，我们经常给 AI 发网页链接，但遇到这些问题：

1. **不知道网页多长** → AI 可能只读了前面一半
2. **不知道会不会超限制** → 关键信息被截断
3. **不知道怎么分段问** → 一次性问太多，AI 回答质量差

### 真实案例

```
用户："https://github.com/openclaw/openclaw 帮我安装"
AI：[只读了 README 的前 20%，漏掉 Windows 特殊说明]
结果：安装失败，浪费 2 小时排查
```

### 实测验证

```
$ node analyze.js https://github.com/openclaw/openclaw

📊 网页内容分析报告
═══════════════════════════════════════
总字符数: 46,025 字
估算 Token: 69,038 tokens
等级: 🔴 危险
策略: 必须拆分，先问文档结构
═══════════════════════════════════════
```

**46,000+ 字符，AI 只能读前 20%！** 这就是安装失败的根本原因。

### 解决思路

```
给链接前 → 先分析长度 → 选择策略 → 再问 AI
```

## 核心功能

### 1. 自动分析网页

```javascript
const { analyzeWebPage } = require('./analyze');

const report = await analyzeWebPage("https://github.com/openclaw/openclaw");
// 返回：字数、Token 估算、等级评估、推荐策略
```

### 2. 三级评估体系

| 等级 | 字数 | Token 估算 | 策略 | 示例 |
|------|------|-----------|------|------|
| 🟢 安全 | < 3,000 字 | < 4,500 | 直接给链接 | 博客文章、搜索结果页 |
| 🟡 警告 | 3,000-10,000 字 | 4,500-15,000 | 指定章节 | GitHub README、5页PDF |
| 🔴 危险 | > 10,000 字 | > 15,000 | 必须拆分 | 完整 API 文档、50页论文 |

### 3. 智能 Prompt 推荐

根据分析结果，自动生成最优的 AI 提示词：

```
🟢 安全: "请阅读 [链接]，总结关键信息"
🟡 警告: "请查看 [链接] 的安装部分，不要阅读 API 文档"  
🔴 危险: "请查看 [链接]：1.文档结构是什么？2.有哪些章节？"
```

### 4. 文本长度检测（非 URL 场景）

```javascript
const { calculateStats } = require('./analyze');

// 适用于 OCR 输出、长文本等非 URL 场景
const stats = calculateStats(ocrOutputText);
if (stats.charCount > 10000) {
  // 分块处理
}
```

## 与其他 Skill 的集成

基于定量分析，我们诚实地声明每个集成的价值：

| Skill | 集成价值 | 什么时候需要 | 什么时候不需要 |
|-------|---------|-------------|--------------|
| **multi-search-engine** | ⭐⭐⭐⭐⭐ HIGH | 搜索后点击目标页前 | 搜索结果页本身（~3000字，安全）|
| **browse** | ⭐⭐⭐ MEDIUM | `$B text` 提取全文前 | `$B snapshot`（~800字，天然压缩）|
| **ocr-document-processor** | ⭐⭐⭐ MEDIUM | 5页以上PDF的OCR输出 | 单页发票/收据（~300字）|
| **ocr-super-surya** | ⭐⭐ LOW | 多页文档OCR输出 | 单张图片OCR（主要场景）|
| **find-skills** | ⭐ DISCOVERY | 用户搜索相关Skill时 | 不是运行时集成 |

### 经验验证数据

| 场景 | 典型字数 | Token 估算 | 等级 |
|------|---------|-----------|------|
| Google 搜索结果页 | ~3,500 | ~5,250 | 🟡 |
| 百度搜索结果页 | ~2,800 | ~4,200 | 🟢 |
| GitHub README（短） | ~5,000 | ~7,500 | 🟡 |
| GitHub README（长，如OpenClaw） | ~46,000 | ~69,000 | 🔴 |
| OCR 单页发票 | ~300 | ~450 | 🟢 |
| OCR 5页报告 | ~3,500 | ~5,250 | 🟡 |
| OCR 50页论文 | ~30,000 | ~45,000 | 🔴 |
| browse snapshot | ~800 | ~1,200 | 🟢 |
| browse $B text（长页面） | ~25,000 | ~37,500 | 🔴 |

## 设计思路

### 为什么选 3000/10000 作为阈值？

基于 AI 上下文窗口的实际限制：

| 指标 | 数值 | 说明 |
|------|------|------|
| 单次工具返回 | ~2-8K tokens | WebSearch 实际返回量 |
| 安全上下文 | ~100K tokens | 开始压缩的临界点 |
| 汉字:Token 比 | 1:1.5 | 中文的 Token 消耗 |

**计算：**
- 3000 汉字 ≈ 4500 tokens → 在单次返回安全范围内
- 10000 汉字 ≈ 15000 tokens → 接近单次返回上限

### 渐进式对话的理论基础

```
问题：AI 上下文有限，长内容会丢失信息

解决：把"一次性大任务"拆成"多个小步骤"

类比：
❌ 一次性问："根据这篇 2 万字文档，帮我配置服务器"
✅ 分步问："系统要求？"→"安装步骤？"→"配置细节？"

优势：
1. 每步都在上下文限制内
2. 可以基于上一步结果调整
3. 减少信息遗漏
```

## 使用方式

### 方式 1：独立脚本

```bash
# 分析单个网页
node analyze.js https://github.com/openclaw/openclaw

# 输出示例
📊 网页内容分析报告
═══════════════════════════════════════
总字符数: 46,025 字
估算 Token: 69,038 tokens
等级: 🔴 危险
策略: 必须拆分，先问文档结构
推荐 Prompt: "请查看文档结构是什么？有哪些章节？"
═══════════════════════════════════════
```

### 方式 2：作为 Skill 使用

```yaml
# skill.yaml
name: web-content-analyzer
entry_point: analyze.js
tools:
  - web_fetch
```

### 方式 3：集成到工作流

```javascript
// 场景A：读取网页前预检
const report = await analyzeWebPage(userUrl);
if (report.assessment.level === 'danger') {
  // 改用渐进式对话
}

// 场景B：OCR 输出后检查
const stats = calculateStats(ocrText);
if (stats.charCount > 10000) {
  // 分块处理
}

// 场景C：browse $B text 前预检
const report = await analyzeWebPage(url);
if (report.assessment.level === 'danger') {
  // 改用 $B snapshot -i
}
```

## API

### `analyzeWebPage(url)`

分析网页内容长度，返回完整报告。

- **输入**: `url` (string) — 网页 URL
- **输出**: 报告对象（statistics, assessment, recommendations）
- **异步**: 是

### `calculateStats(text)`

分析已有文本的长度，适用于 OCR 输出等非 URL 场景。

- **输入**: `text` (string) — 文本内容
- **输出**: 统计对象（charCount, tokenEstimate, screenEstimate）
- **异步**: 否

### `formatReport(report)`

格式化报告为可读字符串。

- **输入**: `report` (object) — analyzeWebPage 的返回值
- **输出**: 格式化字符串
- **异步**: 否

## 技术实现

### 核心算法

```javascript
// 1. 获取并清洗内容
const text = extractText(html);
// - 移除 script/style 标签
// - 移除导航栏/页脚（重复内容）
// - 提取纯文本

// 2. 多维度统计
const stats = {
  charCount: text.length,
  chineseChars: 中文字符数,
  tokenEstimate: chars * 1.5,
  screenEstimate: chars / 4000
};

// 3. 等级判断
if (charCount < 3000) → safe
else if (charCount < 10000) → warning  
else → danger

// 4. 生成策略
根据等级 → 选择对应的 prompt 模板
```

### GitHub 特殊处理

GitHub 页面是 JS 动态渲染的，直接 fetch 只能拿到骨架 HTML。本工具自动将 GitHub URL 转换为 raw README 地址：

```
https://github.com/owner/repo
    ↓ 自动转换
https://raw.githubusercontent.com/owner/repo/main/README.md
```

### 去噪处理

```
原始 HTML: 50KB
├── 导航栏（每个页面重复）→ 移除
├── 页脚版权信息 → 移除
├── script 代码 → 移除
└── 实际内容 → 保留

清洗后文本: 15KB（减少 70% 噪音）
```

## 项目起源

这个工具源于一次真实的 AI 使用体验：

> 用户想安装 OpenClaw，让 AI 看 GitHub 文档。
> AI 只读了前面部分，漏掉 Windows 特殊说明，导致安装失败。
> 
> 问题根源：不知道文档多长，不知道 AI 能读多少。
> 
> 解决思路：先分析，再决定怎么问。

## 贡献指南

### 如何参与

1. **Fork 项目**
2. **提交 Issue**：描述你遇到的"AI 读不全"场景
3. **提交 PR**：改进算法、添加新功能

### 待改进方向

- [ ] 支持动态网页（JS 渲染）
- [ ] 更精确的 Token 计算（按不同模型）
- [ ] 多语言支持（英文、日文等）
- [ ] 浏览器插件版本
- [ ] VS Code 扩展
- [ ] 导出 `calculateStats` 函数供外部调用

## 相关讨论

### 为什么渐进式对话更好？

详见：[docs/why-progressive.md](docs/why-progressive.md)

### AI 上下文限制详解

详见：[docs/context-limits.md](docs/context-limits.md)

## 许可证

MIT License - 自由使用，欢迎贡献！

## 致谢

感谢在这次讨论中提出的问题和思路：
- "AI 读网页的边界在哪里？"
- "怎么判断网页长度？"
- "能不能做个 Skill 自动处理？"
- "跨系统数据整合的复杂度怎么解决？"

这些问题促成了这个工具的诞生。
