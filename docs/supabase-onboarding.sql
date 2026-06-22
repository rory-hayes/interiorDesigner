-- Roomwise onboarding persistence model.
-- Apply in Supabase SQL editor, then create private storage buckets:
-- room-photos and room-renders.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  room_type text not null check (room_type in ('living-room', 'bedroom', 'home-office')),
  location text not null,
  budget numeric(10, 2),
  onboarding_status text not null default 'project_created'
    check (onboarding_status in ('project_created', 'photo_uploaded', 'brief_completed', 'shopping_ready')),
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.room_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  source_device text not null check (source_device in ('desktop', 'phone-capture')),
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.renders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  model text not null,
  prompt text not null,
  image_storage_path text,
  status text not null default 'queued' check (status in ('queued', 'running', 'ready', 'failed')),
  error text,
  created_at timestamptz not null default now()
);

create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  selected_product_ids text[] not null default '{}',
  total numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.capture_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create index if not exists profiles_email_idx on public.profiles (email);
create index if not exists projects_owner_created_idx on public.projects (owner_id, created_at desc);
create index if not exists room_assets_project_idx on public.room_assets (project_id, created_at desc);
create index if not exists room_assets_owner_idx on public.room_assets (owner_id);
create index if not exists renders_project_idx on public.renders (project_id, created_at desc);
create index if not exists renders_owner_idx on public.renders (owner_id);
create index if not exists shopping_lists_project_idx on public.shopping_lists (project_id, created_at desc);
create index if not exists shopping_lists_owner_idx on public.shopping_lists (owner_id);
create index if not exists capture_tokens_project_idx on public.capture_tokens (project_id);
create index if not exists capture_tokens_owner_expires_idx on public.capture_tokens (owner_id, expires_at desc);

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.room_assets enable row level security;
alter table public.renders enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.capture_tokens enable row level security;

drop policy if exists "profiles are self-owned" on public.profiles;
drop policy if exists "projects are owner-only" on public.projects;
drop policy if exists "room assets are owner-only" on public.room_assets;
drop policy if exists "renders are owner-only" on public.renders;
drop policy if exists "shopping lists are owner-only" on public.shopping_lists;
drop policy if exists "capture tokens are owner-only" on public.capture_tokens;

create policy "profiles are self-owned"
  on public.profiles
  for all
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "projects are owner-only"
  on public.projects
  for all
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "room assets are owner-only"
  on public.room_assets
  for all
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "renders are owner-only"
  on public.renders
  for all
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "shopping lists are owner-only"
  on public.shopping_lists
  for all
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "capture tokens are owner-only"
  on public.capture_tokens
  for all
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

insert into storage.buckets (id, name, public)
values
  ('room-photos', 'room-photos', false),
  ('room-renders', 'room-renders', false)
on conflict (id) do update set public = excluded.public;

-- Store objects under user-id/project-id/file-name so storage policies can
-- authorize by the first path folder without joining project tables.
drop policy if exists "room photos are owner-readable" on storage.objects;
drop policy if exists "room photos are owner-writable" on storage.objects;
drop policy if exists "room renders are owner-readable" on storage.objects;
drop policy if exists "room renders are owner-writable" on storage.objects;

create policy "room photos are owner-readable"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'room-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "room photos are owner-writable"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'room-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "room renders are owner-readable"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'room-renders' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "room renders are owner-writable"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'room-renders' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- QR capture implementation note:
-- create short-lived capture_tokens from an authenticated desktop session,
-- store only a hash of the token, and let the phone upload endpoint validate
-- token_hash, project_id, expires_at, and used_at with the service-role key.
