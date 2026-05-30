/**
 * Web Content Analyzer
 *
 * A content-budget preflight tool. It estimates how large a web page or text
 * block is before an AI workflow tries to read or summarize it.
 */

const SKILL_CONFIG = {
  safeThreshold: 3000,
  warningThreshold: 10000,
  maxFetchLength: 100000,
  timeoutMs: 15000
};

async function analyzeWebPage(url) {
  try {
    const fetched = await fetchWebContent(url);
    const text = fetched.kind === "html" ? extractText(fetched.content) : fetched.content;
    const stats = calculateStats(text, {
      sourceChars: fetched.sourceChars,
      analyzedChars: text.length,
      truncated: fetched.truncated
    });
    const assessment = assessLevel(stats);
    const recommendations = generateRecommendations(url, assessment, stats);

    return generateReport(url, fetched, stats, assessment, recommendations);
  } catch (error) {
    return {
      error: true,
      message: `分析失败: ${error.message}`,
      suggestion: "请检查 URL 是否可访问，或改用手动粘贴文本后调用 calculateStats(text)"
    };
  }
}

async function fetchWebContent(url) {
  const candidates = resolveFetchCandidates(url);
  let lastError;

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate.url, {
        headers: { "User-Agent": "WebContentAnalyzer/2.0" },
        signal: AbortSignal.timeout(SKILL_CONFIG.timeoutMs)
      });

      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status} ${response.statusText}`);
        continue;
      }

      const contentType = response.headers.get("content-type") || "";
      const raw = await response.text();
      const truncated = raw.length > SKILL_CONFIG.maxFetchLength;
      return {
        requestedUrl: url,
        fetchedUrl: candidate.url,
        sourceType: candidate.type,
        kind: contentType.includes("text/html") ? "html" : "text",
        contentType,
        sourceChars: raw.length,
        truncated,
        content: truncated ? raw.slice(0, SKILL_CONFIG.maxFetchLength) : raw
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(lastError ? lastError.message : "no fetch candidates available");
}

function resolveFetchCandidates(url) {
  const parsed = new URL(url);
  const candidates = [];

  if (parsed.hostname === "github.com") {
    const parts = parsed.pathname.split("/").filter(Boolean);
    const [owner, repo, mode, branch, ...pathParts] = parts;

    if (owner && repo && mode === "blob" && branch && pathParts.length > 0) {
      candidates.push({
        type: "github-blob",
        url: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${pathParts.join("/")}`
      });
    } else if (owner && repo && parts.length === 2) {
      candidates.push({
        type: "github-readme",
        url: `https://raw.githubusercontent.com/${owner}/${repo}/main/README.md`
      });
      candidates.push({
        type: "github-readme",
        url: `https://raw.githubusercontent.com/${owner}/${repo}/master/README.md`
      });
      candidates.push({ type: "html", url });
    } else {
      candidates.push({ type: "html", url });
    }
  } else {
    candidates.push({ type: "url", url });
  }

  return candidates;
}

