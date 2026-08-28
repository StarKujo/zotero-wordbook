# Zotero Wordbook

中文 | [English](#english)

一个面向 Zotero 阅读场景的英语单词本插件：在 PDF、EPUB 或网页阅读器中选中英文单词或短语，点击“保存到单词本”，即可保存英文、中文释义及论文来源。

## 功能

- 阅读器选中文本后，一键保存到单词本
- 自动调用翻译服务保存中文释义；支持手动编辑和重新翻译
- 右侧单词本面板：搜索、按当前论文筛选、按时间或首字母排序、手动添加词汇
- 新词自动尝试将常见英文复数还原为单数形式
- 词条可编辑英文和中文、删除、导出为 JSON 或 CSV
- 单词本数据保存在 Zotero 数据目录下的 `zotero-wordbook/wordbook.json`

## 依赖

本插件依赖 [Translate for Zotero](https://github.com/windingwind/zotero-pdf-translate) 提供翻译能力。请先安装并启用 Translate for Zotero；若它未安装或翻译失败，英文词条仍会保存，可稍后在单词本中手动编辑或重试翻译。

Translate for Zotero 是独立项目。本项目仅调用其公开 API，不随插件分发其代码。

## 安装

1. 从本仓库的 [Releases](../../releases) 下载最新 `.xpi` 文件。
2. 在 Zotero 中打开 `工具 → 插件`。
3. 点击齿轮按钮，选择“从文件安装附加组件”，选择下载的 XPI。
4. 重启 Zotero。

当前首发版本支持 Zotero 10.0.x。

## 使用

1. 在 Zotero 阅读器中选择英文单词或短语。
2. 点击弹出菜单中的“保存到单词本”。
3. 在阅读器右侧快捷栏点击书本图标，打开“单词本”。

## 开发

项目结构参考 [Translate for Zotero](https://github.com/windingwind/zotero-pdf-translate) 的 Zotero 插件组织方式。

```text
addon/   插件清单、启动脚本、本地化与图标
src/     TypeScript 源码
build/   已打包的插件内容
```

安装依赖并构建：

```bash
npm install
npm run build
```

## 许可证

本项目采用 [GNU AGPL-3.0-or-later](https://www.gnu.org/licenses/agpl-3.0.html) 许可证。

## English

Zotero Wordbook saves selected English words or phrases from the Zotero reader together with Chinese translations and source-paper context. It requires [Translate for Zotero](https://github.com/windingwind/zotero-pdf-translate) for automatic translation. Install the latest XPI from [Releases](../../releases).
