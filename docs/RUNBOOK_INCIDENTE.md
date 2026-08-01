# Runbook — incidente de segurança com dado pessoal

**Para quem:** André Kachan (encarregado) e quem estiver operando o sistema no momento.
**Quando abrir este documento:** na dúvida. Um alarme falso registrado custa cinco minutos; um
incidente real tratado de improviso custa o prazo do art. 48 e a confiança de quem confiou os dados.

Registre tudo em **Configurar › Dados pessoais › Incidentes**. O registro não é burocracia: quando
alguém perguntar depois, a pergunta não vai ser *"vocês tinham um procedimento?"* e sim
**"quando vocês souberam, e quando comunicaram?"** — e isso é uma data.

---

## O que conta como incidente

Qualquer evento que possa ter exposto, alterado, apagado ou tornado indisponível dado pessoal sem
autorização. Na prática, aqui:

- Chave de serviço (`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, chave da ASAAS) exposta em log,
  print, commit, canal de chat ou tela compartilhada
- Falha de RLS deixando um cliente enxergar dados de outro
- Conta de admin acessada por quem não devia — inclusive por senha reaproveitada
- E-mail ou campanha enviada para a lista errada
- Perda ou vazamento de arquivo exportado (planilha de contatos, PDF de contrato)
- Fornecedor da lista de operadores comunicando incidente do lado dele
- Dispositivo com sessão aberta perdido ou roubado

**Não é incidente:** indisponibilidade sem exposição (site fora do ar), erro de digitação em dado
próprio, teste em ambiente sem dado real.

---

## Primeira hora

Nesta ordem. Conter vem antes de entender.

**1 · Pare o sangramento (minutos, não horas)**

| Se for | Faça agora |
|---|---|
| Chave exposta | Rotacione a chave no fornecedor **antes** de investigar como vazou. `npx vercel env rm NOME production` e recadastre. Chave exposta é chave comprometida, mesmo que "ninguém viu". |
| Acesso indevido a conta | Troque a senha, encerre as sessões no Supabase Auth (Authentication › Users › o usuário › *Sign out*) e ative MFA nela. |
| Falha de RLS | Desligue a superfície afetada (a rota, a tela) em vez de tentar corrigir a policy sob pressão. `npm run test:rls` é o portão para religar. |
| Envio errado | Pare a campanha no Estúdio. Não mande um segundo e-mail pedindo para ignorar o primeiro sem decidir o item 4 — isso duplica a exposição. |

**2 · Registre, mesmo sem saber ainda o tamanho**

Abra o incidente com `detectado_em` = agora. Este campo é o que faz o relógio do art. 48 começar, e
preenchê-lo depois "com a data certa" é reescrever a própria prova. Título e descrição podem ser
uma linha; refina-se depois.

**3 · Preserve o que explica**

Não apague log, não force push, não limpe a tabela suspeita. `audit_logs` é insert-only justamente
para este momento — é ele que vai dizer quem fez o quê. Exporte antes de mexer:

```sql
select * from audit_logs where created_at > '<data>' order by created_at;
```

**4 · Decida se há risco relevante ao titular**

É a decisão que define tudo o que vem depois. Pese:

- **Que dado** — nome e e-mail corporativo pesam menos que CPF, salário, conteúdo de conversa
- **Quantas pessoas**
- **Se dá para identificar alguém** a partir do que vazou
- **Se o dado saiu mesmo** ou só ficou acessível
- **Se dá para reverter** (chave rotacionada antes de qualquer uso, por exemplo)

Registre a decisão **e a justificativa**, inclusive quando for "não notificar". Decidir não
notificar é uma decisão legítima e comum — mas é a que será questionada, então é a que mais precisa
estar escrita no momento em que foi tomada.

---

## Comunicação

**Se houver risco relevante**, comunique **a ANPD e os titulares** em prazo razoável. A ANPD
orienta **2 dias úteis** contados da ciência — conte de `detectado_em`, não de quando a análise
terminou.

- **ANPD:** formulário de comunicação de incidente em <https://www.gov.br/anpd>
- **Titulares:** e-mail direto, em linguagem de gente. Diga **o que aconteceu, que dado seu foi
  afetado, o que já fizemos e o que a pessoa deve fazer** (trocar senha, desconfiar de mensagem em
  nome da Salestrack). Nunca minimize e nunca use "por precaução" para descrever algo que aconteceu.

Preencha `anpd_notificada_em` e `titulares_notificados_em` no registro. São essas duas datas que
provam o cumprimento.

**Se o incidente for do lado de um fornecedor** (a lista está em *Registro de tratamento*), a
obrigação de comunicar continua sendo da Salestrack — nós somos o controlador. Cobre o relatório
deles, mas não espere por ele para começar a contar o prazo.

---

## Depois

- Feche com `encerrado_em`, a causa e as ações tomadas.
- Se a causa foi um defeito do sistema, **abra o conserto como trabalho**, não como promessa. Um
  incidente que se repete com a mesma causa é muito pior que o primeiro.
- Se a causa foi um passo que faltava neste runbook, corrija este arquivo na mesma semana.

---

## Contatos

| Papel | Quem |
|---|---|
| Encarregado (DPO) | André Kachan · aios@salestrack.com.br |
| Decisão final | André Kachan |
| Fornecedores | ver *Configurar › Dados pessoais › Registro de tratamento* |

---

## O que hoje aumenta o risco, e é conhecido

Registrado aqui porque um runbook honesto diz onde a casa está frágil:

- **MFA do administrador está desligado** desde que foi removido, e não voltou. É o item 9 de
  `CONFIG_PENDENTE.md`. Enquanto isso, uma senha vazada é acesso total.
- **Proteção contra senha vazada desligada** no Supabase Auth (item 8-B) — senha já exposta em
  vazamento público é aceita no cadastro.

Os dois são cliques. Enquanto não forem dados, a probabilidade do primeiro cenário desta tabela
("conta de admin acessada por quem não devia") é maior do que precisaria ser.
