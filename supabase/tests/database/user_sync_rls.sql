begin;

select plan(18);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.user_events'::regclass),
  'user_events has RLS enabled'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.user_events'::regclass),
  'user_events forces RLS'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.user_documents'::regclass),
  'user_documents has RLS enabled'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.user_documents'::regclass),
  'user_documents forces RLS'
);

set local role anon;
select throws_ok(
  $$select count(*) from public.user_events$$,
  '42501',
  'anon cannot read user_events'
);
select throws_ok(
  $$select count(*) from public.user_documents$$,
  '42501',
  'anon cannot read user_documents'
);
reset role;

select tests.create_supabase_user('sync-a@example.com');
select tests.create_supabase_user('sync-b@example.com');
select tests.authenticate_as('sync-a@example.com');

select lives_ok($sql$
  insert into public.user_events
    (id, user_id, event_type, entity_id, payload, occurred_at, device_id)
  values
    ('00000000-0000-0000-0000-000000000001',
     (select id from auth.users where email = 'sync-a@example.com'),
     'activity_recorded', 'a', '{}'::jsonb, now(),
     '00000000-0000-0000-0000-000000000011')
$sql$, 'user A can insert an event owned by user A');
select is((select count(*)::int from public.user_events), 1, 'user A can read own event');

select throws_ok($sql$
  insert into public.user_events
    (id, user_id, event_type, entity_id, payload, occurred_at, device_id)
  values
    ('00000000-0000-0000-0000-000000000002',
     (select id from auth.users where email = 'sync-b@example.com'),
     'activity_recorded', 'b', '{}'::jsonb, now(),
     '00000000-0000-0000-0000-000000000012')
$sql$, '42501', 'user A cannot insert an event owned by user B');

select lives_ok($sql$
  insert into public.user_documents
    (id, user_id, document_type, entity_id, payload, version, device_id, client_updated_at)
  values
    ('00000000-0000-0000-0000-000000000101',
     (select id from auth.users where email = 'sync-a@example.com'),
     'note', 'note-a', '{"id":"00000000-0000-0000-0000-000000000102","contentId":"a","body":"local","createdAt":"2026-09-09T00:00:00.000Z","updatedAt":"2026-09-09T00:00:00.000Z","deletedAt":null}'::jsonb,
     1, '00000000-0000-0000-0000-000000000011', now())
$sql$, 'user A can insert own document');
select is((select count(*)::int from public.user_documents), 1, 'user A can read own document');

select lives_ok($sql$
  update public.user_documents
  set payload = payload || '{"body":"updated"}'::jsonb, version = 2,
      device_id = '00000000-0000-0000-0000-000000000011', client_updated_at = now()
  where id = '00000000-0000-0000-0000-000000000101' and version = 1
$sql$, 'user A can advance a document by one version');
select throws_ok($sql$
  update public.user_documents set version = 4
  where id = '00000000-0000-0000-0000-000000000101' and version = 2
$sql$, 'P0001', 'document versions cannot skip a version');

select tests.authenticate_as('sync-b@example.com');
select is((select count(*)::int from public.user_events), 0, 'user B cannot read user A events');
select is((select count(*)::int from public.user_documents), 0, 'user B cannot read user A documents');
select lives_ok($sql$
  update public.user_documents set payload = '{}'::jsonb, version = 3
  where id = '00000000-0000-0000-0000-000000000101' and version = 2
$sql$, 'user B cannot update user A document');
select tests.authenticate_as('sync-a@example.com');
select is((select payload->>'body' from public.user_documents where id = '00000000-0000-0000-0000-000000000101'), 'updated', 'user B update did not change user A document');
select tests.authenticate_as('sync-b@example.com');
select throws_ok($sql$
  insert into public.user_documents
    (id, user_id, document_type, entity_id, payload, version, device_id, client_updated_at)
  values
    ('00000000-0000-0000-0000-000000000201',
     (select id from auth.users where email = 'sync-a@example.com'),
     'note', 'note-b', '{}'::jsonb, 1,
     '00000000-0000-0000-0000-000000000012', now())
$sql$, '42501', 'user B cannot insert a document owned by user A');

select tests.clear_authentication();
select * from finish();
rollback;
