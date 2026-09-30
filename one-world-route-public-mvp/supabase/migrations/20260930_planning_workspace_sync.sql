create table if not exists public.planning_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  workspace jsonb not null check (jsonb_typeof(workspace) = 'object'),
  client_updated_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.planning_workspaces enable row level security;

drop policy if exists "planning_workspaces_select_own" on public.planning_workspaces;
create policy "planning_workspaces_select_own"
  on public.planning_workspaces
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "planning_workspaces_insert_own" on public.planning_workspaces;
create policy "planning_workspaces_insert_own"
  on public.planning_workspaces
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "planning_workspaces_update_own" on public.planning_workspaces;
create policy "planning_workspaces_update_own"
  on public.planning_workspaces
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "planning_workspaces_delete_own" on public.planning_workspaces;
create policy "planning_workspaces_delete_own"
  on public.planning_workspaces
  for delete
  to authenticated
  using (auth.uid() = user_id);

revoke all on public.planning_workspaces from anon;
grant select, insert, update, delete on public.planning_workspaces to authenticated;
