-- 053 · Aceite explícito de marketing na captura de lead
--
-- Quem preenche o formulário está pedindo contato sobre o que perguntou — isso se sustenta em
-- diligência pré-contratual (art. 7º, V) e não precisa de caixinha. Receber conteúdo de
-- marketing depois é outra finalidade, e essa exige consentimento livre, informado e
-- inequívoco (art. 8º). São duas coisas, e o banco passa a saber a diferença.
--
-- `texto_aceite` guarda o que a pessoa leu no momento — sem isso o consentimento não é
-- demonstrável, e um consentimento que não se demonstra é o mesmo que não ter.

alter table site_leads        add column if not exists aceite_marketing boolean not null default false;
alter table andrekachan_leads add column if not exists aceite_marketing boolean not null default false;
alter table site_leads        add column if not exists texto_aceite text;
alter table andrekachan_leads add column if not exists texto_aceite text;
