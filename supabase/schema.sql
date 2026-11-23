-- =====================================================================
-- Feek El Hayah Choir website — Supabase database setup
-- How to use: Supabase → SQL Editor → New query → paste ALL of this → Run
-- (Safe to run again: it only creates what is missing.)
-- =====================================================================

-- ---------- tables ----------
create table if not exists public.settings (
  key   text primary key,
  value jsonb
);

create table if not exists public.concerts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  title_ar text not null, title_en text,
  description_ar text, description_en text,
  venue_ar text, venue_en text,
  date timestamptz not null,
  poster_url text,
  status text default 'upcoming' check (status in ('upcoming','cancelled')),
  booking_open boolean default true,
  receipt_required boolean default true,
  payment_info_ar text, payment_info_en text,
  layout jsonb
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  concert_id uuid references public.concerts(id) on delete cascade,
  code text unique,
  seats text[] not null,
  name text not null, phone text not null, email text, notes text,
  total numeric default 0,
  receipt_path text,
  status text default 'pending' check (status in ('pending','confirmed','cancelled'))
);

create table if not exists public.albums (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  title_ar text not null, title_en text, date date
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  album_id uuid references public.albums(id) on delete cascade,
  url text not null, caption_ar text, caption_en text
);

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  title_ar text not null, title_en text, youtube_url text not null, sort int default 1
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name_ar text not null, name_en text, role_ar text, role_en text, photo_url text, sort int default 1
);

create table if not exists public.auditions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  full_name text not null, phone text not null, email text, age int, gender text, voice_type text,
  church text, instrument text, experience text, why text, recording_path text,
  status text default 'new' check (status in ('new','invited','accepted','rejected')),
  admin_notes text
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  full_name text not null, phone text, email text, message text not null, is_read boolean default false
);

-- Who is an admin (add your user after creating it in Authentication → Users)
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text
);

-- ---------- helper: is the logged-in user an admin? ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------- row level security ----------
alter table public.settings  enable row level security;
alter table public.concerts  enable row level security;
alter table public.bookings  enable row level security;
alter table public.albums    enable row level security;
alter table public.photos    enable row level security;
alter table public.videos    enable row level security;
alter table public.members   enable row level security;
alter table public.auditions enable row level security;
alter table public.messages  enable row level security;
alter table public.admins    enable row level security;

do $$
declare t text;
begin
  -- public content: everyone can read, only admins can change
  foreach t in array array['settings','concerts','albums','photos','videos','members'] loop
    execute format('drop policy if exists "public read" on public.%I', t);
    execute format('create policy "public read" on public.%I for select using (true)', t);
  end loop;
  -- admins can do everything on every table
  foreach t in array array['settings','concerts','bookings','albums','photos','videos','members','auditions','messages','admins'] loop
    execute format('drop policy if exists "admin all" on public.%I', t);
    execute format('create policy "admin all" on public.%I for all using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- visitors may SEND auditions and messages, but cannot read them
drop policy if exists "public insert" on public.auditions;
create policy "public insert" on public.auditions for insert to anon, authenticated
  with check (status = 'new' and coalesce(admin_notes,'') = '');
drop policy if exists "public insert" on public.messages;
create policy "public insert" on public.messages for insert to anon, authenticated
  with check (is_read = false);
-- (bookings are created only through the book_seats function below)

-- ---------- booking functions ----------
-- list of taken seats (no personal data)
create or replace function public.get_taken_seats(p_concert uuid) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(s), '{}') from public.bookings b, unnest(b.seats) s
  where b.concert_id = p_concert and b.status <> 'cancelled';
$$;

-- create a booking safely (no double booking)
create or replace function public.book_seats(
  p_concert uuid, p_seats text[], p_name text, p_phone text, p_email text,
  p_notes text, p_total numeric, p_receipt text
) returns text
language plpgsql security definer set search_path = public as $$
declare v_code text; v_c public.concerts;
begin
  select * into v_c from public.concerts where id = p_concert;
  if v_c.id is null or v_c.status = 'cancelled' or v_c.booking_open = false then
    raise exception 'BOOKING_CLOSED';
  end if;
  if coalesce(array_length(p_seats,1),0) = 0 or array_length(p_seats,1) > 20 then
    raise exception 'BAD_SEATS';
  end if;
  if length(coalesce(p_name,'')) < 2 or length(coalesce(p_phone,'')) < 8 then
    raise exception 'BAD_DETAILS';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_concert::text));
  if exists (select 1 from public.bookings b where b.concert_id = p_concert
             and b.status <> 'cancelled' and b.seats && p_seats) then
    raise exception 'SEATS_TAKEN';
  end if;
  loop
    v_code := 'FH-' || upper(substr(md5(random()::text), 1, 6));
    exit when not exists (select 1 from public.bookings where code = v_code);
  end loop;
  insert into public.bookings (concert_id, code, seats, name, phone, email, notes, total, receipt_path, status)
  values (p_concert, v_code, p_seats, left(p_name,80), left(p_phone,20), left(p_email,120), left(p_notes,500), p_total, p_receipt, 'pending');
  return v_code;
end $$;

-- a visitor can check their booking with code + phone
create or replace function public.check_booking(p_code text, p_phone text)
returns table (status text, seats text[], title_ar text, title_en text, date timestamptz)
language sql stable security definer set search_path = public as $$
  select b.status, b.seats, c.title_ar, c.title_en, c.date
  from public.bookings b join public.concerts c on c.id = b.concert_id
  where upper(b.code) = upper(trim(p_code))
    and regexp_replace(b.phone, '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g');
$$;

grant execute on function public.get_taken_seats(uuid) to anon, authenticated;
grant execute on function public.book_seats(uuid,text[],text,text,text,text,numeric,text) to anon, authenticated;
grant execute on function public.check_booking(text,text) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------- file storage ----------
insert into storage.buckets (id, name, public) values ('media', 'media', true)
  on conflict (id) do nothing;            -- photos, posters (public)
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false)
  on conflict (id) do nothing;            -- payment receipts (private)
insert into storage.buckets (id, name, public) values ('auditions', 'auditions', false)
  on conflict (id) do nothing;            -- voice recordings (private)

-- size limits: 10 MB for visitor uploads, 15 MB for admin photos
update storage.buckets set file_size_limit = 10485760,
  allowed_mime_types = array['image/*','application/pdf'] where id = 'receipts';
update storage.buckets set file_size_limit = 10485760,
  allowed_mime_types = array['audio/*','video/*'] where id = 'auditions';
update storage.buckets set file_size_limit = 15728640,
  allowed_mime_types = array['image/*'] where id = 'media';

drop policy if exists "media public read" on storage.objects;
create policy "media public read" on storage.objects for select using (bucket_id = 'media');
drop policy if exists "admin files" on storage.objects;
create policy "admin files" on storage.objects for all
  using (bucket_id in ('media','receipts','auditions') and public.is_admin())
  with check (bucket_id in ('media','receipts','auditions') and public.is_admin());
drop policy if exists "visitors upload receipts and recordings" on storage.objects;
create policy "visitors upload receipts and recordings" on storage.objects for insert to anon, authenticated
  with check (bucket_id in ('receipts','auditions'));

-- =====================================================================
-- LAST STEP (after creating your admin user in Authentication → Users):
-- replace the email below with yours and run these 2 lines:
--
-- insert into public.admins (user_id, email)
--   select id, email from auth.users where email = 'marcomedhat95@gmail.com';
-- =====================================================================
