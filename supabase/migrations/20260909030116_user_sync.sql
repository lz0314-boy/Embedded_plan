create table public.user_events (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in (
    'content_completed', 'content_reopened', 'bookmark_set',
    'review_rated', 'quiz_submitted', 'activity_recorded'
  )),
  entity_id text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  device_id uuid not null,
  created_at timestamptz not null default pg_catalog.now(),
  constraint user_events_payload_size check (octet_length(payload::text) <= 262144)
);

create table public.user_documents (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null check (document_type in (
    'settings', 'note', 'code_draft', 'interview_session', 'project_case'
  )),
  entity_id text not null,
  payload jsonb not null,
  version bigint not null default 1 check (version > 0),
  device_id uuid not null,
  client_updated_at timestamptz not null,
  server_updated_at timestamptz not null default pg_catalog.now(),
  deleted_at timestamptz,
  unique (user_id, document_type, entity_id),
  constraint user_documents_payload_size check (octet_length(payload::text) <= 262144)
);

create index user_events_pull_idx
  on public.user_events (user_id, created_at, id);

create index user_documents_pull_idx
  on public.user_documents (user_id, server_updated_at, id);

create or replace function public.touch_user_document_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.version <> 1 then
      raise exception 'new document version must be 1';
    end if;
    new.server_updated_at = pg_catalog.now();
    return new;
  end if;

  if new.version <> old.version + 1 then
    raise exception 'document version must increase by exactly one';
  end if;
  if new.user_id <> old.user_id
    or new.document_type <> old.document_type
    or new.entity_id <> old.entity_id
    or new.id <> old.id then
    raise exception 'document identity is immutable';
  end if;
  new.server_updated_at = pg_catalog.now();
  return new;
end;
$$;

create trigger touch_user_document_updated_at
before insert or update on public.user_documents
for each row execute function public.touch_user_document_updated_at();

alter table public.user_events enable row level security;
alter table public.user_events force row level security;
alter table public.user_documents enable row level security;
alter table public.user_documents force row level security;

revoke all on public.user_events from public, anon, authenticated;
revoke all on public.user_documents from public, anon, authenticated;

grant select on public.user_events to authenticated;
grant insert (id, user_id, event_type, entity_id, payload, occurred_at, device_id)
  on public.user_events to authenticated;
grant select on public.user_documents to authenticated;
grant insert (id, user_id, document_type, entity_id, payload, version,
  device_id, client_updated_at, deleted_at)
  on public.user_documents to authenticated;
grant update (payload, version, device_id, client_updated_at, deleted_at)
  on public.user_documents to authenticated;

create policy "events_select_own" on public.user_events
for select to authenticated
using ((select auth.uid()) = user_id);

create policy "events_insert_own" on public.user_events
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "documents_select_own" on public.user_documents
for select to authenticated
using ((select auth.uid()) = user_id);

create policy "documents_insert_own" on public.user_documents
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "documents_update_own" on public.user_documents
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on function public.touch_user_document_updated_at() from public, anon, authenticated;
grant execute on function public.touch_user_document_updated_at() to authenticated, service_role;
