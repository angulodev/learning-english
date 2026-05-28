import { useEffect, useState } from "react";
import { supabase, STATUS_LABELS, STATUS_COLORS } from "../../lib/supabase";
import type { Project } from "../../lib/supabase";

const STATUS_BADGE: Record<string, string> = {
	planning: "bg-blue-900/50 text-blue-300 border border-blue-700/30",
	active: "bg-emerald-900/50 text-emerald-300 border border-emerald-700/30",
	on_hold: "bg-amber-900/50 text-amber-300 border border-amber-700/30",
	completed: "bg-slate-700 text-slate-300 border border-slate-600",
	cancelled: "bg-red-900/50 text-red-300 border border-red-700/30",
};

export default function ProjectsManager() {
	const [projects, setProjects] = useState<Project[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [filterStatus, setFilterStatus] = useState("");
	const [showNew, setShowNew] = useState(false);
	const [form, setForm] = useState({
		code: "", name: "", description: "", status: "planning",
		start_date: "", end_date: "", budget: "",
	});
	const [saving, setSaving] = useState(false);

	useEffect(() => { loadProjects(); }, []);

	async function loadProjects() {
		const { data } = await supabase
			.from("projects")
			.select("*, leader:profiles(id, full_name, avatar_url)")
			.order("created_at", { ascending: false });
		setProjects((data as any[]) || []);
		setLoading(false);
	}

	async function createProject() {
		if (!form.code.trim() || !form.name.trim()) return;
		setSaving(true);
		const { data: { session } } = await supabase.auth.getSession();
		const { data, error } = await supabase
			.from("projects")
			.insert({
				code: form.code.trim().toUpperCase(),
				name: form.name.trim(),
				description: form.description || null,
				status: form.status,
				start_date: form.start_date || null,
				end_date: form.end_date || null,
				budget: form.budget ? parseFloat(form.budget) : null,
				leader_id: session?.user.id || null,
				progress: 0,
			})
			.select("*, leader:profiles(id, full_name, avatar_url)")
			.single();

		if (!error && data) {
			setProjects((prev) => [data as any, ...prev]);
			setShowNew(false);
			setForm({ code: "", name: "", description: "", status: "planning", start_date: "", end_date: "", budget: "" });
		}
		setSaving(false);
	}

	const filtered = projects.filter((p) => {
		const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase());
		const matchStatus = !filterStatus || p.status === filterStatus;
		return matchSearch && matchStatus;
	});

	if (loading) {
		return (
			<div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{[1,2,3,4,5,6].map(i => (
					<div key={i} className="bg-slate-800 rounded-xl border border-slate-700 p-5 animate-pulse">
						<div className="h-4 bg-slate-700 rounded w-1/3 mb-3"></div>
						<div className="h-5 bg-slate-700 rounded w-3/4 mb-2"></div>
						<div className="h-3 bg-slate-700/50 rounded w-full mb-4"></div>
						<div className="h-2 bg-slate-700/50 rounded-full"></div>
					</div>
				))}
			</div>
		);
	}

	return (
		<div className="p-6">
			{/* Toolbar */}
			<div className="flex items-center gap-3 mb-6 flex-wrap">
				<div className="relative flex-1 min-w-48">
					<svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
					</svg>
					<input
						className="input pl-9"
						placeholder="Buscar proyectos..."
						value={search}
						onChange={e => setSearch(e.target.value)}
					/>
				</div>
				<select
					className="bg-slate-700/50 border border-slate-600 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
					value={filterStatus}
					onChange={e => setFilterStatus(e.target.value)}
				>
					<option value="">Todos los estados</option>
					{Object.entries(STATUS_LABELS).map(([val, label]) => (
						<option key={val} value={val}>{label}</option>
					))}
				</select>
				<button onClick={() => setShowNew(true)} className="btn-primary">
					<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
					</svg>
					Nuevo Proyecto
				</button>
			</div>

			{/* Grid */}
			{filtered.length === 0 ? (
				<div className="text-center py-16">
					<div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
						<svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
						</svg>
					</div>
					<p className="text-slate-500 text-sm">
						{search || filterStatus ? "Sin resultados para esa búsqueda" : "No hay proyectos aún"}
					</p>
					{!search && !filterStatus && (
						<button onClick={() => setShowNew(true)} className="btn-primary mt-4 mx-auto">
							Crear primer proyecto
						</button>
					)}
				</div>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{filtered.map(project => (
						<a
							key={project.id}
							href={`/projects/${project.id}`}
							className="bg-slate-800 rounded-xl border border-slate-700 p-5 hover:border-indigo-600/50 hover:shadow-lg hover:shadow-indigo-900/10 transition-all duration-200 group block"
						>
							<div className="flex items-start justify-between mb-3">
								<div className="flex items-center gap-2">
									<span className="text-xs font-mono text-slate-500 bg-slate-700 px-2 py-0.5 rounded">{project.code}</span>
									<span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[project.status] || STATUS_BADGE.planning}`}>
										{STATUS_LABELS[project.status]}
									</span>
								</div>
							</div>

							<h3 className="font-semibold text-slate-200 mb-1 group-hover:text-indigo-300 transition-colors">
								{project.name}
							</h3>
							{project.description && (
								<p className="text-xs text-slate-500 line-clamp-2 mb-4">{project.description}</p>
							)}

							{/* Progress bar */}
							<div className="mb-4">
								<div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
									<span>Progreso</span>
									<span>{project.progress || 0}%</span>
								</div>
								<div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
									<div
										className="h-full bg-indigo-500 rounded-full transition-all duration-300"
										style={{ width: `${project.progress || 0}%` }}
									></div>
								</div>
							</div>

							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									{(project as any).leader && (
										<div className="flex items-center gap-1.5">
											<div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white">
												{(project as any).leader.avatar_url ? (
													<img src={(project as any).leader.avatar_url} className="w-5 h-5 rounded-full object-cover" alt="" />
												) : (
													(project as any).leader.full_name?.charAt(0).toUpperCase()
												)}
											</div>
											<span className="text-xs text-slate-500">{(project as any).leader.full_name?.split(" ")[0]}</span>
										</div>
									)}
								</div>
								{project.end_date && (
									<span className="text-xs text-slate-600">
										{new Date(project.end_date).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })}
									</span>
								)}
							</div>
						</a>
					))}
				</div>
			)}

			{/* New Project Modal */}
			{showNew && (
				<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
					<div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
						<div className="flex items-center justify-between mb-6">
							<h3 className="text-base font-semibold text-slate-200">Nuevo Proyecto</h3>
							<button onClick={() => setShowNew(false)} className="text-slate-500 hover:text-slate-300 transition-colors">
								<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>

						<div className="space-y-4">
							<div className="grid grid-cols-2 gap-3">
								<div>
									<label className="label">Código *</label>
									<input className="input font-mono uppercase" placeholder="PRY-001" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
								</div>
								<div>
									<label className="label">Estado</label>
									<select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
										{Object.entries(STATUS_LABELS).map(([val, label]) => (
											<option key={val} value={val}>{label}</option>
										))}
									</select>
								</div>
							</div>

							<div>
								<label className="label">Nombre del Proyecto *</label>
								<input className="input" placeholder="Nombre descriptivo del proyecto" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
							</div>

							<div>
								<label className="label">Descripción</label>
								<textarea className="input resize-none h-20" placeholder="Describe los objetivos y alcance del proyecto..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
							</div>

							<div className="grid grid-cols-2 gap-3">
								<div>
									<label className="label">Fecha Inicio</label>
									<input type="date" className="input" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
								</div>
								<div>
									<label className="label">Fecha Fin</label>
									<input type="date" className="input" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
								</div>
							</div>

							<div>
								<label className="label">Presupuesto (USD)</label>
								<input type="number" className="input" placeholder="0.00" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} />
							</div>
						</div>

						<div className="flex gap-3 mt-6">
							<button
								onClick={createProject}
								disabled={!form.code.trim() || !form.name.trim() || saving}
								className="btn-primary flex-1"
							>
								{saving ? (
									<><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Guardando...</>
								) : "Crear Proyecto"}
							</button>
							<button onClick={() => setShowNew(false)} className="btn-secondary">Cancelar</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
