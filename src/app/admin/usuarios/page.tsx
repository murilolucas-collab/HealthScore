"use client";

import {
  FUNCOES_CLIENTES_TOTAIS,
  FUNCOES_CONTATOS_TOTAIS,
  funcoesClientesEfetivas,
  funcoesContatosEfetivas,
  getProjetoIdsDoUsuario,
  isAdminGeral,
  permissoesEfetivas,
  useAuth,
} from "@/lib/auth-client";
import { useDb } from "@/lib/useDb";
import { excluirUsuario, materializarEscopoProjetosUsuario, mutateDb, novoId } from "@/lib/store";
import { Card } from "@/components/ui";
import bcrypt from "bcryptjs";
import type { FuncaoCliente, FuncaoContato, ModuloUsuario, PapelUsuario, PermissoesUsuario, Usuario } from "@/lib/types";
import { useEffect, useState } from "react";

const MODULOS: { chave: ModuloUsuario; titulo: string; descricao: string }[] = [
  { chave: "verClientes", titulo: "Clientes", descricao: "Consultar a carteira e os perfis de clientes." },
  { chave: "verDashboard", titulo: "Dashboard", descricao: "Acompanhar os indicadores gerais da operação." },
  { chave: "verProjetos", titulo: "Projetos", descricao: "Abrir projetos, ciclos e avaliações." },
  { chave: "gerenciarClientes", titulo: "Gerenciamento", descricao: "Editar registros e conduzir ações no relacionamento." },
  { chave: "calcularSaude", titulo: "Calcular saúde", descricao: "Registrar avaliações e calcular o health score." },
];

const FUNCOES_CLIENTES: { chave: FuncaoCliente; titulo: string; descricao: string }[] = [
  { chave: "visualizar", titulo: "Visualizar clientes", descricao: "Consultar dados, status, risco e histórico." },
  { chave: "alterarStatus", titulo: "Alterar status do cliente", descricao: "Registrar saída e encerrar o contrato do cliente." },
];

const FUNCOES_CONTATOS: { chave: FuncaoContato; titulo: string; descricao: string }[] = [
  { chave: "visualizar", titulo: "Visualizar contatos", descricao: "Ver nome, cargo e canais de cada contato." },
  { chave: "gerenciar", titulo: "Criar e editar contatos", descricao: "Adicionar e manter os contatos do cliente." },
  { chave: "gerenciarMetasEventos", titulo: "Gerenciar metas e eventos", descricao: "Registrar metas e anotações no histórico do cliente." },
];

type AccessTab = "geral" | "projetos" | "clientes" | "contatos";
type SaveState = "idle" | "saving" | "success" | "error";

type AccessDraft = {
  modulos: Record<ModuloUsuario, boolean>;
  projetos: string[];
  clientes: Record<FuncaoCliente, boolean>;
  contatos: Record<FuncaoContato, boolean>;
  saveState: SaveState;
  errorMessage?: string;
};

function permissoesDoFormulario(formData: FormData): PermissoesUsuario {
  const modulos = Object.fromEntries(MODULOS.map(({ chave }) => [chave, formData.get(`permissao_${chave}`) === "on"])) as Record<ModuloUsuario, boolean>;
  return {
    ...modulos,
    clientes: { visualizar: modulos.verClientes, alterarStatus: modulos.gerenciarClientes },
    contatos: { visualizar: modulos.verClientes, gerenciar: modulos.gerenciarClientes, gerenciarMetasEventos: modulos.gerenciarClientes },
  };
}

function AccessCheckRow({ checked, disabled, title, description, onChange }: { checked: boolean; disabled?: boolean; title: string; description: string; onChange: (checked: boolean) => void }) {
  return <label className={`access-check-row ${disabled ? "access-check-row-disabled" : ""}`}><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /><span className="access-check-copy"><span className="access-check-title">{title}</span><span className="access-check-description">{description}</span></span></label>;
}

function LockIcon({ open = false }: { open?: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10" width="16" height="11" rx="2" />{open ? <path d="M8 10V7a4 4 0 0 1 7.5-2" /> : <path d="M8 10V7a4 4 0 0 1 8 0v3" />}</svg>;
}

function CloseIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>;
}

