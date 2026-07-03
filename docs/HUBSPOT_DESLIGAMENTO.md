# Desligamento do HubSpot — checklist operacional

Objetivo: migrar contatos/deals/empresas do HubSpot para o AI OS e encerrar a assinatura sem perder histórico. O importador do AI OS já faz **dedupe** (contato por e-mail, deal por título+organização), então reimportar é seguro.

| # | Passo | Como | Data |
|---|---|---|---|
| 1 | **Export final** | HubSpot → Contacts / Deals / Companies → Export (CSV, colunas: First/Last Name, Email, Phone Number, Company Name, Deal Name, Amount) | ____ |
| 2 | **Reimport com dedupe** | AI OS → CRM → Importar → suba os CSVs. Rode contatos e deals. Pode rodar 2× — não duplica | ____ |
| 3 | **Conferência lado a lado** | Compare contagens: nº de contatos, deals e empresas no HubSpot × AI OS (CRM → Contas/Contatos e Pipeline). Anote divergências e reimporte o que faltar | ____ |
| 4 | **Redirecionar integrações** | Aponte formulários/automations/webhooks que caíam no HubSpot para o AI OS (ou desative). Confirmar que nada novo entra só no HubSpot | ____ |
| 5 | **Cancelar assinatura** | Após 30 dias de operação estável no AI OS e conferência ok, cancele o plano HubSpot. Guarde um export de arquivo morto | ____ |

**Recomendações**
- Faça o passo 2 em um horário de baixo movimento e confira o passo 3 no mesmo dia.
- Mantenha o export do passo 1 arquivado (backup frio) por pelo menos 12 meses.
- Só execute o passo 5 quando as 3 contagens (contatos, deals, empresas) baterem.
