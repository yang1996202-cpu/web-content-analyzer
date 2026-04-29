/**
 * Web Content Analyzer Skill
 * 
 * 分析网页内容长度，智能推荐 AI 处理策略
 * 解决：给 AI 网页链接时，不知道内容多长、会不会超上下文限制
 */

const SKILL_CONFIG = {
  safeThreshold: 3000,      // 🟢 安全线：小于 3000 字
  warningThreshold: 10000,  // 🟡 警告线：3000-10000 字
  tokenRatio: 1.5,          // Token 估算比例
  maxFetchLength: 50000     // 最大获取长度（防止超大页面）
};

/**
 * 主分析函数
 * @param {string} url - 要分析的网页 URL
 * @returns {object} 分析报告
 */
async function analyzeWebPage(url) {
  console.log(`🔍 正在分析: ${url}`);
  
  try {
    // 1. 获取网页内容
    const content = await fetchWebContent(url);
    
    // 2. 提取纯文本
    const text = extractText(content);
    
    // 3. 计算统计
    const stats = calculateStats(text);
    
    // 4. 判断等级和策略
    const assessment = assessLevel(stats);
    
    // 5. 生成推荐 Prompt
    const prompts = generatePrompts(url, assessment);
    
    // 6. 输出完整报告
    return generateReport(url, stats, assessment, prompts);
    
  } catch (error) {
    return {
      error: true,
      message: `分析失败: ${error.message}`,
      suggestion: "请检查 URL 是否可访问"
    };
  }
}

