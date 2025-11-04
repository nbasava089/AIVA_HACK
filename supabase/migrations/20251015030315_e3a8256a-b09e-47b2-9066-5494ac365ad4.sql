-- Fix recursive RLS on profiles and introduce secure helper to access current user's tenant id

-- 1) Helper function to fetch a user's tenant id without triggering RLS recursion
create or replace function public.get_user_tenant_id(_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.profiles where id = _user_id
$$;

-- 2) Replace the recursive SELECT policy on profiles
drop policy if exists "Users can view profiles in their tenant" on public.profiles;

-- Allow users to view their own profile explicitly (non-recursive)
create policy "Users can view their own profile (self)"
on public.profiles
for select
using (id = auth.uid());

-- Allow users to view other profiles within the same tenant via security definer helper
create policy "Users can view profiles in their tenant (definer)"
on public.profiles
for select
using (tenant_id = public.get_user_tenant_id(auth.uid()));
