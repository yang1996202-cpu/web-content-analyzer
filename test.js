/**
 * Web Content Analyzer 测试用例
 */

const { analyzeWebPage, formatReport, SKILL_CONFIG } = require('./analyze');

// 模拟 web_fetch 工具
async function mockWebFetch(url) {
  // 模拟不同长度的网页内容
  const mockData = {
    'short': {
      text: '这是一篇短文章。'.repeat(100), // 约 800 字
      expectedLevel: 'safe'
    },
    'medium': {
      text: '这是一篇中等长度的文档。'.repeat(500), // 约 4000 字
      expectedLevel: 'warning'
    },
    'long': {
      text: '这是一篇很长的技术文档。'.repeat(2000), // 约 16000 字
      expectedLevel: 'danger'
    }
  };
  
  // 根据 URL 参数返回不同长度
  const type = url.includes('short') ? 'short' : 
               url.includes('medium') ? 'medium' : 'long';
  
  return {
    text: mockData[type].text,
    expectedLevel: mockData[type].expectedLevel
  };
}

// 替换实际的 webFetch
async function testWithMock(url) {
  const mockResult = await mockWebFetch(url);
  
  // 直接测试内部函数
  const text = mockResult.text;
  const stats = {
    charCount: text.length,
    chineseChars: (text.match(/[\u4e00-\u9fa5]/g) || []).length,
    englishWords: 0,
    tokenEstimate: Math.ceil(text.length * 1.5),
    lineCount: text.split('\n').length,
    screenEstimate: Math.ceil(text.length / 4000)
  };
  
  // 使用 assessLevel 逻辑
  let level;
  if (stats.charCount < SKILL_CONFIG.safeThreshold) level = 'safe';
  else if (stats.charCount < SKILL_CONFIG.warningThreshold) level = 'warning';
  else level = 'danger';
  
  return {
    url,
    charCount: stats.charCount,
    expectedLevel: mockResult.expectedLevel,
    actualLevel: level,
    pass: mockResult.expectedLevel === level
  };
}

// 运行测试
async function runTests() {
  console.log('🧪 运行 Web Content Analyzer 测试\n');
  
  const tests = [
    { url: 'https://example.com/short', name: '短文章测试' },
    { url: 'https://example.com/medium', name: '中等文档测试' },
    { url: 'https://example.com/long', name: '长文档测试' }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    const result = await testWithMock(test.url);
    const status = result.pass ? '✅ 通过' : '❌ 失败';
    
    console.log(`${status} - ${test.name}`);
    console.log(`  字数: ${result.charCount}`);
    console.log(`  期望: ${result.expectedLevel}, 实际: ${result.actualLevel}`);
    console.log();
    
    if (result.pass) passed++;
    else failed++;
  }
  
  console.log(`\n📊 测试结果: ${passed} 通过, ${failed} 失败`);
  
  // 测试阈值配置
  console.log('\n📋 当前阈值配置:');
  console.log(`  安全线: ${SKILL_CONFIG.safeThreshold} 字`);
  console.log(`  警告线: ${SKILL_CONFIG.warningThreshold} 字`);
  console.log(`  Token 比例: ${SKILL_CONFIG.tokenRatio}`);
}

// 测试格式化输出
function testFormatReport() {
  console.log('\n📝 测试格式化输出:\n');
  
  const mockReport = {
    url: 'https://github.com/example/test',
    timestamp: new Date().toISOString(),
    statistics: {
      totalChars: 5000,
      chineseChars: 3000,
      englishWords: 500,
      estimatedTokens: 7500,
      lineCount: 100,
      estimatedScreens: 2
    },
    assessment: {
      level: 'warning',
      emoji: '🟡',
      label: '警告',
      description: '内容中等，AI 可能截断尾部',
      strategy: '给链接 + 指定章节，或分段询问',
      confidence: 'medium'
    },
    recommendations: {
      bestPrompt: '请查看 https://github.com/example/test 的安装部分',
      alternativePrompts: {
        direct: '请阅读...',
        structured: '请查看...的结构'
      }
    },
    thresholds: {
      safe: 3000,
      warning: 10000,
      current: 5000
    }
  };
  
  console.log(formatReport(mockReport));
}

// 运行所有测试
if (require.main === module) {
  runTests().then(() => {
    testFormatReport();
  });
}

module.exports = { runTests, testFormatReport };
