# Web Content Analyzer

> 分析网页内容长度，智能选择给 AI 的策略

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

| 等级 | 字数 | 策略 | 示例 |
|------|------|------|------|
| 🟢 安全 | < 3000 字 | 直接给链接 | 博客文章、简短文档 |
| 🟡 警告 | 3000-10000 字 | 指定章节 | GitHub README、教程 |
| 🔴 危险 | > 10000 字 | 必须拆分 | 完整 API 文档、书籍 |

### 3. 智能 Prompt 推荐

根据分析结果，自动生成最优的 AI 提示词：

```
🟢 安全: "请阅读 [链接]，总结关键信息"
🟡 警告: "请查看 [链接] 的安装部分，不要阅读 API 文档"  
🔴 危险: "请查看 [链接]：1.文档结构是什么？2.有哪些章节？"
```

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

### 方式 1：作为 Skill 使用

```yaml
# skill.yaml
name: web-content-analyzer
entry_point: analyze.js
tools:
  - web_fetch
```

### 方式 2：独立脚本

```bash
# 分析单个网页
node analyze.js https://github.com/openclaw/openclaw

# 输出示例
📊 网页内容分析报告
═══════════════════════════════════════
总字符数: 15,000 字
等级: 🔴 危险
策略: 必须拆分，先问文档结构
推荐 Prompt: "请查看...的结构是什么？"
```

### 方式 3：集成到工作流

```javascript
// 在 AI 对话前，先分析链接
const report = await analyzeWebPage(userUrl);

if (report.assessment.level === 'danger') {
  return "这个文档很长，建议分步询问。先问：文档结构是什么？";
}
```

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
  charCount: text.length,           // 总字符
  chineseChars: 中文字符数,          // 中文占比
  tokenEstimate: chars * 1.5,       // Token 估算
  screenEstimate: chars / 4000      // 屏幕数估算
};

// 3. 等级判断
if (charCount < 3000) → safe
else if (charCount < 10000) → warning  
else → danger

// 4. 生成策略
根据等级 → 选择对应的 prompt 模板
```

### 去噪处理

为什么需要清洗 HTML？

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

这些问题促成了这个工具的诞生。
