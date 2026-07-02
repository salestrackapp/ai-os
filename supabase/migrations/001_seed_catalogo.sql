-- ═══════════════════════════════════════════════════════════════════
-- AI OS · Migration 001 · SEEDS
-- (A) Catálogo de plataformas de IA — os Três Anéis
-- (B) Catálogo mestre AK + Salestrack (extraído das propostas ART MG e
--     Imago; preços marcados needs_review=true onde exigem confirmação)
-- ═══════════════════════════════════════════════════════════════════

-- (A) ─── AI PLATFORMS · TRÊS ANÉIS ───
insert into ai_platforms (name, vendor, ring, category, capabilities, api_available, notes) values
-- Anel 1
('Claude','Anthropic','anel_1','generativa','{chat,agentes,projects,skills,mcp,codigo,analise,documentos}',true,'Núcleo do AI OS. Conector MCP vivo. Recomendação primária.'),
-- Anel 2
('ChatGPT','OpenAI','anel_2','generativa','{chat,gpts,actions,analise,imagem,voz}',true,'Integração via GPT Actions sobre a Open API.'),
('Gemini','Google','anel_2','generativa','{chat,gems,workspace,multimodal}',true,'Integração via Gems/extensões onde disponível.'),
('Microsoft Copilot','Microsoft','anel_2','generativa','{m365,chat,agentes}',false,'Governança e Receitas; integração limitada por design da plataforma.'),
('Perplexity','Perplexity AI','anel_2','generativa','{pesquisa,citacoes}',true,null),
('Grok','xAI','anel_2','generativa','{chat,tempo_real}',true,null),
-- Anel 3 · Orquestração
('n8n','n8n GmbH','anel_3','orquestracao','{workflows,webhooks,integracao}',true,'Automações documentadas como ativos na Biblioteca.'),
('Make','Celonis','anel_3','orquestracao','{workflows,integracao}',true,null),
('Zapier','Zapier','anel_3','orquestracao','{workflows,integracao,mcp}',true,null),
-- Anel 3 · Mídia
('Midjourney','Midjourney','anel_3','midia','{imagem}',false,null),
('ElevenLabs','ElevenLabs','anel_3','midia','{voz,audio}',true,null),
('HeyGen','HeyGen','anel_3','midia','{video,avatar}',true,null),
('Canva IA','Canva','anel_3','midia','{design,apresentacoes}',true,null),
('Gamma','Gamma','anel_3','midia','{apresentacoes,documentos}',true,null);

-- (B) ─── CATÁLOGO MESTRE · needs_review = preço a confirmar por André ───

-- ANDRÉ KACHAN · Mentorias
insert into catalog_items (kind, brand, name, description, unit, price, needs_review) values
('mentoria','andre_kachan','Sessão Estratégica','Mentoria individual — sessão única de direcionamento executivo','sessao',null,true),
('mentoria','andre_kachan','Sprint 30 Dias','Mentoria intensiva de 30 dias com plano de execução','un',null,true),
('mentoria','andre_kachan','Mentoria Trimestral','Acompanhamento executivo por 3 meses','un',null,true),
('mentoria','andre_kachan','Workshop Corporativo (mentoria)','Formato corporativo de mentoria em grupo','un',null,true);

-- ANDRÉ KACHAN · Workshops (6 formatos, 3–8h)
insert into catalog_items (kind, brand, name, description, unit, price, needs_review) values
('workshop','andre_kachan','Workshop — Formato 1','3–8h · presencial ou online','un',null,true),
('workshop','andre_kachan','Workshop — Formato 2','3–8h','un',null,true),
('workshop','andre_kachan','Workshop — Formato 3','3–8h','un',null,true),
('workshop','andre_kachan','Workshop — Formato 4','3–8h','un',null,true),
('workshop','andre_kachan','Workshop — Formato 5','3–8h','un',null,true),
('workshop','andre_kachan','Workshop — Governança de IA','Novo formato v4 · stack, política e shadow AI','un',null,true);

