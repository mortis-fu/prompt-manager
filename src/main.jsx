import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Archive,
  Bookmark,
  BookmarkCheck,
  Check,
  Copy,
  Edit3,
  Filter,
  Folder,
  Hash,
  LayoutGrid,
  Plus,
  Search,
  Sparkles,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "./supabaseClient";
import "./styles.css";

const emptyDraft = {
  title: "",
  category: "General",
  tagsText: "",
  content: "",
};

function normalizeTags(value) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => tag.replace(/^#/, ""));
}

function fromSupabase(row) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    category: row.category,
    tags: Array.isArray(row.tags) ? row.tags : [],
    favorite: Boolean(row.favorite),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSupabase(prompt) {
  return {
    id: prompt.id,
    title: prompt.title,
    content: prompt.content,
    category: prompt.category,
    tags: prompt.tags,
    favorite: prompt.favorite,
    created_at: prompt.createdAt,
    updated_at: prompt.updatedAt,
  };
}

function formatTime(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function App() {
  const [prompts, setPrompts] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [tagFilter, setTagFilter] = useState("All");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [copiedId, setCopiedId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchPrompts();
  }, []);

  async function fetchPrompts() {
    setIsLoading(true);
    setError("");
    if (!isSupabaseConfigured) {
      setError("请先配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。");
      setIsLoading(false);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from("prompts")
      .select("id,title,content,category,tags,favorite,created_at,updated_at")
      .order("favorite", { ascending: false })
      .order("updated_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setIsLoading(false);
      return;
    }

    const nextPrompts = data.map(fromSupabase);
    setPrompts(nextPrompts);
    setActiveId((currentId) => currentId ?? nextPrompts[0]?.id ?? null);
    setIsLoading(false);
  }

  const categories = useMemo(() => {
    return ["All", ...Array.from(new Set(prompts.map((item) => item.category))).sort()];
  }, [prompts]);

  const tags = useMemo(() => {
    return ["All", ...Array.from(new Set(prompts.flatMap((item) => item.tags))).sort()];
  }, [prompts]);

  const selectedPrompt = activeId ? prompts.find((item) => item.id === activeId) ?? null : null;
  const activePrompt = selectedPrompt ?? prompts[0] ?? null;

  const filteredPrompts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return prompts
      .filter((item) => (favoritesOnly ? item.favorite : true))
      .filter((item) => (categoryFilter === "All" ? true : item.category === categoryFilter))
      .filter((item) => (tagFilter === "All" ? true : item.tags.includes(tagFilter)))
      .filter((item) => {
        if (!needle) return true;
        return [item.title, item.category, item.content, item.tags.join(" ")]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      })
      .sort(
        (a, b) =>
          Number(b.favorite) - Number(a.favorite) ||
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
  }, [categoryFilter, favoritesOnly, prompts, query, tagFilter]);

  function startCreate() {
    setActiveId(null);
    setDraft(emptyDraft);
    setIsEditing(true);
  }

  function startEdit(prompt) {
    setActiveId(prompt.id);
    setDraft({
      title: prompt.title,
      category: prompt.category,
      tagsText: prompt.tags.join(", "),
      content: prompt.content,
    });
    setIsEditing(true);
  }

  async function saveDraft(event) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    const now = new Date().toISOString();
    const nextPrompt = {
      id: activeId ?? crypto.randomUUID(),
      title: draft.title.trim() || "Untitled prompt",
      category: draft.category.trim() || "General",
      tags: normalizeTags(draft.tagsText),
      content: draft.content.trim(),
      favorite: selectedPrompt?.favorite ?? false,
      createdAt: selectedPrompt?.createdAt ?? now,
      updatedAt: now,
    };

    const exists = prompts.some((item) => item.id === nextPrompt.id);
    const request = exists
      ? supabase
          .from("prompts")
          .update(toSupabase(nextPrompt))
          .eq("id", nextPrompt.id)
          .select("id,title,content,category,tags,favorite,created_at,updated_at")
          .single()
      : supabase
          .from("prompts")
          .insert(toSupabase(nextPrompt))
          .select("id,title,content,category,tags,favorite,created_at,updated_at")
          .single();

    const { data, error: saveError } = await request;
    setIsSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    const savedPrompt = fromSupabase(data);
    setPrompts((items) => {
      const exists = items.some((item) => item.id === nextPrompt.id);
      if (exists) return items.map((item) => (item.id === savedPrompt.id ? savedPrompt : item));
      return [savedPrompt, ...items];
    });
    setActiveId(savedPrompt.id);
    setIsEditing(false);
  }

  async function deletePrompt(id) {
    setError("");
    const { error: deleteError } = await supabase.from("prompts").delete().eq("id", id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setPrompts((items) => items.filter((item) => item.id !== id));
    if (activeId === id) {
      const next = prompts.find((item) => item.id !== id);
      setActiveId(next?.id ?? null);
      setIsEditing(false);
    }
  }

  async function toggleFavorite(id) {
    const target = prompts.find((item) => item.id === id);
    if (!target) return;

    setError("");
    const updatedAt = new Date().toISOString();
    const { data, error: favoriteError } = await supabase
      .from("prompts")
      .update({ favorite: !target.favorite, updated_at: updatedAt })
      .eq("id", id)
      .select("id,title,content,category,tags,favorite,created_at,updated_at")
      .single();

    if (favoriteError) {
      setError(favoriteError.message);
      return;
    }

    const updatedPrompt = fromSupabase(data);
    setPrompts((items) =>
      items.map((item) => (item.id === id ? updatedPrompt : item)),
    );
  }

  async function copyPrompt(prompt) {
    await navigator.clipboard.writeText(prompt.content);
    setCopiedId(prompt.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <main className="min-h-screen bg-[#f7f5f0] text-stone-950">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className="border-b border-stone-200 bg-[#fbfaf7]/90 px-4 py-5 lg:w-72 lg:border-b-0 lg:border-r">
          <div className="mb-7 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-stone-950 text-white">
              <Sparkles size={19} />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-normal">Prompt Library</h1>
              <p className="text-sm text-stone-500">{prompts.length} cloud prompts</p>
            </div>
          </div>

          <button className="primary-button mb-6 w-full" onClick={startCreate}>
            <Plus size={17} />
            新建 Prompt
          </button>

          <SidebarSection icon={<Folder size={16} />} title="分类">
            {categories.map((category) => (
              <FilterButton
                key={category}
                active={categoryFilter === category}
                count={
                  category === "All"
                    ? prompts.length
                    : prompts.filter((item) => item.category === category).length
                }
                onClick={() => setCategoryFilter(category)}
              >
                {category === "All" ? "全部" : category}
              </FilterButton>
            ))}
          </SidebarSection>

          <SidebarSection icon={<Hash size={16} />} title="标签">
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <button
                  key={tag}
                  className={`tag-filter ${tagFilter === tag ? "tag-filter-active" : ""}`}
                  onClick={() => setTagFilter(tag)}
                >
                  {tag === "All" ? "全部" : `#${tag}`}
                </button>
              ))}
            </div>
          </SidebarSection>
        </aside>

        <section className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-stone-200 bg-[#f7f5f0]/90 px-4 py-4 backdrop-blur md:px-7">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                <input
                  className="search-input"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索标题、内容、分类或标签"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className={`toolbar-button ${favoritesOnly ? "toolbar-button-active" : ""}`}
                  onClick={() => setFavoritesOnly((value) => !value)}
                >
                  <Bookmark size={16} />
                  收藏
                </button>
                <button
                  className="toolbar-button"
                  onClick={() => {
                    setCategoryFilter("All");
                    setTagFilter("All");
                    setFavoritesOnly(false);
                    setQuery("");
                  }}
                >
                  <Filter size={16} />
                  清除筛选
                </button>
              </div>
            </div>
          </header>

          <div className="grid flex-1 gap-0 xl:grid-cols-[minmax(340px,0.95fr)_minmax(440px,1.25fr)]">
            <section className="border-b border-stone-200 p-4 md:p-7 xl:border-b-0 xl:border-r">
              {error && (
                <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-stone-500">
                  <LayoutGrid size={16} />
                  {isLoading ? "Loading..." : `${filteredPrompts.length} results`}
                </div>
              </div>

              <div className="grid gap-3">
                {!isLoading && filteredPrompts.map((prompt) => (
                  <article
                    key={prompt.id}
                    className={`prompt-card ${activePrompt?.id === prompt.id && !isEditing ? "prompt-card-active" : ""}`}
                    onClick={() => {
                      setActiveId(prompt.id);
                      setIsEditing(false);
                    }}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="category-pill">{prompt.category}</span>
                          {prompt.favorite && <BookmarkCheck className="text-amber-500" size={16} />}
                        </div>
                        <h2 className="truncate text-base font-semibold">{prompt.title}</h2>
                      </div>
                      <button
                        className="icon-button"
                        title="复制"
                        onClick={(event) => {
                          event.stopPropagation();
                          copyPrompt(prompt);
                        }}
                      >
                        {copiedId === prompt.id ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                    </div>
                    <p className="line-clamp-3 text-sm leading-6 text-stone-600">{prompt.content}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {prompt.tags.map((tag) => (
                        <span className="mini-tag" key={tag}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}

                {isLoading && (
                  <div className="empty-state">
                    <Sparkles size={28} />
                    <p>正在从 Supabase 加载 prompts</p>
                  </div>
                )}

                {!isLoading && filteredPrompts.length === 0 && (
                  <div className="empty-state">
                    <Archive size={28} />
                    <p>没有找到匹配的 prompt</p>
                  </div>
                )}
              </div>
            </section>

            <section className="p-4 md:p-7">
              {isEditing ? (
                <PromptForm
                  draft={draft}
                  setDraft={setDraft}
                  onCancel={() => setIsEditing(false)}
                  onSave={saveDraft}
                  isNew={!activeId}
                  isSaving={isSaving}
                />
              ) : activePrompt ? (
                <PromptDetail
                  prompt={activePrompt}
                  copied={copiedId === activePrompt.id}
                  onCopy={() => copyPrompt(activePrompt)}
                  onEdit={() => startEdit(activePrompt)}
                  onDelete={() => deletePrompt(activePrompt.id)}
                  onFavorite={() => toggleFavorite(activePrompt.id)}
                />
              ) : (
                <div className="empty-state min-h-[420px]">
                  <Sparkles size={32} />
                  <p>创建你的第一个 prompt</p>
                  <button className="primary-button mt-4" onClick={startCreate}>
                    <Plus size={17} />
                    新建 Prompt
                  </button>
                </div>
              )}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function SidebarSection({ icon, title, children }) {
  return (
    <section className="mb-7">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">
        {icon}
        {title}
      </div>
      <div className="grid gap-1.5">{children}</div>
    </section>
  );
}

function FilterButton({ active, count, onClick, children }) {
  return (
    <button className={`filter-button ${active ? "filter-button-active" : ""}`} onClick={onClick}>
      <span>{children}</span>
      <span className="text-xs text-stone-400">{count}</span>
    </button>
  );
}

function PromptDetail({ prompt, copied, onCopy, onEdit, onDelete, onFavorite }) {
  return (
    <article className="detail-panel">
      <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="category-pill">{prompt.category}</span>
            <span className="text-sm text-stone-400">更新于 {formatTime(prompt.updatedAt)}</span>
          </div>
          <h2 className="text-2xl font-semibold tracking-normal md:text-3xl">{prompt.title}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="icon-text-button" onClick={onFavorite}>
            {prompt.favorite ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
            {prompt.favorite ? "已收藏" : "收藏"}
          </button>
          <button className="icon-text-button" onClick={onCopy}>
            {copied ? <Check size={17} /> : <Copy size={17} />}
            {copied ? "已复制" : "复制"}
          </button>
          <button className="icon-button" title="编辑" onClick={onEdit}>
            <Edit3 size={17} />
          </button>
          <button className="danger-icon-button" title="删除" onClick={onDelete}>
            <Trash2 size={17} />
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {prompt.tags.map((tag) => (
          <span className="detail-tag" key={tag}>
            <Tag size={13} />
            {tag}
          </span>
        ))}
      </div>

      <pre className="prompt-body">{prompt.content}</pre>
    </article>
  );
}

function PromptForm({ draft, setDraft, onSave, onCancel, isNew, isSaving }) {
  return (
    <form className="detail-panel" onSubmit={onSave}>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-semibold">{isNew ? "新建 Prompt" : "编辑 Prompt"}</h2>
        <button className="icon-button" type="button" title="关闭" onClick={onCancel}>
          <X size={17} />
        </button>
      </div>

      <div className="grid gap-5">
        <label className="field-label">
          标题
          <input
            className="field-input"
            value={draft.title}
            onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))}
            placeholder="例如：Midjourney 人像摄影"
          />
        </label>

        <label className="field-label">
          分类
          <input
            className="field-input"
            value={draft.category}
            onChange={(event) => setDraft((value) => ({ ...value, category: event.target.value }))}
            placeholder="Image / Writing / Code"
          />
        </label>

        <label className="field-label">
          标签
          <input
            className="field-input"
            value={draft.tagsText}
            onChange={(event) => setDraft((value) => ({ ...value, tagsText: event.target.value }))}
            placeholder="用英文逗号分隔，例如 midjourney, portrait, lighting"
          />
        </label>

        <label className="field-label">
          Prompt 内容
          <textarea
            className="field-textarea"
            value={draft.content}
            onChange={(event) => setDraft((value) => ({ ...value, content: event.target.value }))}
            placeholder="写下可复用的 prompt..."
            required
          />
        </label>
      </div>

      <div className="mt-7 flex flex-wrap justify-end gap-2">
        <button className="secondary-button" type="button" onClick={onCancel}>
          取消
        </button>
        <button className="primary-button" type="submit" disabled={isSaving}>
          <Check size={17} />
          {isSaving ? "保存中" : "保存"}
        </button>
      </div>
    </form>
  );
}

createRoot(document.getElementById("root")).render(<App />);