async function fetchWebContent(url) {
  let fetchUrl = url;
  if (url.includes('github.com') && !url.includes('raw.githubusercontent.com')) {
    const parts = url.replace('https://github.com/', '').split('/');
    if (parts.length >= 2) {
      const [owner, repo] = parts;
      fetchUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/README.md`;
    }
  }
  try {
    const response = await fetch(fetchUrl, {
      headers: { 'User-Agent': 'WebContentAnalyzer/1.0' },
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) {
      const altUrl = fetchUrl.replace('/main/', '/master/');
      const altResp = await fetch(altUrl, {
        headers: { 'User-Agent': 'WebContentAnalyzer/1.0' },
        signal: AbortSignal.timeout(15000)
      });
      if (!altResp.ok) throw new Error(`HTTP ${response.status}`);
      return (await altResp.text()).substring(0, SKILL_CONFIG.maxFetchLength);
    }
    return (await response.text()).substring(0, SKILL_CONFIG.maxFetchLength);
  } catch (err) {
    throw new Error(`fetch failed: ${err.message}`);
  }
}

/**
 * 从 HTML 中提取纯文本
 */
function extractText(html) {
  if (!html) return "";
  
  // 移除 script 和 style 标签及其内容
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')  // 导航栏通常是重复内容
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, ''); // 页脚
  
  // 移除 HTML 标签
  text = text.replace(/<[^>]+>/g, ' ');
  
  // 移除多余空白
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

/**
 * 计算文本统计信息
 */
function calculateStats(text) {
  const charCount = text.length;
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  const tokenEstimate = Math.ceil(charCount * SKILL_CONFIG.tokenRatio);
  const lineCount = text.split('\n').length;
  
  // 估算屏幕数（假设一屏 80 行，每行 50 字）
  const screenEstimate = Math.ceil(charCount / 4000);
  
  return {
    charCount,
    chineseChars,
    englishWords,
    tokenEstimate,
    lineCount,
    screenEstimate
  };
}

/**
 * 评估内容等级
 */
function assessLevel(stats) {
  const { charCount } = stats;
  
  if (charCount < SKILL_CONFIG.safeThreshold) {
    return {
      level: "safe",
      emoji: "🟢",
      label: "安全",
      description: "内容较短，AI 可以完整读取",
      strategy: "直接给 AI 链接或粘贴全文",
      confidence: "high"
    };
  } else if (charCount < SKILL_CONFIG.warningThreshold) {
    return {
      level: "warning", 
      emoji: "🟡",
      label: "警告",
      description: "内容中等，AI 可能截断尾部",
      strategy: "给链接 + 指定章节，或分段询问",
      confidence: "medium"
    };
  } else {
    return {
      level: "danger",
      emoji: "🔴", 
      label: "危险",
      description: "内容很长，AI 只能读前面一小部分",
      strategy: "必须拆分：先问文档结构，再逐步深入具体章节",
      confidence: "low"
    };
  }
}

/**
 * 生成推荐 Prompt
 */
function generatePrompts(url, assessment) {
  const prompts = {
    direct: `请阅读 ${url} 的内容，总结关键信息`,
    
    structured: `请查看 ${url}：
1. 文档的整体结构是什么？有哪些主要章节？
2. 每个章节大概讲什么？
请先回答结构，我们再深入具体内容`,

    sectionSpecific: (section) => `请查看 ${url} 的"${section}"部分：
- 只阅读这个章节
- 不要阅读其他部分
- 总结该章节的关键点`,

    withContext: (context) => `基于以下背景信息：
${context}

请查看 ${url} 的相关部分，给出针对性建议`
  };
  
  // 根据等级推荐最佳 Prompt
  let recommendedPrompt;
  switch (assessment.level) {
    case "safe":
      recommendedPrompt = prompts.direct;
      break;
    case "warning":
      recommendedPrompt = prompts.structured;
      break;
    case "danger":
      recommendedPrompt = prompts.structured + "\n\n（注意：该文档很长，建议分多次询问）";
      break;
  }
  
  return {
    ...prompts,
    recommended: recommendedPrompt
  };
}

/**
 * 生成完整报告
 */
function generateReport(url, stats, assessment, prompts) {
  return {
    url,
    timestamp: new Date().toISOString(),
    
    statistics: {
      totalChars: stats.charCount,
      chineseChars: stats.chineseChars,
      englishWords: stats.englishWords,
      estimatedTokens: stats.tokenEstimate,
      lineCount: stats.lineCount,
      estimatedScreens: stats.screenEstimate
    },
    
    assessment: {
      level: assessment.level,
      emoji: assessment.emoji,
      label: assessment.label,
      description: assessment.description,
      strategy: assessment.strategy,
      confidence: assessment.confidence
    },
    
    recommendations: {
      bestPrompt: prompts.recommended,
      alternativePrompts: {
        direct: prompts.direct,
        structured: prompts.structured
      }
    },
    
    thresholds: {
      safe: SKILL_CONFIG.safeThreshold,
      warning: SKILL_CONFIG.warningThreshold,
      current: stats.charCount
    }
  };
}

/**
 * 格式化输出（给用户看的）
 */
function formatReport(report) {
  if (report.error) {
    return `❌ ${report.message}\n💡 ${report.suggestion}`;
  }
  
  const { statistics, assessment, recommendations } = report;
  
  return `
📊 网页内容分析报告
═══════════════════════════════════════

🔗 URL: ${report.url}
⏰ 分析时间: ${report.timestamp}

📈 统计信息
─────────────────────────────────────
总字符数: ${statistics.totalChars.toLocaleString()} 字
中文字符: ${statistics.chineseChars.toLocaleString()} 字
英文单词: ${statistics.englishWords.toLocaleString()} 个
估算 Token: ${statistics.estimatedTokens.toLocaleString()} tokens
代码行数: ${statistics.lineCount.toLocaleString()} 行
估算屏数: 约 ${statistics.estimatedScreens} 屏

🎯 评估结果
─────────────────────────────────────
等级: ${assessment.emoji} ${assessment.label}
说明: ${assessment.description}
策略: ${assessment.strategy}
置信度: ${assessment.confidence}

💡 推荐 Prompt
─────────────────────────────────────
${recommendations.bestPrompt}

📋 其他选项
─────────────────────────────────────
直接询问: ${recommendations.alternativePrompts.direct}
结构化询问: ${recommendations.alternativePrompts.structured}

═══════════════════════════════════════
`;
}

// 导出函数
module.exports = {
  analyzeWebPage,
  formatReport,
  SKILL_CONFIG
};

// 如果是直接运行，执行示例
if (require.main === module) {
  const testUrl = process.argv[2] || "https://github.com/openclaw/openclaw";
  
  analyzeWebPage(testUrl)
    .then(report => {
      console.log(formatReport(report));
    })
    .catch(err => {
      console.error("分析失败:", err);
    });
}
