// gen-dict-ext.mjs —— #301 词典拼字·扩展词库生成工具（白名单维护版）
// 用法：node tools/gen-dict-ext.mjs [jieba-dict.txt]
// 规则：只维护“日常生活 / 情侣常用 / 基础汉字”的白名单，负面、整治、怪异、性相关、太油的词全部拒收。
// 输出：src/js/dict-ext-data.js（固定结构，载入时直接使用）。
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

const groups = [
  ["基础汉字", ["你好"]],
];

const src = `// ===== #301 词典拼字·扩展词库（日常/情侣白名单版 v27） =====\n` +
  `// 只保留日常生活、情侣常用、基础汉字与轻量对话词；不收负面、整治、怪异、性相关、太油的词。\n` +
  `// 需要新增词条时，优先保持朴素、常用、可日常聊天直读。\n` +
  `window.DEFAULT_CARD_DATA.dict_ext = [\n` +
  groups.map(([name, arr]) => `  ["${name}", ${JSON.stringify(arr)}],`).join('\n') +
  `\n];\n`;

fs.writeFileSync(path.join(root, 'src/js/dict-ext-data.js'), src, 'utf8');
console.log('dict-ext-data.js 生成完成：', groups.reduce((n, g) => n + g[1].length, 0), '词条');
