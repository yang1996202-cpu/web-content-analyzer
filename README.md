# Web Content Analyzer

> 一个给 AI 用的“内容预算预检器”：先判断网页/文档有多大，再决定怎么让 AI 读。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/yang1996202-cpu/web-content-analyzer)

## 这个东西对你有什么用？

最简单地说：**它帮你在把链接丢给 AI 之前，先判断这份内容该不该一次性读。**

你遇到的很多 AI 使用失败，并不是 AI 完全不会，而是你给它的材料太长、太散、太杂：

- 一个 GitHub 仓库 README 很长，安装说明、Windows 说明、故障排查混在一起。
- 一个网页里有正文、导航、评论、广告、页脚，AI 可能把注意力浪费在无关内容上。
- 一份 OCR 出来的长文档有几万字，你一次性让 AI 总结，结果它漏掉后半部分重点。
- 一个技术文档有很多章节，你真正需要的是“安装要求”，但你让 AI 看了整份文档。

这个工具的价值不是“替代 AI 阅读”，而是**帮你决定怎么让 AI 阅读**。

## 一句话定位

它不是搜索引擎，也不是浏览器，也不是万能网页解析器。

它是一个小工具，回答三个问题：

1. 这份内容大概有多长？
2. 直接给 AI 读是否合适？
3. 如果太长，应该怎么拆开问？

## 为什么这件事重要？

以前的说法容易说重了：不是“AI 一定只能读前 20%”，也不是“fetch 做不到”。现在很多环境确实可以 fetch 到完整网页或完整 README。

真正的问题是：

**fetch 到完整内容，不等于一次性塞给 AI 就是好策略。**

长内容会带来三个实际问题：

1. **上下文预算问题**：内容越长，占用的 token 越多，留给分析、推理、回答的空间越少。
2. **注意力问题**：AI 可能读到了全文，但关键点被大量无关内容稀释。
3. **任务路由问题**：你要安装软件时，最该看的不是整篇 README，而是 Requirements、Installation、Troubleshooting。

所以这个项目的核心方法论是：

```
先估算内容规模 → 再选择阅读策略 → 最后让 AI 执行具体任务
```

## 什么时候有用？

### 1. 让 AI 帮你安装开源项目

不要直接说：

```
帮我安装这个项目：https://github.com/openclaw/openclaw
```

更稳的流程是：

```
node analyze.js https://github.com/openclaw/openclaw
```

如果结果显示内容过长，就先问：

```
请查看这个项目文档，先找出和安装有关的章节：
1. 系统要求是什么？
2. 安装步骤在哪里？
3. 有没有 Windows/macOS/Linux 的差异？
4. 有没有故障排查章节？
```

这比“全文总结一下”更容易得到可执行答案。

### 2. 处理长网页、长文档、技术文档

适合：

- API 文档
- GitHub README
- 安装教程
- 长博客
- OCR 出来的多页文档
- 论文或报告

不适合：

- 很短的新闻
- 一两段文字
- 搜索结果页本身
- 你已经知道要读哪个具体小节的情况

### 3. 给其他 AI 工具当预处理步骤

如果你在写 agent、skill、自动化工作流，这个工具可以当一个“路由器”：

```javascript
const { analyzeWebPage } = require("./analyze");

const report = await analyzeWebPage(url);

if (report.assessment.level === "safe") {
  // 直接读取
} else if (report.assessment.level === "warning") {
  // 带着明确问题读取
} else {
  // 先拿目录/结构，再分章节处理
}
```

## 三级判断

| 等级 | 字符数 | 含义 | 建议 |
|------|--------|------|------|
| 🟢 安全 | < 3,000 | 内容短，通常可以直接读 | 直接给 AI |
| 🟡 注意 | 3,000-10,000 | 内容中等，最好带着目标读 | 指定问题或章节 |
| 🔴 过长 | > 10,000 | 不适合一次性处理 | 先问结构，再分块 |

