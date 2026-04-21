# Prompt Manager

一个 Prompt 管理器，使用 React + Tailwind + Supabase。

## 功能

- 新建、编辑、删除 prompt
- 分类和标签筛选
- 全文搜索
- 一键复制 prompt
- 收藏 prompt
- 数据保存在 Supabase `prompts` 表

## 运行

```bash
npm install
cp .env.example .env
npm run dev
```

在 `.env` 中配置：

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

建表 SQL 见 `supabase-schema.sql`。

生产构建：

```bash
npm run build
```