-- ANDRÉ KACHAN · Palestras (6 temas, 20–90min)
insert into catalog_items (kind, brand, name, description, unit, price, needs_review) values
('palestra','andre_kachan','Palestra — Tema 1','20–90min','un',null,true),
('palestra','andre_kachan','Palestra — Tema 2','20–90min','un',null,true),
('palestra','andre_kachan','Palestra — Tema 3','20–90min','un',null,true),
('palestra','andre_kachan','Palestra — Tema 4','20–90min','un',null,true),
('palestra','andre_kachan','Palestra — Tema 5','20–90min','un',null,true),
('palestra','andre_kachan','Palestra — Tema 6','20–90min','un',null,true);

-- ANDRÉ KACHAN · Treinamentos
insert into catalog_items (kind, brand, name, description, unit, price, needs_review) values
('treinamento','andre_kachan','Treinamento In Loco','Na sede do cliente','un',null,true),
('treinamento','andre_kachan','Treinamento Hub Salestrack SP','No hub São Paulo','un',null,true),
('treinamento','andre_kachan','Treinamento Online','Ao vivo, remoto','un',null,true);

-- SALESTRACK AI · Produtos
insert into catalog_items (kind, brand, name, description, unit, price, needs_review) values
('produto','salestrack','AI Diagnose','Diagnóstico de maturidade e oportunidades de IA (inclui Diagnóstico de Stack v4)','un',null,true),
('produto','salestrack','AI Sprint','Implementação rápida de caso de uso prioritário','un',null,true),
('produto','salestrack','AI Labs','Laboratório contínuo de experimentação','mes',null,true),
('produto','salestrack','AI Academy','Formação certificada por perfil (trilhas + sessões ao vivo)','un',null,true),
('produto','salestrack','AI Community','Comunidade de prática entre clientes','mes',null,true),
('agente','salestrack','Agente de IA — implementação','Agente operacional no Claude do cliente (unidade)','un',null,true),
('produto','salestrack','Automação orquestrada','Fluxo n8n/Make/Zapier documentado e versionado','un',null,true);

-- SALESTRACK · Referência Imago (fases fechadas — valores reais)
insert into catalog_items (kind, brand, name, description, unit, price, needs_review) values
('produto','salestrack','Programa Imago — Fase 1','Consolidação digital + agente IA WhatsApp 24h','un',10500.00,false),
('produto','salestrack','Programa Imago — Fase 2','Fase 2 do programa','un',9500.00,false),
('produto','salestrack','Programa Imago — Fase 3','Fase 3 do programa','un',17000.00,false),
('produto','salestrack','Manutenção mensal (padrão Imago)','Referência histórica — substituída pela linha Plataforma AI OS','mes',1600.00,false);

-- PLANOS AI OS (faixas do blueprint — fixar valor exato)
insert into catalog_items (kind, brand, name, description, unit, price, needs_review) values
('plano_aios','ai_os','AI OS Essential','1 frente · Playbook trilha operacional · até 5 usuários','mes',1500.00,true),
('plano_aios','ai_os','AI OS Professional','Multi-frente · Playbook completo · sessões · governança · até 25 usuários','mes',4500.00,true),
('plano_aios','ai_os','AI OS Enterprise','Custom · white-label completo · governança avançada · SSO','mes',10000.00,true);

-- ADD-ONS
insert into catalog_items (kind, brand, name, description, unit, price, needs_review) values
('addon','ai_os','White-label Nível 2','Cores, logo e nome interno do ambiente','mes',null,true),
('addon','ai_os','Créditos extras de sessão','Pacote adicional de sessões ao vivo','un',null,true),
('addon','ai_os','Governança de Stack (avulso)','Para clientes fora do Enterprise','mes',null,true);

-- ─── ORG INTERNA SALESTRACK (admin) ───
insert into organizations (name, slug, plan, status, is_salestrack)
values ('Salestrack Inteligência Digital','salestrack','enterprise','ativo',true);