这些阈值不是物理定律，只是保守经验值。不同模型、不同工具、不同网页结构都会影响结果。

## 使用方式

### 分析网页

```bash
node analyze.js https://github.com/openclaw/openclaw
```

输出类似：

```text
📊 内容预算分析报告
═══════════════════════════════════════

🔗 输入 URL: https://github.com/openclaw/openclaw
📥 实际读取: https://raw.githubusercontent.com/openclaw/openclaw/main/README.md

📈 统计信息
可读字符数: 86,642 字
粗估 Token: 约 29,000 tokens

🎯 评估结果
等级: 🔴 过长
建议: 先问结构，再按章节、任务或关键词分块处理
```

### 分析已有文本

适合 OCR、复制出来的长文本、爬虫已经拿到的正文：

```javascript
const { calculateStats, assessLevel } = require("./analyze");

const stats = calculateStats(ocrText);
const assessment = assessLevel(stats);

console.log(stats.charCount, stats.estimatedTokens, assessment.level);
```

## API

### `analyzeWebPage(url)`

抓取 URL，提取可读文本，返回统计和建议。

```javascript
const { analyzeWebPage } = require("./analyze");

const report = await analyzeWebPage("https://example.com");
```

返回重点字段：

```javascript
{
  url: "https://example.com",
  fetchedUrl: "https://example.com",
  statistics: {
    totalChars: 12000,
    estimatedTokens: 5200,
    lineCount: 180,
    truncated: false
  },
  assessment: {
    level: "danger",
    label: "过长",
    strategy: "先问结构，再按章节、任务或关键词分块处理"
  },
  recommendations: {
    bestPrompt: "..."
  }
}
```

### `calculateStats(text)`

只分析文本，不抓网页。

```javascript
const stats = calculateStats("一段很长的文本...");
```

### `assessLevel(stats)`

根据统计结果判断安全、注意、过长。

```javascript
const assessment = assessLevel(stats);
```

### `formatReport(report)`

把报告格式化成人能读的输出。

## GitHub 支持

这个工具会特殊处理 GitHub 链接：

| 输入 | 行为 |
|------|------|
| `https://github.com/owner/repo` | 优先读取 README |
| `https://github.com/owner/repo/blob/branch/path/file.md` | 转成 raw 文件读取 |
| 其他 GitHub 页面 | 按普通 HTML 页面读取 |

这比旧版更准确。旧版会把很多 GitHub URL 都强行当成 README，容易误判。

## 重要限制

这个工具只做“预检”，不是最终真理。

- token 是粗估，不是精确 tokenizer 结果。
- 动态网页可能需要浏览器渲染后才能拿到完整正文。
- 网页 HTML 结构复杂时，正文提取可能混入导航、按钮、页脚。
- 它不能判断内容质量，只能判断内容规模和处理策略。

## 项目真正有价值的地方

这个项目的价值不在于那几行代码，而在于一个 AI 使用原则：

> **不要把“给 AI 一个链接”当成任务完成。真正重要的是告诉 AI 应该读什么、忽略什么、按什么顺序读。**

对普通用户，它能减少“AI 看漏了、答偏了、安装失败了”的情况。

对开发者，它能作为 agent 的预处理模块：先做内容预算，再决定直接读、摘要读、分块读，还是先取目录。

对开源项目来说，它可以变成一个很小但实用的基础组件：**Context Budget Router**。

## 开发

```bash
npm test
node analyze.js https://github.com/openclaw/openclaw
```

## 后续改进

- [ ] 接入真实 tokenizer，按模型估算 token。
- [ ] 支持浏览器渲染后的正文提取。
- [ ] 增加 PDF/OCR 文档的分块建议。
- [ ] 根据任务类型生成不同 prompt，例如安装、排错、摘要、代码审查。
- [ ] 输出 JSON 模式，方便其他 agent 调用。

## License

MIT
