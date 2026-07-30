drop policy if exists client_admin_own_invites on invites;
create policy client_admin_own_invites on invites
  for all to authenticated
  using (org_id in (select user_org_ids()) and exists (
    select 1 from memberships m where m.user_id = auth.uid() and m.org_id = invites.org_id and m.role::text = 'client_admin'))
  with check (org_id in (select user_org_ids()) and exists (
    select 1 from memberships m where m.user_id = auth.uid() and m.org_id = invites.org_id and m.role::text = 'client_admin'));
