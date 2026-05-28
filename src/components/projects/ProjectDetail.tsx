import { useEffect, useState } from "react";
import { supabase, STATUS_LABELS, ROLE_LABELS } from "../../lib/supabase";
import type { Project, ProjectStage, ProjectRisk, ProjectComment, Task } from "../../lib/supabase";

type Tab = "overview" | "stages" | "risks" | "tasks" | "comments" | "team";

const RISK_BADGE: Record<string, string> = {
	low: "bg-emerald-900/40 text-emerald-400",
	medium: "bg-amber-900/40 text-amber-400",
	high: "bg-red-900/40 text-red-400",
};

const RISK_STATUS_BADGE: Record<string, string> = {
	identified: "bg-blue-900/40 text-blue-400",
	mitigated: "bg-emerald-900/40 text-emerald-400",
	occurred: "bg-red-900/40 text-red-400",
	closed: "bg-slate-700 text-slate-400",
};

const STAGE_STATUS = {
	pending: { label: "Pendiente", color: "bg-slate-700 text-slate-400" },
	in_progress: { label: "En Progreso", color: "bg-amber-900/40 text-amber-400" },
	completed: { label: "Completada", color: "bg-emerald-900/40 text-emerald-400" },
};

export default function ProjectDetail({ projectId }: { projectId: string }) {
	const [project, setProject] = useState<Project | null>(null);
	const [stages, setStages] = useState<ProjectStage[]>([]);
	const [risks, setRisks] = useState<ProjectRisk[]>([]);
	const [comments, setComments] = useState<ProjectComment[]>([]);
	const [tasks, setTasks] = useState<Task[]>([]);
	const [members, setMembers] = useState<any[]>([]);
	const [allProfiles, setAllProfiles] = useState<any[]>([]);
	const [activeTab, setActiveTab] = useState<Tab>("overview");
	const [loading, setLoading] = useState(true);
	const [currentUser, setCurrentUser] = useState<any>(null);
	const [editProgress, setEditProgress] = useState(false);
	const [progressVal, setProgressVal] = useState(0);

	// Modal states
	const [showStageForm, setShowStageForm] = useState(false);
	const [showRiskForm, setShowRiskForm] = useState(false);
	const [showMemberForm, setShowMemberForm] = useState(false);
	const [newComment, setNewComment] = useState("");
	const [stageForm, setStageForm] = useState({ name: "", description: "", status: "pending", start_date: "", end_date: "" });
	const [riskForm, setRiskForm] = useState({ title: "", description: "", probability: "medium", impact: "medium", mitigation: "", status: "identified" });
	const [memberForm, setMemberForm] = useState({ user_id: "", role: "gestor" });

	useEffect(() => {
		loadAll();
	}, [projectId]);

	async function loadAll() {
		const { data: { session } } = await supabase.auth.getSession();
		if (session) {
			const { data: profile } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
			setCurrentUser(profile);
		}

		const [projRes, stagesRes, risksRes, commentsRes, tasksRes, membersRes, profilesRes] = await Promise.all([
			supabase.from("projects").select("*, leader:profiles(id, full_name, avatar_url, email)").eq("id", projectId).single(),
			supabase.from("project_stages").select("*").eq("project_id", projectId).order("order_index"),
			supabase.from("project_risks").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
			supabase.from("project_comments").select("*, author:profiles(id, full_name, avatar_url)").eq("project_id", projectId).order("created_at", { ascending: false }),
			supabase.from("tasks").select("*, assignee:profiles(id, full_name, avatar_url)").eq("project_id", projectId).order("created_at", { ascending: false }),
			supabase.from("project_members").select("*, user:profiles(id, full_name, avatar_url, email, role)").eq("project_id", projectId),
			supabase.from("profiles").select("id, full_name, email, avatar_url"),
		]);

		setProject(projRes.data as any);
		setProgressVal(projRes.data?.progress || 0);
		setStages(stagesRes.data || []);
		setRisks(risksRes.data || []);
		setComments(commentsRes.data as any[] || []);
		setTasks(tasksRes.data as any[] || []);
		setMembers(membersRes.data || []);
		setAllProfiles(profilesRes.data || []);
		setLoading(false);
	}

	async function saveProgress() {
		await supabase.from("projects").update({ progress: progressVal }).eq("id", projectId);
		setProject(p => p ? { ...p, progress: progressVal } : p);
		setEditProgress(false);
	}

	async function addComment() {
		if (!newComment.trim() || !currentUser) return;
		const { data } = await supabase.from("project_comments").insert({
			project_id: projectId, author_id: currentUser.id, content: newComment.trim(),
		}).select("*, author:profiles(id, full_name, avatar_url)").single();
		if (data) setComments(prev => [data as any, ...prev]);
		setNewComment("");
	}

	async function addStage() {
		const { data } = await supabase.from("project_stages").insert({
			...stageForm, project_id: projectId, order_index: stages.length,
			start_date: stageForm.start_date || null, end_date: stageForm.end_date || null,
		}).select("*").single();
		if (data) setStages(prev => [...prev, data]);
		setShowStageForm(false);
		setStageForm({ name: "", description: "", status: "pending", start_date: "", end_date: "" });
	}

	async function updateStageStatus(id: string, status: string) {
		await supabase.from("project_stages").update({ status }).eq("id", id);
		setStages(prev => prev.map(s => s.id === id ? { ...s, status: status as any } : s));
	}

	async function addRisk() {
		const { data } = await supabase.from("project_risks").insert({
			...riskForm, project_id: projectId,
		}).select("*").single();
		if (data) setRisks(prev => [data, ...prev]);
		setShowRiskForm(false);
		setRiskForm({ title: "", description: "", probability: "medium", impact: "medium", mitigation: "", status: "identified" });
	}

	async function addMember() {
		if (!memberForm.user_id) return;
		const { data } = await supabase.from("project_members").upsert({
			project_id: projectId, user_id: memberForm.user_id, role: memberForm.role,
		}, { onConflict: "project_id,user_id" }).select("*, user:profiles(id, full_name, avatar_url, email, role)").single();
		if (data) setMembers(prev => {
			const exists = prev.find(m => m.user_id === memberForm.user_id);
			return exists ? prev.map(m => m.user_id === memberForm.user_id ? data : m) : [...prev, data];
		});
		setShowMemberForm(false);
		setMemberForm({ user_id: "", role: "gestor" });
	}

	async function deleteRisk(id: string) {
		await supabase.from("project_risks").delete().eq("id", id);
		setRisks(prev => prev.filter(r => r.id !== id));
	}

	const canEdit = currentUser?.role === "project_leader" || currentUser?.role === "pmo";
	const doneTasks = tasks.filter(t => t.status === "done").length;
	const activeTasks = tasks.filter(t => t.status === "in_progress" || t.status === "review").length;
	const highRisks = risks.filter(r => (r.probability === "high" || r.impact === "high") && r.status === "identified").length;

	const TABS: { id: Tab; label: string }[] = [
		{ id: "overview", label: "General" },
		{ id: "stages", label: `Etapas (${stages.length})` },
		{ id: "risks", label: `Riesgos (${risks.length})` },
		{ id: "tasks", label: `Tareas (${tasks.length})` },
		{ id: "comments", label: `Comentarios (${comments.length})` },
		{ id: "team", label: `Equipo (${members.length})` },
	];

	if (loading) {
		return (
			<div className="p-8">
				<div className="animate-pulse space-y-6">
					<div className="h-8 bg-slate-700 rounded w-1/3"></div>
					<div className="h-4 bg-slate-700/50 rounded w-2/3"></div>
					<div className="grid grid-cols-4 gap-4">
						{[1,2,3,4].map(i => <div key={i} className="h-20 bg-slate-800 rounded-xl"></div>)}
					</div>
				</div>
			</div>
		);
	}

	if (!project) return <div className="p-8 text-slate-500">Proyecto no encontrado</div>;

	return (
		<div className="p-6 md:p-8">
			{/* Header */}
			<div className="mb-6">
				<div className="flex items-start justify-between gap-4 flex-wrap">
					<div>
						<div className="flex items-center gap-3 mb-2">
							<span className="text-xs font-mono text-slate-500 bg-slate-700 px-2 py-1 rounded">{project.code}</span>
							<span className={`text-xs px-2.5 py-1 rounded-full ${
								project.status === "active" ? "bg-emerald-900/50 text-emerald-300" :
								project.status === "planning" ? "bg-blue-900/50 text-blue-300" :
								project.status === "on_hold" ? "bg-amber-900/50 text-amber-300" :
								project.status === "completed" ? "bg-slate-700 text-slate-300" :
								"bg-red-900/50 text-red-300"
							}`}>{STATUS_LABELS[project.status]}</span>
						</div>
						<h1 className="text-2xl font-bold text-slate-100">{project.name}</h1>
						{project.description && <p className="text-slate-400 text-sm mt-1.5 max-w-2xl">{project.description}</p>}
					</div>
					{canEdit && (
						<a href={`/projects/${projectId}/edit`} className="btn-secondary shrink-0">
							<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
							</svg>
							Editar
						</a>
					)}
				</div>

				{/* Progress */}
				<div className="mt-5 flex items-center gap-4">
					<div className="flex-1">
						<div className="flex items-center justify-between mb-1.5">
							<span className="text-xs text-slate-500">Progreso general</span>
							{editProgress ? (
								<div className="flex items-center gap-2">
									<input type="number" min="0" max="100" className="w-16 bg-slate-700 border border-slate-600 rounded px-2 py-0.5 text-xs text-slate-200 focus:outline-none" value={progressVal} onChange={e => setProgressVal(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))} />
									<button onClick={saveProgress} className="text-xs text-emerald-400 hover:text-emerald-300">✓</button>
									<button onClick={() => { setEditProgress(false); setProgressVal(project.progress || 0); }} className="text-xs text-slate-500 hover:text-slate-300">✕</button>
								</div>
							) : (
								<button onClick={() => canEdit && setEditProgress(true)} className="text-xs text-slate-500 hover:text-slate-300">
									{project.progress || 0}%
								</button>
							)}
						</div>
						<div className="h-2 bg-slate-700 rounded-full overflow-hidden">
							<div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${project.progress || 0}%` }}></div>
						</div>
					</div>
				</div>

				{/* Stats row */}
				<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
					{[
						{ label: "Tareas totales", value: tasks.length.toString(), color: "text-indigo-400" },
						{ label: "En progreso", value: activeTasks.toString(), color: "text-amber-400" },
						{ label: "Completadas", value: doneTasks.toString(), color: "text-emerald-400" },
						{ label: "Riesgos altos", value: highRisks.toString(), color: "text-red-400" },
					].map(stat => (
						<div key={stat.label} className="bg-slate-800 rounded-xl border border-slate-700 p-3.5">
							<p className="text-xs text-slate-500">{stat.label}</p>
							<p className={`text-xl font-bold mt-0.5 ${stat.color}`}>{stat.value}</p>
						</div>
					))}
				</div>
			</div>

			{/* Tabs */}
			<div className="border-b border-slate-700 mb-6">
				<div className="flex gap-1 overflow-x-auto">
					{TABS.map(tab => (
						<button
							key={tab.id}
							onClick={() => setActiveTab(tab.id)}
							className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
								activeTab === tab.id
									? "border-indigo-500 text-indigo-400"
									: "border-transparent text-slate-500 hover:text-slate-300"
							}`}
						>
							{tab.label}
						</button>
					))}
				</div>
			</div>

			{/* Tab content */}
			{activeTab === "overview" && (
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					<div className="space-y-4">
						<h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Información</h3>
						<div className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-4">
							{[
								{ label: "Código", value: project.code },
								{ label: "Estado", value: STATUS_LABELS[project.status] },
								{ label: "Fecha inicio", value: project.start_date ? new Date(project.start_date).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" }) : "—" },
								{ label: "Fecha fin", value: project.end_date ? new Date(project.end_date).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" }) : "—" },
								{ label: "Presupuesto", value: project.budget ? `$${Number(project.budget).toLocaleString("es")}` : "—" },
							].map(item => (
								<div key={item.label} className="flex items-center justify-between">
									<span className="text-sm text-slate-500">{item.label}</span>
									<span className="text-sm font-medium text-slate-300">{item.value}</span>
								</div>
							))}
						</div>
					</div>

					<div className="space-y-4">
						<h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Resumen de Etapas</h3>
						<div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
							{stages.length === 0 ? (
								<p className="text-slate-600 text-sm text-center py-4">Sin etapas registradas</p>
							) : (
								<div className="space-y-2">
									{stages.slice(0, 5).map(s => (
										<div key={s.id} className="flex items-center gap-3">
											<div className={`w-2 h-2 rounded-full shrink-0 ${s.status === "completed" ? "bg-emerald-500" : s.status === "in_progress" ? "bg-amber-500" : "bg-slate-600"}`}></div>
											<span className="text-sm text-slate-300 flex-1 truncate">{s.name}</span>
											<span className={`text-xs px-2 py-0.5 rounded-full ${STAGE_STATUS[s.status].color}`}>{STAGE_STATUS[s.status].label}</span>
										</div>
									))}
									{stages.length > 5 && <p className="text-xs text-slate-600 pt-1">+{stages.length - 5} más...</p>}
								</div>
							)}
						</div>

						{highRisks > 0 && (
							<div className="bg-red-900/20 border border-red-700/30 rounded-xl p-4">
								<div className="flex items-start gap-3">
									<svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
									</svg>
									<div>
										<p className="text-sm font-medium text-red-300">{highRisks} riesgo(s) de alto impacto</p>
										<p className="text-xs text-red-400/70 mt-0.5">Requieren atención inmediata</p>
									</div>
								</div>
							</div>
						)}
					</div>
				</div>
			)}

			{activeTab === "stages" && (
				<div>
					{canEdit && (
						<button onClick={() => setShowStageForm(true)} className="btn-primary mb-5">
							<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
							Nueva Etapa
						</button>
					)}
					<div className="space-y-3">
						{stages.length === 0 ? (
							<div className="text-center py-12 text-slate-600 text-sm">Sin etapas definidas</div>
						) : stages.map((s, i) => (
							<div key={s.id} className="bg-slate-800 rounded-xl border border-slate-700 p-5 flex items-start gap-4">
								<div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center text-sm font-bold text-slate-400 shrink-0">{i + 1}</div>
								<div className="flex-1 min-w-0">
									<div className="flex items-start justify-between gap-3">
										<div>
											<h4 className="font-medium text-slate-200">{s.name}</h4>
											{s.description && <p className="text-sm text-slate-500 mt-0.5">{s.description}</p>}
											{(s.start_date || s.end_date) && (
												<p className="text-xs text-slate-600 mt-1">
													{s.start_date && new Date(s.start_date).toLocaleDateString("es", { day: "numeric", month: "short" })}
													{s.start_date && s.end_date && " → "}
													{s.end_date && new Date(s.end_date).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })}
												</p>
											)}
										</div>
										{canEdit ? (
											<select
												value={s.status}
												onChange={e => updateStageStatus(s.id, e.target.value)}
												className="bg-slate-700 border border-slate-600 text-xs rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
											>
												<option value="pending">Pendiente</option>
												<option value="in_progress">En Progreso</option>
												<option value="completed">Completada</option>
											</select>
										) : (
											<span className={`text-xs px-2.5 py-1 rounded-full ${STAGE_STATUS[s.status].color}`}>{STAGE_STATUS[s.status].label}</span>
										)}
									</div>
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{activeTab === "risks" && (
				<div>
					{canEdit && (
						<button onClick={() => setShowRiskForm(true)} className="btn-primary mb-5">
							<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
							Nuevo Riesgo
						</button>
					)}
					{/* Risk matrix hint */}
					<div className="grid grid-cols-1 gap-3">
						{risks.length === 0 ? (
							<div className="text-center py-12 text-slate-600 text-sm">Sin riesgos registrados</div>
						) : risks.map(r => (
							<div key={r.id} className="bg-slate-800 rounded-xl border border-slate-700 p-5">
								<div className="flex items-start justify-between gap-3">
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2 mb-2">
											<span className={`text-xs px-2 py-0.5 rounded-full ${RISK_BADGE[r.probability]}`}>P: {r.probability === "low" ? "Baja" : r.probability === "medium" ? "Media" : "Alta"}</span>
											<span className={`text-xs px-2 py-0.5 rounded-full ${RISK_BADGE[r.impact]}`}>I: {r.impact === "low" ? "Bajo" : r.impact === "medium" ? "Medio" : "Alto"}</span>
											<span className={`text-xs px-2 py-0.5 rounded-full ${RISK_STATUS_BADGE[r.status]}`}>{r.status === "identified" ? "Identificado" : r.status === "mitigated" ? "Mitigado" : r.status === "occurred" ? "Ocurrido" : "Cerrado"}</span>
										</div>
										<h4 className="font-medium text-slate-200">{r.title}</h4>
										{r.description && <p className="text-sm text-slate-500 mt-1">{r.description}</p>}
										{r.mitigation && (
											<div className="mt-3 bg-slate-700/50 rounded-lg p-3">
												<p className="text-xs text-slate-500 mb-1 font-medium">Plan de mitigación:</p>
												<p className="text-sm text-slate-400">{r.mitigation}</p>
											</div>
										)}
									</div>
									{canEdit && (
										<button onClick={() => deleteRisk(r.id)} className="text-slate-600 hover:text-red-400 transition-colors p-1 shrink-0">
											<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
											</svg>
										</button>
									)}
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{activeTab === "tasks" && (
				<div className="space-y-2">
					{tasks.length === 0 ? (
						<div className="text-center py-12 text-slate-600 text-sm">Sin tareas — créalas en el Kanban</div>
					) : tasks.map(t => (
						<div key={t.id} className="bg-slate-800 rounded-xl border border-slate-700 p-4 flex items-center gap-4">
							<div className={`w-2 h-2 rounded-full shrink-0 ${t.status === "done" ? "bg-emerald-500" : t.status === "in_progress" ? "bg-amber-500" : t.status === "review" ? "bg-blue-500" : "bg-slate-600"}`}></div>
							<div className="flex-1 min-w-0">
								<p className={`text-sm font-medium ${t.status === "done" ? "line-through text-slate-500" : "text-slate-200"}`}>{t.title}</p>
							</div>
							<span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${t.priority === "urgent" ? "bg-red-900/50 text-red-300" : t.priority === "high" ? "bg-red-900/30 text-red-400" : t.priority === "medium" ? "bg-amber-900/30 text-amber-400" : "bg-emerald-900/30 text-emerald-400"}`}>
								{t.priority === "urgent" ? "Urgente" : t.priority === "high" ? "Alta" : t.priority === "medium" ? "Media" : "Baja"}
							</span>
							{(t as any).assignee && (
								<div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0" title={(t as any).assignee.full_name}>
									{(t as any).assignee.avatar_url ? <img src={(t as any).assignee.avatar_url} className="w-6 h-6 rounded-full object-cover" /> : (t as any).assignee.full_name?.charAt(0).toUpperCase()}
								</div>
							)}
						</div>
					))}
				</div>
			)}

			{activeTab === "comments" && (
				<div>
					{/* New comment */}
					<div className="bg-slate-800 rounded-xl border border-slate-700 p-4 mb-5">
						<textarea
							className="input resize-none h-20 mb-3"
							placeholder="Escribe un comentario..."
							value={newComment}
							onChange={e => setNewComment(e.target.value)}
						/>
						<button onClick={addComment} disabled={!newComment.trim()} className="btn-primary">
							Comentar
						</button>
					</div>
					<div className="space-y-4">
						{comments.length === 0 ? (
							<p className="text-center text-slate-600 text-sm py-8">Sin comentarios aún</p>
						) : comments.map(c => (
							<div key={c.id} className="flex gap-3">
								<div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
									{(c as any).author?.avatar_url ? <img src={(c as any).author.avatar_url} className="w-8 h-8 rounded-full object-cover" /> : (c as any).author?.full_name?.charAt(0).toUpperCase()}
								</div>
								<div className="flex-1">
									<div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
										<div className="flex items-center gap-2 mb-2">
											<span className="text-sm font-medium text-slate-300">{(c as any).author?.full_name || "Usuario"}</span>
											<span className="text-xs text-slate-600">•</span>
											<span className="text-xs text-slate-600">{new Date(c.created_at).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
										</div>
										<p className="text-sm text-slate-300 whitespace-pre-wrap">{c.content}</p>
									</div>
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{activeTab === "team" && (
				<div>
					{canEdit && (
						<button onClick={() => setShowMemberForm(true)} className="btn-primary mb-5">
							<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
							Agregar Miembro
						</button>
					)}
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
						{members.length === 0 ? (
							<p className="text-slate-600 text-sm col-span-3 text-center py-12">Sin miembros asignados</p>
						) : members.map(m => (
							<div key={m.id} className="bg-slate-800 rounded-xl border border-slate-700 p-4 flex items-center gap-3">
								<div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
									{m.user?.avatar_url ? <img src={m.user.avatar_url} className="w-10 h-10 rounded-full object-cover" /> : m.user?.full_name?.charAt(0).toUpperCase()}
								</div>
								<div className="flex-1 min-w-0">
									<p className="text-sm font-medium text-slate-200 truncate">{m.user?.full_name}</p>
									<p className="text-xs text-slate-500 truncate">{m.user?.email}</p>
									<span className={`text-xs mt-1 px-2 py-0.5 rounded-full inline-block ${m.role === "project_leader" ? "bg-purple-900/40 text-purple-400" : m.role === "pmo" ? "bg-blue-900/40 text-blue-400" : m.role === "gestor" ? "bg-emerald-900/40 text-emerald-400" : "bg-amber-900/40 text-amber-400"}`}>
										{ROLE_LABELS[m.role as keyof typeof ROLE_LABELS] || m.role}
									</span>
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Stage Modal */}
			{showStageForm && (
				<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
					<div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 w-full max-w-md shadow-2xl">
						<h3 className="text-base font-semibold text-slate-200 mb-5">Nueva Etapa</h3>
						<div className="space-y-4">
							<div>
								<label className="label">Nombre *</label>
								<input className="input" placeholder="Ej: Análisis de requisitos" value={stageForm.name} onChange={e => setStageForm(f => ({ ...f, name: e.target.value }))} />
							</div>
							<div>
								<label className="label">Descripción</label>
								<textarea className="input resize-none h-16" value={stageForm.description} onChange={e => setStageForm(f => ({ ...f, description: e.target.value }))} />
							</div>
							<div className="grid grid-cols-2 gap-3">
								<div>
									<label className="label">Inicio</label>
									<input type="date" className="input" value={stageForm.start_date} onChange={e => setStageForm(f => ({ ...f, start_date: e.target.value }))} />
								</div>
								<div>
									<label className="label">Fin</label>
									<input type="date" className="input" value={stageForm.end_date} onChange={e => setStageForm(f => ({ ...f, end_date: e.target.value }))} />
								</div>
							</div>
						</div>
						<div className="flex gap-3 mt-5">
							<button onClick={addStage} disabled={!stageForm.name.trim()} className="btn-primary flex-1">Agregar</button>
							<button onClick={() => setShowStageForm(false)} className="btn-secondary">Cancelar</button>
						</div>
					</div>
				</div>
			)}

			{/* Risk Modal */}
			{showRiskForm && (
				<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
					<div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
						<h3 className="text-base font-semibold text-slate-200 mb-5">Nuevo Riesgo</h3>
						<div className="space-y-4">
							<div>
								<label className="label">Título *</label>
								<input className="input" placeholder="Descripción del riesgo" value={riskForm.title} onChange={e => setRiskForm(f => ({ ...f, title: e.target.value }))} />
							</div>
							<div>
								<label className="label">Descripción</label>
								<textarea className="input resize-none h-16" placeholder="Detalla el riesgo..." value={riskForm.description} onChange={e => setRiskForm(f => ({ ...f, description: e.target.value }))} />
							</div>
							<div className="grid grid-cols-2 gap-3">
								<div>
									<label className="label">Probabilidad</label>
									<select className="input" value={riskForm.probability} onChange={e => setRiskForm(f => ({ ...f, probability: e.target.value }))}>
										<option value="low">Baja</option>
										<option value="medium">Media</option>
										<option value="high">Alta</option>
									</select>
								</div>
								<div>
									<label className="label">Impacto</label>
									<select className="input" value={riskForm.impact} onChange={e => setRiskForm(f => ({ ...f, impact: e.target.value }))}>
										<option value="low">Bajo</option>
										<option value="medium">Medio</option>
										<option value="high">Alto</option>
									</select>
								</div>
							</div>
							<div>
								<label className="label">Plan de Mitigación</label>
								<textarea className="input resize-none h-20" placeholder="¿Cómo se puede reducir o eliminar este riesgo?" value={riskForm.mitigation} onChange={e => setRiskForm(f => ({ ...f, mitigation: e.target.value }))} />
							</div>
						</div>
						<div className="flex gap-3 mt-5">
							<button onClick={addRisk} disabled={!riskForm.title.trim()} className="btn-primary flex-1">Registrar Riesgo</button>
							<button onClick={() => setShowRiskForm(false)} className="btn-secondary">Cancelar</button>
						</div>
					</div>
				</div>
			)}

			{/* Member Modal */}
			{showMemberForm && (
				<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
					<div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 w-full max-w-md shadow-2xl">
						<h3 className="text-base font-semibold text-slate-200 mb-5">Agregar Miembro</h3>
						<div className="space-y-4">
							<div>
								<label className="label">Usuario</label>
								<select className="input" value={memberForm.user_id} onChange={e => setMemberForm(f => ({ ...f, user_id: e.target.value }))}>
									<option value="">Seleccionar usuario...</option>
									{allProfiles.filter(p => !members.find(m => m.user_id === p.id)).map(p => (
										<option key={p.id} value={p.id}>{p.full_name} ({p.email})</option>
									))}
								</select>
							</div>
							<div>
								<label className="label">Rol en el proyecto</label>
								<select className="input" value={memberForm.role} onChange={e => setMemberForm(f => ({ ...f, role: e.target.value }))}>
									<option value="project_leader">Líder de Proyecto</option>
									<option value="pmo">PMO</option>
									<option value="gestor">Gestor</option>
									<option value="cliente">Cliente</option>
								</select>
							</div>
						</div>
						<div className="flex gap-3 mt-5">
							<button onClick={addMember} disabled={!memberForm.user_id} className="btn-primary flex-1">Agregar</button>
							<button onClick={() => setShowMemberForm(false)} className="btn-secondary">Cancelar</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
