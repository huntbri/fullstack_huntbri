create extension if not exists pgcrypto;

drop table if exists public.camps cascade;

do $$
begin
  create type public.user_role as enum ('admin', 'member');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null,
  created_at timestamptz not null default now()
);

create table if not exists public.community_classes (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text not null,
  instructor_name text not null,
  location text not null,
  starts_at timestamptz not null,
  capacity integer not null check (capacity > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.class_registrations (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.community_classes(id) on delete cascade,
  member_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (class_id, member_id)
);

create index if not exists community_classes_created_idx
  on public.community_classes (created_at desc);

create index if not exists class_registrations_member_idx
  on public.class_registrations (member_id, created_at desc);

alter table public.users enable row level security;
alter table public.community_classes enable row level security;
alter table public.class_registrations enable row level security;

drop policy if exists "users_can_read_own_user_row" on public.users;
create policy "users_can_read_own_user_row"
  on public.users
  for select
  using (auth.uid() = id);

drop policy if exists "users_can_insert_own_user_row" on public.users;
create policy "users_can_insert_own_user_row"
  on public.users
  for insert
  with check (auth.uid() = id);

drop policy if exists "authenticated_users_can_read_classes" on public.community_classes;
create policy "authenticated_users_can_read_classes"
  on public.community_classes
  for select
  to authenticated
  using (true);

drop policy if exists "admins_can_insert_classes" on public.community_classes;
create policy "admins_can_insert_classes"
  on public.community_classes
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and u.role = 'admin'
    )
  );

drop policy if exists "members_can_read_own_registrations" on public.class_registrations;
create policy "members_can_read_own_registrations"
  on public.class_registrations
  for select
  to authenticated
  using (member_id = auth.uid());

drop policy if exists "members_can_register_once_per_class" on public.class_registrations;
create policy "members_can_register_once_per_class"
  on public.class_registrations
  for insert
  to authenticated
  with check (
    member_id = auth.uid()
    and exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and u.role = 'member'
    )
  );

do $$
declare
  seed_user_id uuid;
begin
  select id
  into seed_user_id
  from public.users
  where role = 'admin'
  order by created_at asc
  limit 1;

  if seed_user_id is null then
    select id
    into seed_user_id
    from public.users
    order by created_at asc
    limit 1;
  end if;

  if seed_user_id is null then
    return;
  end if;

  if not exists (
    select 1
    from public.community_classes
    where title = 'Neighborhood Pottery Basics'
      and starts_at = '2026-03-20T22:30:00Z'::timestamptz
  ) then
    insert into public.community_classes (
      created_by,
      title,
      description,
      instructor_name,
      location,
      starts_at,
      capacity
    )
    values (
      seed_user_id,
      'Neighborhood Pottery Basics',
      'Learn wheel and hand-building fundamentals and take home two finished pieces.',
      'Avery Collins',
      'Riverside Arts Studio',
      '2026-03-20T22:30:00Z'::timestamptz,
      16
    );
  end if;

  if not exists (
    select 1
    from public.community_classes
    where title = 'Urban Garden 101'
      and starts_at = '2026-03-27T23:00:00Z'::timestamptz
  ) then
    insert into public.community_classes (
      created_by,
      title,
      description,
      instructor_name,
      location,
      starts_at,
      capacity
    )
    values (
      seed_user_id,
      'Urban Garden 101',
      'Build a container garden plan for balconies and small yards with seasonal crop tips.',
      'Maya Rios',
      'Maple Community Greenhouse',
      '2026-03-27T23:00:00Z'::timestamptz,
      24
    );
  end if;

  if not exists (
    select 1
    from public.community_classes
    where title = 'Conversational Spanish for Travelers'
      and starts_at = '2026-04-02T23:30:00Z'::timestamptz
  ) then
    insert into public.community_classes (
      created_by,
      title,
      description,
      instructor_name,
      location,
      starts_at,
      capacity
    )
    values (
      seed_user_id,
      'Conversational Spanish for Travelers',
      'Practice high-use travel phrases through guided roleplay and pronunciation drills.',
      'Diego Herrera',
      'Eastside Library - Room B',
      '2026-04-02T23:30:00Z'::timestamptz,
      20
    );
  end if;

  if not exists (
    select 1
    from public.community_classes
    where title = 'Beginner Watercolor Workshop'
      and starts_at = '2026-04-10T22:00:00Z'::timestamptz
  ) then
    insert into public.community_classes (
      created_by,
      title,
      description,
      instructor_name,
      location,
      starts_at,
      capacity
    )
    values (
      seed_user_id,
      'Beginner Watercolor Workshop',
      'Learn basic watercolor techniques and create your own landscape painting.',
      'Sophie Lin',
      'Westside Art Studio',
      '2026-04-10T22:00:00Z'::timestamptz,
      18
    );
  end if;

  if not exists (
    select 1
    from public.community_classes
    where title = 'Family Board Game Night'
      and starts_at = '2026-04-15T23:00:00Z'::timestamptz
  ) then
    insert into public.community_classes (
      created_by,
      title,
      description,
      instructor_name,
      location,
      starts_at,
      capacity
    )
    values (
      seed_user_id,
      'Family Board Game Night',
      'Bring your family and enjoy classic and new board games together.',
      'Jordan Lee',
      'Community Hall',
      '2026-04-15T23:00:00Z'::timestamptz,
      30
    );
  end if;

  if not exists (
    select 1
    from public.community_classes
    where title = 'Spring Nature Walk'
      and starts_at = '2026-04-20T18:00:00Z'::timestamptz
  ) then
    insert into public.community_classes (
      created_by,
      title,
      description,
      instructor_name,
      location,
      starts_at,
      capacity
    )
    values (
      seed_user_id,
      'Spring Nature Walk',
      'Join a guided walk to discover local plants and wildlife.',
      'Maria Gomez',
      'Riverside Park Entrance',
      '2026-04-20T18:00:00Z'::timestamptz,
      25
    );
  end if;

  if not exists (
    select 1
    from public.community_classes
    where title = 'Intro to Coding for Teens'
      and starts_at = '2026-04-25T21:00:00Z'::timestamptz
  ) then
    insert into public.community_classes (
      created_by,
      title,
      description,
      instructor_name,
      location,
      starts_at,
      capacity
    )
    values (
      seed_user_id,
      'Intro to Coding for Teens',
      'A hands-on introduction to programming using fun projects.',
      'Alex Patel',
      'Tech Lab',
      '2026-04-25T21:00:00Z'::timestamptz,
      20
    );
  end if;

  if not exists (
    select 1
    from public.community_classes
    where title = 'Community Choir Rehearsal'
      and starts_at = '2026-05-01T19:00:00Z'::timestamptz
  ) then
    insert into public.community_classes (
      created_by,
      title,
      description,
      instructor_name,
      location,
      starts_at,
      capacity
    )
    values (
      seed_user_id,
      'Community Choir Rehearsal',
      'Sing with neighbors and prepare for the spring concert.',
      'Linda Chen',
      'Music Room',
      '2026-05-01T19:00:00Z'::timestamptz,
      40
    );
  end if;
end $$;
