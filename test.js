const assert = require("node:assert/strict");
const {
  calculateStats,
  assessLevel,
  extractText,
  resolveFetchCandidates,
  formatReport,
  SKILL_CONFIG
} = require("./analyze");

function testAssessmentThresholds() {
  const cases = [
    { text: "这是一篇短文章。".repeat(100), expected: "safe" },
    { text: "这是一篇中等长度的文档。".repeat(500), expected: "warning" },
    { text: "这是一篇很长的技术文档。".repeat(2000), expected: "danger" }
  ];

  for (const item of cases) {
    const stats = calculateStats(item.text);
    const assessment = assessLevel(stats);
    assert.equal(assessment.level, item.expected);
  }
}

function testCalculateStatsExport() {
  const stats = calculateStats("Hello world\n你好，世界");

  assert.equal(stats.lineCount, 2);
  assert.equal(stats.chineseChars, 4);
  assert.equal(stats.englishWords, 2);
  assert.ok(stats.estimatedTokens > 0);
}

function testHtmlExtractionPreservesLines() {
  const html = `
    <html>
      <head><style>.x{}</style><script>alert(1)</script></head>
      <body><nav>menu</nav><h1>Title</h1><p>First paragraph.</p><p>Second paragraph.</p></body>
    </html>
  `;

  const text = extractText(html);
  assert.match(text, /Title/);
  assert.match(text, /First paragraph/);
  assert.doesNotMatch(text, /alert/);
  assert.doesNotMatch(text, /menu/);
  assert.ok(text.split(/\r?\n/).length > 1);
}

function testGitHubUrlResolution() {
  const repo = resolveFetchCandidates("https://github.com/yang1996202-cpu/web-content-analyzer");
  assert.equal(repo[0].url, "https://raw.githubusercontent.com/yang1996202-cpu/web-content-analyzer/main/README.md");
  assert.equal(repo[1].url, "https://raw.githubusercontent.com/yang1996202-cpu/web-content-analyzer/master/README.md");

  const blob = resolveFetchCandidates("https://github.com/owner/repo/blob/dev/docs/guide.md");
  assert.deepEqual(blob, [
    {
      type: "github-blob",
      url: "https://raw.githubusercontent.com/owner/repo/dev/docs/guide.md"
    }
  ]);
}

function testFormatReport() {
  const stats = calculateStats("测试内容".repeat(100), {
    sourceChars: 5000,
    analyzedChars: 400,
    truncated: true
  });
  const assessment = assessLevel(stats);
  const report = {
    url: "https://example.com",
    fetchedUrl: "https://example.com",
    timestamp: new Date().toISOString(),
    statistics: {
      totalChars: stats.charCount,
      sourceChars: stats.sourceChars,
      analyzedChars: stats.analyzedChars,
      truncated: stats.truncated,
      cjkChars: stats.cjkChars,
      englishWords: stats.englishWords,
      estimatedTokens: stats.estimatedTokens,
      lineCount: stats.lineCount,
      estimatedScreens: stats.estimatedScreens
    },
    assessment,
    recommendations: {
      bestPrompt: "请阅读 https://example.com",
      actions: ["直接阅读或总结"]
    }
  };

  const output = formatReport(report);
  assert.match(output, /内容预算分析报告/);
  assert.match(output, /截断提示/);
}

function runTests() {
  testAssessmentThresholds();
  testCalculateStatsExport();
  testHtmlExtractionPreservesLines();
  testGitHubUrlResolution();
  testFormatReport();

  console.log("All tests passed");
  console.log(`Thresholds: safe < ${SKILL_CONFIG.safeThreshold}, warning < ${SKILL_CONFIG.warningThreshold}`);
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };
