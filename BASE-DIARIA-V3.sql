-- BASE DIÁRIA V3 — execute inteiro após a atualização V2.
-- Preserva dados e datas. A base existente vira o saldo inicial do primeiro lançamento.
begin;
lock table public.sample_records in share row exclusive mode;
lock table public.daily_records in share row exclusive mode;
do $$ begin
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='daily_records' and column_name='record_id') then
  raise exception 'Conclua ATUALIZACAO-DIARIA-V2.sql antes da atualização V3.';
 end if;
end $$;
alter table public.daily_records add column if not exists base_added integer;
alter table public.sample_records add column if not exists number_not_exists integer;
alter table public.sample_records add column if not exists not_voting integer;
update public.sample_records set number_not_exists=0 where number_not_exists is null;
update public.sample_records set not_voting=0 where not_voting is null;
alter table public.sample_records alter column number_not_exists set default 0;
alter table public.sample_records alter column number_not_exists set not null;
alter table public.sample_records alter column not_voting set default 0;
alter table public.sample_records alter column not_voting set not null;
alter table public.daily_records add column if not exists number_not_exists integer;
alter table public.daily_records add column if not exists not_voting integer;
drop trigger if exists daily_validate_v2 on public.daily_records;
drop trigger if exists daily_sync_v2 on public.daily_records;
-- Bases sem lançamento recebem um registro inicial, sem apagar ou substituir outras datas.
insert into public.daily_records(record_id,coordinator,leader,record_date,confirmed,not_confirmed,does_not_know,mailbox,number_not_exists,not_voting,base_added,notes)
select s.id,s.coordinator,s.leader,s.record_date,s.confirmed,s.not_confirmed,s.does_not_know,s.mailbox,s.number_not_exists,s.not_voting,s.total_base,'Saldo inicial preservado na atualização da base diária.'
from public.sample_records s where not exists(select 1 from public.daily_records d where d.record_id=s.id);
-- Só atribui o saldo inicial uma vez, na primeira execução.
update public.daily_records d set base_added=s.total_base
from public.sample_records s where d.record_id=s.id and d.base_added is null
and d.id=(select x.id from public.daily_records x where x.record_id=s.id order by x.record_date,x.id limit 1)
and not exists(select 1 from public.daily_records x where x.record_id=s.id and x.base_added is not null);
update public.daily_records set base_added=0 where base_added is null;
update public.daily_records set number_not_exists=0 where number_not_exists is null;
update public.daily_records set not_voting=0 where not_voting is null;
alter table public.daily_records alter column base_added set default 0;
alter table public.daily_records alter column base_added set not null;
alter table public.daily_records alter column number_not_exists set default 0;
alter table public.daily_records alter column number_not_exists set not null;
alter table public.daily_records alter column not_voting set default 0;
alter table public.daily_records alter column not_voting set not null;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='daily_base_added_nonnegative_v3' and conrelid='public.daily_records'::regclass) then
  alter table public.daily_records add constraint daily_base_added_nonnegative_v3 check(base_added>=0);
 end if;
 if not exists(select 1 from pg_constraint where conname='daily_extra_results_nonnegative_v4' and conrelid='public.daily_records'::regclass) then
  alter table public.daily_records add constraint daily_extra_results_nonnegative_v4 check(number_not_exists>=0 and not_voting>=0);
 end if;
end $$;

create or replace function public.validate_daily_v2()
returns trigger language plpgsql security definer set search_path=public as $$
declare b public.sample_records; target bigint; remove_id bigint; minimum_balance numeric; base_sum numeric; invalid_day date;
begin
 target=case when TG_OP='DELETE' then old.record_id else new.record_id end;
 remove_id=case when TG_OP='INSERT' then null else old.id end;
 select * into b from public.sample_records where id=target for update;
 if not found then
  if TG_OP='DELETE' then return old; end if;
  raise exception 'Registro não encontrado.';
 end if;
 if TG_OP<>'DELETE' then
  if TG_OP='UPDATE' and new.record_id<>old.record_id then raise exception 'Não é possível transferir o lançamento para outro líder.'; end if;
  if new.record_date is null or new.record_date>(now() at time zone 'America/Manaus')::date then raise exception 'Informe uma data válida, até hoje.'; end if;
  if new.base_added is null or new.base_added<0 or new.confirmed<0 or new.not_confirmed<0 or new.does_not_know<0 or new.mailbox<0 or new.number_not_exists<0 or new.not_voting<0 then raise exception 'Use inteiros não negativos.'; end if;
 end if;
 with entries as (
  select record_date,base_added::bigint base,confirmed::bigint+not_confirmed+does_not_know+mailbox+number_not_exists+not_voting contacts
  from public.daily_records where record_id=target and (remove_id is null or id<>remove_id)
  union all
  select new.record_date,new.base_added::bigint,new.confirmed::bigint+new.not_confirmed+new.does_not_know+new.mailbox+new.number_not_exists+new.not_voting where TG_OP<>'DELETE'
 ), days as (
  select record_date,sum(base) base,sum(contacts) contacts,sum(base-contacts) delta from entries group by record_date
 ), balances as (
  select sum(delta) over(order by record_date) balance,base,contacts,record_date from days
 ) select min(balance),sum(base),min(record_date) filter(where contacts>base) into minimum_balance,base_sum,invalid_day from balances;
 if invalid_day is not null then raise exception 'A soma dos resultados de % ultrapassa a base cadastrada no mesmo dia.', to_char(invalid_day,'DD/MM/YYYY'); end if;
 if coalesce(base_sum,0)>2147483647 then raise exception 'A base acumulada ultrapassa o limite suportado.'; end if;
 if TG_OP='DELETE' then return old; end if;
 new.coordinator=b.coordinator;new.leader=b.leader;new.updated_at=now();
 return new;
end $$;
create or replace function public.sync_daily_v2()
returns trigger language plpgsql security definer set search_path=public as $$
declare target bigint;
begin
 target=case when TG_OP='DELETE' then old.record_id else new.record_id end;
 perform 1 from public.sample_records where id=target for update;
 update public.sample_records s set total_base=t.b,confirmed=t.c,not_confirmed=t.n,does_not_know=t.d,mailbox=t.m,number_not_exists=t.x,not_voting=t.v,updated_at=now()
 from (select coalesce(sum(base_added),0)::integer b,coalesce(sum(confirmed),0)::integer c,coalesce(sum(not_confirmed),0)::integer n,
 coalesce(sum(does_not_know),0)::integer d,coalesce(sum(mailbox),0)::integer m,coalesce(sum(number_not_exists),0)::integer x,coalesce(sum(not_voting),0)::integer v from public.daily_records where record_id=target) t
 where s.id=target;
 return null;
end $$;
create trigger daily_validate_v2 before insert or update or delete on public.daily_records for each row execute function public.validate_daily_v2();
create trigger daily_sync_v2 after insert or update or delete on public.daily_records for each row execute function public.sync_daily_v2();

-- O mesmo coordenador/líder recebe um novo lançamento, não outra base duplicada.
create or replace function public.save_sampling_base_v2(p_id bigint,p_values jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare b public.sample_records; target bigint; matches integer; day date; added integer; c integer; n integer; d integer; m integer; x integer; v integer;
 coord text; leader_name text;
begin
 if auth.uid() is null then raise exception 'Entre na sua conta para salvar.'; end if;
 coord=trim(coalesce(p_values->>'coordinator',''));leader_name=trim(coalesce(p_values->>'leader',''));
 if coord='' or leader_name='' then raise exception 'Preencha coordenador e líder.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(lower(coord)||chr(31)||lower(leader_name),0));
 if p_id is null then
  select count(*),min(id) into matches,target from public.sample_records
  where lower(trim(coordinator))=lower(coord) and lower(trim(leader))=lower(leader_name);
  if matches>1 then raise exception 'Existem líderes com nomes iguais. Escolha o registro em Registros diários.'; end if;
  added=(p_values->>'total_base')::integer;
  if added is null or added<0 then raise exception 'Informe a base adicionada no dia (zero se não houver novas pessoas).'; end if;
  day=(p_values->>'record_date')::date;
  if day is null then raise exception 'Informe a data do lançamento.'; end if;
  c=coalesce((p_values->>'confirmed')::integer,0);n=coalesce((p_values->>'not_confirmed')::integer,0);
  d=coalesce((p_values->>'does_not_know')::integer,0);m=coalesce((p_values->>'mailbox')::integer,0);x=coalesce((p_values->>'number_not_exists')::integer,0);v=coalesce((p_values->>'not_voting')::integer,0);
  if target is null then
   insert into public.sample_records(coordinator,leader,total_base,record_date)
   values(coord,leader_name,0,day) returning id into target;
  end if;
  insert into public.daily_records(record_id,record_date,base_added,confirmed,not_confirmed,does_not_know,mailbox,number_not_exists,not_voting)
  values(target,day,added,c,n,d,m,x,v);
 else
  target=p_id;
  select * into b from public.sample_records where id=target for update;
  if not found then raise exception 'Registro não encontrado.'; end if;
  if exists(select 1 from public.sample_records where id<>target and lower(trim(coordinator))=lower(coord) and lower(trim(leader))=lower(leader_name)) then
   raise exception 'Já existe outro registro com esses nomes.';
  end if;
  update public.sample_records set coordinator=coord,leader=leader_name,updated_at=now() where id=target;
 end if;
 select * into b from public.sample_records where id=target;
 return to_jsonb(b);
end $$;
revoke all on function public.save_sampling_base_v2(bigint,jsonb) from public,anon;
grant execute on function public.save_sampling_base_v2(bigint,jsonb) to authenticated;
commit;
