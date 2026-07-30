-- R3.8 · Vídeo: estado do render nas ferramentas da Salestrack. Roteiro/storyboard vivem em content.video.
-- Aditivo/reversível: o agregado é um studio_deliverable (line=video_roteiro).
alter table studio_deliverables add column if not exists render_status text;   -- null | pendente | renderizando | renderizado | erro
alter table studio_deliverables add column if not exists render_tool text;     -- heygen | higgsfield | ...
alter table studio_deliverables add column if not exists video_ref text;       -- asset/url do vídeo renderizado
create index if not exists idx_studio_render_status on studio_deliverables (render_status) where render_status is not null;