function AccessModal({ usuario, adminGeral, podeEditar, projetosDisponiveis, onClose, onSave }: { usuario: Usuario; adminGeral: boolean; podeEditar: boolean; projetosDisponiveis: { id: string; nome: string }[]; onClose: () => void; onSave: (draft: AccessDraft) => boolean }) {
  const raiz = isAdminGeral(usuario);
  const [aba, setAba] = useState<AccessTab>("geral");
  const [draft, setDraft] = useState<AccessDraft>(() => ({ modulos: permissoesEfetivas(usuario), projetos: getProjetoIdsDoUsuario(usuario.id), clientes: funcoesClientesEfetivas(usuario), contatos: funcoesContatosEfetivas(usuario), saveState: "idle" }));

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) { if (event.key === "Escape") onClose(); }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const readOnly = raiz || !podeEditar;
  const statusLabel = draft.saveState === "saving" ? "Salvando alterações…" : draft.saveState === "success" ? "Alterações salvas" : draft.saveState === "error" ? draft.errorMessage ?? "Não foi possível salvar." : "";
  function updateModule(chave: ModuloUsuario, checked: boolean) { setDraft((current) => ({ ...current, modulos: { ...current.modulos, [chave]: checked }, saveState: "idle" })); }
  function updateClientFunction(chave: FuncaoCliente, checked: boolean) { setDraft((current) => ({ ...current, clientes: { ...current.clientes, [chave]: checked }, saveState: "idle" })); }
  function updateContactFunction(chave: FuncaoContato, checked: boolean) { setDraft((current) => ({ ...current, contatos: { ...current.contatos, [chave]: checked }, saveState: "idle" })); }
  function toggleProject(projectId: string, checked: boolean) { setDraft((current) => ({ ...current, projetos: checked ? [...new Set([...current.projetos, projectId])] : current.projetos.filter((id) => id !== projectId), saveState: "idle" })); }
  function saveDraft() {
    setDraft((current) => ({ ...current, saveState: "saving", errorMessage: undefined }));
    try {
      const saved = onSave(draft);
      if (!saved) throw new Error("Não foi possível salvar as permissões.");
      setDraft((current) => ({ ...current, saveState: "success" }));
      window.setTimeout(onClose, 850);
    } catch (error) {
      console.error(error);
      setDraft((current) => ({ ...current, saveState: "error", errorMessage: "Não foi possível salvar. Tente novamente." }));
    }
  }

  return <div className="access-modal-backdrop" role="presentation"><section className="access-modal" role="dialog" aria-modal="true" aria-labelledby="access-modal-title">
    <header className="access-modal-header"><div className="min-w-0"><p className="access-modal-kicker">Permissões individuais</p><h2 id="access-modal-title" className="access-modal-title">Gerenciar acessos</h2><p className="access-modal-subtitle"><strong>{usuario.nome}</strong><span aria-hidden="true">·</span>{raiz ? "Admin Geral" : usuario.papel === "ADMIN" ? "Administrador" : "Acesso padrão"}</p></div><button type="button" onClick={onClose} className="access-modal-close" aria-label="Fechar gerenciamento de acessos"><CloseIcon /></button></header>
    {raiz ? <div className="access-modal-protected" role="status"><span className="access-modal-protected-icon"><LockIcon /></span><span><strong>Admin Geral protegido</strong><small>Este usuário mantém acesso total aos módulos, projetos, clientes e contatos.</small></span></div> : !podeEditar ? <div className="access-modal-warning" role="status"><strong>Edição bloqueada para o próprio usuário.</strong> Peça a outro administrador para alterar estes acessos.</div> : null}
    <div className="access-modal-body"><nav className="access-tabs" aria-label="Grupos de permissões">{([["geral", "Visão geral", "Módulos"], ["projetos", "Projetos", `${draft.projetos.length}`], ["clientes", "Clientes", `${Object.values(draft.clientes).filter(Boolean).length}/${Object.keys(FUNCOES_CLIENTES_TOTAIS).length}`], ["contatos", "Contatos", `${Object.values(draft.contatos).filter(Boolean).length}/${Object.keys(FUNCOES_CONTATOS_TOTAIS).length}`]] as [AccessTab, string, string][]).map(([value, label, meta]) => <button type="button" key={value} className={`access-tab ${aba === value ? "access-tab-active" : ""}`} aria-pressed={aba === value} onClick={() => setAba(value)}><span>{label}</span><small>{meta}</small></button>)}</nav>
      <div className="access-panel" aria-live="polite">
        {aba === "geral" && <div className="access-panel-content"><div className="access-section-heading"><div><p className="access-section-eyebrow">01 · Módulos gerais</p><h3>O que esta pessoa pode abrir</h3><p>Escolha os grandes espaços do produto. Detalhes de clientes, contatos e projetos ficam nas abas ao lado.</p></div><span className="access-count-pill">{Object.values(draft.modulos).filter(Boolean).length}/{MODULOS.length} ativos</span></div><div className="access-check-list">{MODULOS.map(({ chave, titulo, descricao }) => <AccessCheckRow key={chave} checked={raiz ? true : draft.modulos[chave]} disabled={readOnly} title={titulo} description={descricao} onChange={(checked) => updateModule(chave, checked)} />)}</div><div className="access-inline-note"><span aria-hidden="true">i</span><p><strong>Compatibilidade preservada.</strong> Permissões antigas continuam usando as cinco chaves de módulo; as abas de Clientes e Contatos acrescentam granularidade sem remover o comportamento legado.</p></div></div>}
        {aba === "projetos" && <div className="access-panel-content"><div className="access-section-heading"><div><p className="access-section-eyebrow">02 · Escopo operacional</p><h3>Projetos permitidos</h3><p>Defina em quais projetos esta pessoa poderá trabalhar. A lista respeita o seu próprio escopo administrativo.</p></div><span className="access-count-pill">{raiz ? "Todos" : `${draft.projetos.filter((id) => projetosDisponiveis.some((projeto) => projeto.id === id)).length}/${projetosDisponiveis.length}`}</span></div>{projetosDisponiveis.length > 0 ? <div className="project-access-list">{projetosDisponiveis.map((projeto) => <label key={projeto.id} className={`project-access-row ${readOnly ? "access-check-row-disabled" : ""}`}><input type="checkbox" checked={raiz || draft.projetos.includes(projeto.id)} disabled={readOnly} onChange={(event) => toggleProject(projeto.id, event.target.checked)} /><span>{projeto.nome}</span></label>)}</div> : <div className="access-empty"><span aria-hidden="true">◫</span><strong>Nenhum projeto disponível</strong><p>Cadastre um projeto ou peça ao administrador acesso ao escopo correspondente.</p></div>}{!adminGeral && !raiz && <div className="access-inline-note"><span aria-hidden="true">i</span><p>Projetos fora do seu escopo atual ficam preservados e não aparecem para edição nesta sessão.</p></div>}</div>}
        {aba === "clientes" && <div className="access-panel-content"><div className="access-section-heading"><div><p className="access-section-eyebrow">03 · Relacionamento</p><h3>Funções de clientes</h3><p>Clientes permanecem no gerenciamento de acessos, com controles próprios para consulta e status.</p></div><span className="access-count-pill">{Object.values(draft.clientes).filter(Boolean).length}/{FUNCOES_CLIENTES.length} ativas</span></div><div className="access-check-list">{FUNCOES_CLIENTES.map(({ chave, titulo, descricao }) => <AccessCheckRow key={chave} checked={raiz ? true : draft.clientes[chave]} disabled={readOnly} title={titulo} description={descricao} onChange={(checked) => updateClientFunction(chave, checked)} />)}</div><div className="access-inline-note"><span aria-hidden="true">↳</span><p><strong>Regra legada:</strong> em contas antigas sem funções detalhadas, “Clientes” e “Gerenciamento” continuam determinando o acesso como antes.</p></div></div>}
        {aba === "contatos" && <div className="access-panel-content"><div className="access-section-heading"><div><p className="access-section-eyebrow">04 · Relacionamento</p><h3>Funções de contatos</h3><p>Separe consulta, manutenção cadastral e gestão das metas e eventos do cliente.</p></div><span className="access-count-pill">{Object.values(draft.contatos).filter(Boolean).length}/{FUNCOES_CONTATOS.length} ativas</span></div><div className="access-check-list">{FUNCOES_CONTATOS.map(({ chave, titulo, descricao }) => <AccessCheckRow key={chave} checked={raiz ? true : draft.contatos[chave]} disabled={readOnly} title={titulo} description={descricao} onChange={(checked) => updateContactFunction(chave, checked)} />)}</div></div>}
      </div></div>
    <footer className="access-modal-footer"><div className={`access-save-status access-save-status-${draft.saveState}`} role={draft.saveState === "error" ? "alert" : "status"}>{statusLabel}</div><div className="access-modal-actions"><button type="button" onClick={onClose} className="action-button action-secondary">Cancelar</button><button type="button" disabled={readOnly || draft.saveState === "saving"} onClick={saveDraft} className="action-button action-primary">{draft.saveState === "saving" ? "Salvando…" : "Salvar alterações"}</button></div></footer>
  </section></div>;
}

