-- 044 · Academy · Fase 2 Bloco 7: pagamento com liberação gratuita
-- Aditivo: nenhum DROP.
--
-- A regra é uma só, e vive em UM lugar (fn_academy_matricula_liberada): a matrícula nasce
-- 'ativa' se o curso é gratuito, OU existe pedido pago, OU um admin liberou. Fora disso, ela
-- nasce 'pendente' e o conteúdo não abre — a policy de academy_courses já exige status='ativa'.
--
-- Por que o gate é gatilho e não código de aplicação: `academy_enrollments_ins` permite ao
-- gestor de cliente criar matrícula para a equipe dele. Se o gate estivesse só na Server Action,
-- um gestor poderia inserir direto pelo PostgREST e liberar curso pago sem pagar.

alter table academy_courses add column if not exists preco_centavos int not null default 0
  constraint ac_preco_check check (preco_centavos >= 0);
alter table academy_courses add column if not exists gratuito boolean not null default true;
alter table academy_courses add column if not exists checkout_url text;

alter table academy_enrollments drop constraint if exists ae_status_check;
alter table academy_enrollments add constraint ae_status_check
  check (status in ('pendente','ativa','concluida','cancelada','expirada'));

create table if not exists academy_orders (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references academy_courses(id) on delete cascade,
  user_id uuid not null,
  enrollment_id uuid references academy_enrollments(id) on delete set null,
  provider text not null default 'asaas'
    constraint ao_provider_check check (provider in ('asaas','stripe','manual')),
  provider_ref text,
  valor_centavos int not null default 0,
  status text not null default 'pendente'
    constraint ao_status_check check (status in ('pendente','pago','cancelado','estornado')),
  email text,
  checkout_url text,
  pago_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ix_ao_user on academy_orders(user_id);
create index if not exists ix_ao_course on academy_orders(course_id);
create unique index if not exists uq_ao_provider_ref on academy_orders(provider_ref) where provider_ref is not null;

create or replace function fn_academy_matricula_liberada() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_gratuito boolean; v_preco int; v_pago boolean;
begin
  if is_salestrack_admin() or new.origem = 'salestrack' then return new; end if;
  select gratuito, preco_centavos into v_gratuito, v_preco from academy_courses where id = new.course_id;
  if coalesce(v_gratuito, true) or coalesce(v_preco, 0) = 0 then return new; end if;
  select exists (select 1 from academy_orders o
    where o.course_id = new.course_id and o.user_id = new.user_id and o.status = 'pago') into v_pago;
  if not v_pago then new.status := 'pendente'; end if;
  return new;
end;
$$;
drop trigger if exists trg_academy_matricula_liberada on academy_enrollments;
create trigger trg_academy_matricula_liberada before insert on academy_enrollments
  for each row execute function fn_academy_matricula_liberada();

alter table academy_orders enable row level security;
drop policy if exists academy_orders_select on academy_orders;
create policy academy_orders_select on academy_orders for select to authenticated
  using (is_salestrack_admin() or user_id = (select auth.uid()));
drop policy if exists academy_orders_ins on academy_orders;
create policy academy_orders_ins on academy_orders for insert to authenticated
  with check (is_salestrack_admin() or (user_id = (select auth.uid()) and status = 'pendente' and pago_em is null));
drop policy if exists academy_orders_upd on academy_orders;
create policy academy_orders_upd on academy_orders for update to authenticated
  using (is_salestrack_admin()) with check (is_salestrack_admin());
drop policy if exists academy_orders_del on academy_orders;
create policy academy_orders_del on academy_orders for delete to authenticated using (is_salestrack_admin());