function extractText(html) {
  if (!html) return "";

  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<\/(p|div|section|article|main|header|h[1-6]|li|tr|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function calculateStats(text, meta = {}) {
  const value = text || "";
  const charCount = value.length;
  const chineseChars = (value.match(/[\u4e00-\u9fff]/g) || []).length;
  const cjkChars = (value.match(/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/g) || []).length;
  const englishWords = (value.match(/[A-Za-z]+(?:['-][A-Za-z]+)*/g) || []).length;
  const digitGroups = (value.match(/\d+(?:[.,]\d+)*/g) || []).length;
  const nonWhitespaceChars = (value.match(/\S/g) || []).length;
  const lineCount = value ? value.split(/\r?\n/).length : 0;
  const estimatedTokens = estimateTokens({
    cjkChars,
    englishWords,
    digitGroups,
    nonWhitespaceChars
  });
  const estimatedScreens = Math.max(1, Math.ceil(charCount / 4000));

  return {
    charCount,
    sourceChars: meta.sourceChars ?? charCount,
    analyzedChars: meta.analyzedChars ?? charCount,
    truncated: Boolean(meta.truncated),
    chineseChars,
    cjkChars,
    englishWords,
    digitGroups,
    estimatedTokens,
    lineCount,
    estimatedScreens
  };
}

function estimateTokens(stats) {
  const knownTokenishChars = stats.cjkChars + stats.englishWords * 4.7 + stats.digitGroups * 3;
  const otherChars = Math.max(0, stats.nonWhitespaceChars - knownTokenishChars);

  return Math.ceil(
    stats.cjkChars * 1.2 +
    stats.englishWords * 1.35 +
    stats.digitGroups * 1.1 +
    otherChars * 0.45
  );
}

function assessLevel(stats) {
  const { charCount } = stats;

  if (charCount < SKILL_CONFIG.safeThreshold) {
    return {
      level: "safe",
      emoji: "🟢",
      label: "安全",
      description: "内容较短，通常适合直接阅读或总结",
      strategy: "可以直接给 AI 链接或文本"
    };
  }

  if (charCount < SKILL_CONFIG.warningThreshold) {
    return {
      level: "warning",
      emoji: "🟡",
      label: "注意",
      description: "内容中等，一次性处理可能混入无关细节",
      strategy: "最好说明你的目标，或指定章节/问题"
    };
  }

  return {
    level: "danger",
    emoji: "🔴",
    label: "过长",
    description: "内容很长，即使能 fetch 到，也不适合一次性塞给 AI",
    strategy: "先问结构，再按章节、任务或关键词分块处理"
  };
}

function generateRecommendations(url, assessment, stats) {
  const prompts = {
    direct: `请阅读 ${url}，围绕我的问题提取关键信息。`,
    taskFirst: `请先判断 ${url} 里哪些部分和我的目标有关，再只读取相关部分回答。`,
    structured: `请查看 ${url}，先回答：
1. 这份内容的主要结构是什么？
2. 哪些章节和我的目标最相关？
3. 建议我下一步先看哪一部分？`,
    sectionSpecific: (section) => `请只查看 ${url} 中和 "${section}" 有关的部分，忽略其他章节。`
  };

  let bestPrompt = prompts.direct;
  if (assessment.level === "warning") bestPrompt = prompts.taskFirst;
  if (assessment.level === "danger") bestPrompt = prompts.structured;

  const actions = [];
  if (assessment.level === "safe") {
    actions.push("直接阅读或总结");
  } else if (assessment.level === "warning") {
    actions.push("带着明确问题阅读");
    actions.push("优先读取安装、配置、限制、故障排查等目标章节");
  } else {
    actions.push("先获取目录或标题结构");
    actions.push("按章节分块读取");
    actions.push("每次只问一个具体目标");
  }

  if (stats.truncated) {
    actions.push("注意：本次只分析了前一部分内容，原文更长");
  }

  return {
    bestPrompt,
    actions,
    alternativePrompts: {
      direct: prompts.direct,
      taskFirst: prompts.taskFirst,
      structured: prompts.structured
    }
  };
}

function generateReport(url, fetched, stats, assessment, recommendations) {
  return {
    url,
    fetchedUrl: fetched.fetchedUrl,
    sourceType: fetched.sourceType,
    timestamp: new Date().toISOString(),
    statistics: {
      totalChars: stats.charCount,
      sourceChars: stats.sourceChars,
      analyzedChars: stats.analyzedChars,
      truncated: stats.truncated,
      chineseChars: stats.chineseChars,
      cjkChars: stats.cjkChars,
      englishWords: stats.englishWords,
      estimatedTokens: stats.estimatedTokens,
      lineCount: stats.lineCount,
      estimatedScreens: stats.estimatedScreens
    },
    assessment,
    recommendations,
    thresholds: {
      safe: SKILL_CONFIG.safeThreshold,
      warning: SKILL_CONFIG.warningThreshold,
      current: stats.charCount
    }
  };
}

function formatReport(report) {
  if (report.error) {
    return `❌ ${report.message}\n💡 ${report.suggestion}`;
  }

  const { statistics, assessment, recommendations } = report;
  const truncationNote = statistics.truncated
    ? `\n截断提示: 原始内容 ${statistics.sourceChars.toLocaleString()} 字，本次分析前 ${statistics.analyzedChars.toLocaleString()} 字`
    : "";

  return `
📊 内容预算分析报告
═══════════════════════════════════════

🔗 输入 URL: ${report.url}
📥 实际读取: ${report.fetchedUrl}
⏰ 分析时间: ${report.timestamp}

📈 统计信息
─────────────────────────────────────
可读字符数: ${statistics.totalChars.toLocaleString()} 字
中文/CJK 字符: ${statistics.cjkChars.toLocaleString()} 字
英文单词: ${statistics.englishWords.toLocaleString()} 个
粗估 Token: ${statistics.estimatedTokens.toLocaleString()} tokens
行数: ${statistics.lineCount.toLocaleString()} 行
估算屏数: 约 ${statistics.estimatedScreens} 屏${truncationNote}

🎯 评估结果
─────────────────────────────────────
等级: ${assessment.emoji} ${assessment.label}
说明: ${assessment.description}
建议: ${assessment.strategy}

💡 推荐 Prompt
─────────────────────────────────────
${recommendations.bestPrompt}

✅ 推荐动作
─────────────────────────────────────
${recommendations.actions.map((action) => `- ${action}`).join("\n")}

═══════════════════════════════════════
`;
}

module.exports = {
  analyzeWebPage,
  fetchWebContent,
  resolveFetchCandidates,
  extractText,
  calculateStats,
  assessLevel,
  formatReport,
  SKILL_CONFIG
};

if (require.main === module) {
  const targetUrl = process.argv[2] || "https://github.com/openclaw/openclaw";

  analyzeWebPage(targetUrl)
    .then((report) => {
      console.log(formatReport(report));
      if (report.error) process.exitCode = 1;
    })
    .catch((err) => {
      console.error("分析失败:", err);
      process.exitCode = 1;
    });
}
