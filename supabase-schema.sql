create extension if not exists pgcrypto;

create table if not exists public.prompts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  category text not null default 'General',
  tags text[] not null default '{}',
  favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prompts_category_idx on public.prompts (category);
create index if not exists prompts_favorite_idx on public.prompts (favorite);
create index if not exists prompts_updated_at_idx on public.prompts (updated_at desc);
create index if not exists prompts_tags_idx on public.prompts using gin (tags);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_prompts_updated_at on public.prompts;
create trigger set_prompts_updated_at
before update on public.prompts
for each row
execute function public.set_updated_at();

alter table public.prompts enable row level security;

create policy "Allow public read prompts"
on public.prompts
for select
using (true);

create policy "Allow public insert prompts"
on public.prompts
for insert
with check (true);

create policy "Allow public update prompts"
on public.prompts
for update
using (true)
with check (true);

create policy "Allow public delete prompts"
on public.prompts
for delete
using (true);