export default function UsuariosPage() {
  const { user, pronto } = useAuth();
  const db = useDb();
  const [usuarioModal, setUsuarioModal] = useState<string | null>(null);

  if (!pronto || !db || !user) return null;
  if (user.papel !== "ADMIN") return <p className="text-sm text-neutral-500">Ação restrita a administradores.</p>;

  const adminGeral = isAdminGeral(user);
  const escopoOperador = new Set(getProjetoIdsDoUsuario(user.id));
  const usuarios = db.usuarios.slice().sort((a, b) => a.nome.localeCompare(b.nome)).map((u) => { const projetosAutorizados = new Set(getProjetoIdsDoUsuario(u.id)); return { ...u, acessos: db.projetos.filter((p) => projetosAutorizados.has(p.id) && (adminGeral || escopoOperador.has(p.id))).sort((a, b) => a.nome.localeCompare(b.nome)), acessosForaDoEscopo: adminGeral ? 0 : db.projetos.filter((p) => projetosAutorizados.has(p.id) && !escopoOperador.has(p.id)).length }; });
  const projetosDisponiveis = db.projetos.filter((projeto) => adminGeral || escopoOperador.has(projeto.id)).slice().sort((a, b) => a.nome.localeCompare(b.nome));
  const usuarioSelecionado = usuarioModal ? db.usuarios.find((u) => u.id === usuarioModal) ?? null : null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget); const nome = String(formData.get("nome") ?? "").trim(); const email = String(formData.get("email") ?? "").trim(); const senha = String(formData.get("senha") ?? ""); const papel = String(formData.get("papel") ?? "PADRAO") as PapelUsuario; const permissoes = permissoesDoFormulario(formData);
    if (papel !== "PADRAO" && papel !== "ADMIN") { alert("Perfil de usuário inválido."); return; }
    if (papel === "ADMIN" && !isAdminGeral(user!)) { alert("Somente o Admin Geral pode criar contas de administrador."); return; }
    if (!nome || !email || senha.length < 6) { alert("Nome, email e senha (mín. 6 caracteres) são obrigatórios"); return; }
    if (!db) return;
    if (db.usuarios.some((u) => u.email.toLowerCase() === email.toLowerCase())) { alert("Já existe um usuário com esse email"); return; }
    mutateDb((dbW) => { if (papel === "ADMIN" && !isAdminGeral(user!)) return; dbW.usuarios.push({ id: novoId("usuario"), nome, email, senhaHash: bcrypt.hashSync(senha, 10), papel, permissoes, escopoProjetosConfigurado: true, criadoEm: new Date().toISOString() }); });
    e.currentTarget.reset();
  }

  function handleSaveAccess(draft: AccessDraft) {
    if (!user) return false;
    if (!usuarioSelecionado || usuarioSelecionado.id === user.id || isAdminGeral(usuarioSelecionado)) return false;
    try {
      mutateDb((dbW) => {
        const usuario = dbW.usuarios.find((item) => item.id === usuarioSelecionado.id);
        if (!usuario || usuario.id === user.id || isAdminGeral(usuario)) return;
        usuario.permissoes = { ...(usuario.permissoes ?? {}), ...draft.modulos, clientes: draft.clientes, contatos: draft.contatos };
        materializarEscopoProjetosUsuario(dbW, usuario);
        const idsNoEscopoEditavel = new Set(projetosDisponiveis.map((projeto) => projeto.id));
        dbW.acessosProjeto = dbW.acessosProjeto.filter((acesso) => acesso.usuarioId !== usuario.id || !idsNoEscopoEditavel.has(acesso.projetoId));
        const idsMantidos = new Set(dbW.acessosProjeto.filter((acesso) => acesso.usuarioId === usuario.id).map((acesso) => acesso.projetoId));
        for (const projetoId of draft.projetos.filter((id) => idsNoEscopoEditavel.has(id))) { if (idsMantidos.has(projetoId)) continue; dbW.acessosProjeto.push({ id: novoId("acesso"), usuarioId: usuario.id, projetoId, criadoEm: new Date().toISOString() }); }
      });
      return true;
    } catch (error) { console.error(error); return false; }
  }

  function handleExcluir(alvo: { id: string; nome: string; papel: PapelUsuario }) {
    if (!db || !user) return;
    if (db.usuarios.some((u) => u.id === alvo.id && isAdminGeral(u))) { alert("O Admin Geral é protegido e não pode ser excluído."); return; }
    if (alvo.id === user.id) { alert("Você não pode excluir o próprio usuário logado."); return; }
    if (alvo.papel === "ADMIN" && db.usuarios.filter((u) => u.papel === "ADMIN").length <= 1) { alert("Não é possível excluir o último administrador."); return; }
    if (!window.confirm(`Excluir o usuário "${alvo.nome}"? Ele perde acesso imediatamente. Essa ação não pode ser desfeita.`)) return;
    mutateDb((dbW) => excluirUsuario(dbW, alvo.id));
  }

  return <div className="space-y-6">
    <div><p className="mb-2 text-xs font-semibold uppercase tracking-[.15em] text-teal-800">Equipe e acessos</p><h1>Usuários</h1><p className="mb-0 mt-2 text-sm text-neutral-500">Configure permissões e projetos individualmente para cada pessoa.</p></div>
    <Card><h2 className="font-semibold text-neutral-900 mb-1">Adicionar pessoa à equipe</h2><p className="mb-4 text-sm text-neutral-500">Cada conta recebe seu próprio conjunto de módulos e projetos autorizados.</p><form onSubmit={handleSubmit} className="user-create-form grid grid-cols-1 gap-2 md:grid-cols-4"><input name="nome" placeholder="Nome" required className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm" /><input name="email" type="email" placeholder="Email" required className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm" /><input name="senha" type="password" placeholder="Senha (mín. 6 caracteres)" required className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />{adminGeral ? <select name="papel" aria-label="Perfil do novo usuário" className="min-w-0 rounded-md border border-neutral-300 px-2 py-1.5 text-sm" defaultValue="PADRAO"><option value="PADRAO">Padrão</option><option value="ADMIN">Admin</option></select> : <div className="flex min-w-0 items-center rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-sm text-neutral-600">Padrão<input type="hidden" name="papel" value="PADRAO" /></div>}<div className="md:col-span-4 rounded-md border border-neutral-200 bg-neutral-50 p-3"><p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">Permissões iniciais deste usuário</p><div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{MODULOS.map(({ chave, titulo }) => <label key={chave} className="flex items-center gap-2 text-xs text-neutral-700"><input type="checkbox" name={`permissao_${chave}`} defaultChecked={chave !== "gerenciarClientes"} />{titulo}</label>)}</div></div><button className="action-button action-primary md:col-span-4">+ Criar usuário</button></form></Card>
    <div className="grid gap-3"><p className="mb-0 text-xs font-semibold uppercase tracking-[.13em] text-neutral-500">Acessos individuais · {usuarios.length} usuário(s)</p>{usuarios.map((u) => { const raiz = isAdminGeral(u); const resumoProjetos = raiz ? "Todos os projetos" : u.acessos.length > 0 ? `${u.acessos.map((p) => p.nome).join(", ")}${u.acessosForaDoEscopo ? ` · +${u.acessosForaDoEscopo} fora do seu escopo` : ""}` : u.acessosForaDoEscopo > 0 ? `${u.acessosForaDoEscopo} projeto(s) fora do seu escopo` : "Nenhum projeto autorizado"; const funcoesCliente = funcoesClientesEfetivas(u); const funcoesContato = funcoesContatosEfetivas(u); const modulosAtivos = MODULOS.filter(({ chave }) => permissoesEfetivas(u)[chave]).length; return <Card key={u.id} className="user-access-card grid gap-4"><div className="flex min-w-0 flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="font-semibold text-neutral-900">{u.nome}</div><div className="break-all text-sm text-neutral-500">{u.email}</div><span className="mt-2 inline-flex rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-teal-900">{raiz ? "Admin Geral" : u.papel === "ADMIN" ? "Administrador" : "Acesso padrão"}</span><p className="mb-0 mt-2 text-xs text-neutral-500">Projetos: {resumoProjetos}</p></div><div className="flex shrink-0 items-center gap-3"><span className="text-xs uppercase text-neutral-400">{u.papel}</span><button type="button" aria-label={`Gerenciar acessos de ${u.nome}`} onClick={() => setUsuarioModal(u.id)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-950 transition hover:bg-teal-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"><LockIcon />Gerenciar acessos</button></div></div><div className="user-access-summary"><span><strong>{raiz ? "5" : modulosAtivos}</strong> módulos</span><span><strong>{raiz ? "Todos" : Object.values(funcoesCliente).filter(Boolean).length}</strong> funções de cliente</span><span><strong>{raiz ? "Todos" : Object.values(funcoesContato).filter(Boolean).length}</strong> funções de contato</span></div>{!raiz && <button type="button" onClick={() => handleExcluir(u)} className="inline-action inline-action-danger justify-self-start">Excluir usuário</button>}</Card>; })}</div>
    {usuarioSelecionado && <AccessModal usuario={usuarioSelecionado} adminGeral={adminGeral} podeEditar={!isAdminGeral(usuarioSelecionado) && usuarioSelecionado.id !== user.id} projetosDisponiveis={projetosDisponiveis} onClose={() => setUsuarioModal(null)} onSave={handleSaveAccess} />}
  </div>;
}
