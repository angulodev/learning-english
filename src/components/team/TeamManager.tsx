import { useEffect, useState } from "react";
import { supabase, ROLE_LABELS } from "../../lib/supabase";
import type { Profile, Role } from "../../lib/supabase";

const ROLE_BADGE: Record<Role, string> = {
	project_leader: "bg-purple-900/40 text-purple-400 border-purple-700/30",
	pmo: "bg-blue-900/40 text-blue-400 border-blue-700/30",
	gestor: "bg-emerald-900/40 text-emerald-400 border-emerald-700/30",
	cliente: "bg-amber-900/40 text-amber-400 border-amber-700/30",
};

const ROLE_DESCRIPTIONS: Record<Role, string> = {
	project_leader: "Asigna roles, gestiona el equipo y tiene acceso completo.",
	pmo: "Supervisa proyectos y tiene acceso de lectura/escritura.",
	gestor: "Gestiona tareas y comenta en proyectos asignados.",
	cliente: "Puede ver el estado de los proyectos en que participa.",
};

export default function TeamManager() {
	const [profiles, setProfiles] = useState<Profile[]>([]);
	const [loading, setLoading] = useState(true);
	const [currentUser, setCurrentUser] = useState<Profile | null>(null);
	const [search, setSearch] = useState("");
	const [filterRole, setFilterRole] = useState("");
	const [editingRole, setEditingRole] = useState<string | null>(null);
	const [projectCounts, setProjectCounts] = useState<Record<string, number>>({});
	const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});

	useEffect(() => { loadAll(); }, []);

	async function loadAll() {
		const { data: { session } } = await supabase.auth.getSession();
		if (session) {
			const { data: me } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
			setCurrentUser(me as Profile);
		}

		const [profilesRes, membersRes, tasksRes] = await Promise.all([
			supabase.from("profiles").select("*").order("full_name"),
			supabase.from("project_members").select("user_id, project_id"),
			supabase.from("tasks").select("assigned_to"),
		]);

		setProfiles((profilesRes.data as Profile[]) || []);

		// Count projects per user
		const pCounts: Record<string, number> = {};
		(membersRes.data || []).forEach((m: any) => {
			pCounts[m.user_id] = (pCounts[m.user_id] || 0) + 1;
		});
		setProjectCounts(pCounts);

		// Count tasks per user
		const tCounts: Record<string, number> = {};
		(tasksRes.data || []).forEach((t: any) => {
			if (t.assigned_to) tCounts[t.assigned_to] = (tCounts[t.assigned_to] || 0) + 1;
		});
		setTaskCounts(tCounts);

		setLoading(false);
	}

	async function updateRole(userId: string, newRole: Role) {
		await supabase.from("profiles").update({ role: newRole }).eq("id", userId);
		setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role: newRole } : p));
		setEditingRole(null);
	}

	const canAssignRoles = currentUser?.role === "project_leader";

	const filtered = profiles.filter(p => {
		const matchSearch = !search || p.full_name?.toLowerCase().includes(search.toLowerCase()) || p.email?.toLowerCase().includes(search.toLowerCase());
		const matchRole = !filterRole || p.role === filterRole;
		return matchSearch && matchRole;
	});

	const roleCounts = profiles.reduce((acc, p) => {
		acc[p.role] = (acc[p.role] || 0) + 1;
		return acc;
	}, {} as Record<string, number>);

	if (loading) {
		return (
			<div className="p-6 animate-pulse space-y-4">
				<div className="grid grid-cols-4 gap-4 mb-6">
					{[1,2,3,4].map(i => <div key={i} className="h-20 bg-slate-800 rounded-xl"></div>)}
				</div>
				{[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-slate-800 rounded-xl"></div>)}
			</div>
		);
	}

	return (
		<div className="p-6 md:p-8">
			{/* Role summary cards */}
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
				{(Object.keys(ROLE_LABELS) as Role[]).map(role => (
					<div
						key={role}
						onClick={() => setFilterRole(filterRole === role ? "" : role)}
						className={`bg-slate-800 rounded-xl border cursor-pointer transition-all p-4 ${filterRole === role ? "border-indigo-500" : "border-slate-700 hover:border-slate-600"}`}
					>
						<div className={`text-xs px-2.5 py-0.5 rounded-full inline-block border mb-3 ${ROLE_BADGE[role]}`}>
							{ROLE_LABELS[role]}
						</div>
						<p className="text-2xl font-bold text-slate-100">{roleCounts[role] || 0}</p>
						<p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{ROLE_DESCRIPTIONS[role]}</p>
					</div>
				))}
			</div>

			{!canAssignRoles && (
				<div className="mb-5 p-3 bg-slate-800 border border-slate-700 rounded-xl flex items-start gap-3">
					<svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<p className="text-sm text-slate-400">Solo el <span className="text-purple-400 font-medium">Líder de Proyecto</span> puede asignar o modificar roles.</p>
				</div>
			)}

			{/* Search/Filter */}
			<div className="flex gap-3 mb-5 flex-wrap">
				<div className="relative flex-1 min-w-48">
					<svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
					</svg>
					<input className="input pl-9" placeholder="Buscar por nombre o email..." value={search} onChange={e => setSearch(e.target.value)} />
				</div>
				{filterRole && (
					<button onClick={() => setFilterRole("")} className="btn-secondary">
						Limpiar filtro ✕
					</button>
				)}
			</div>

			{/* Table */}
			<div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full">
						<thead>
							<tr className="border-b border-slate-700">
								<th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3.5">Usuario</th>
								<th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3.5">Rol</th>
								<th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3.5 hidden sm:table-cell">Proyectos</th>
								<th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3.5 hidden md:table-cell">Tareas</th>
								<th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3.5 hidden lg:table-cell">Desde</th>
								{canAssignRoles && <th className="px-5 py-3.5"></th>}
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-700/50">
							{filtered.length === 0 ? (
								<tr>
									<td colSpan={6} className="text-center text-slate-600 py-12 text-sm">Sin resultados</td>
								</tr>
							) : filtered.map(profile => (
								<tr key={profile.id} className={`hover:bg-slate-700/30 transition-colors ${profile.id === currentUser?.id ? "bg-indigo-900/10" : ""}`}>
									<td className="px-5 py-4">
										<div className="flex items-center gap-3">
											<div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
												{profile.avatar_url ? (
													<img src={profile.avatar_url} className="w-8 h-8 rounded-full object-cover" alt="" />
												) : (
													profile.full_name?.charAt(0).toUpperCase() || "?"
												)}
											</div>
											<div className="min-w-0">
												<p className="text-sm font-medium text-slate-200 truncate">
													{profile.full_name}
													{profile.id === currentUser?.id && <span className="ml-2 text-xs text-indigo-400">(tú)</span>}
												</p>
												<p className="text-xs text-slate-500 truncate">{profile.email}</p>
											</div>
										</div>
									</td>
									<td className="px-5 py-4">
										{editingRole === profile.id && canAssignRoles ? (
											<select
												autoFocus
												defaultValue={profile.role}
												className="bg-slate-700 border border-slate-600 text-sm rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
												onChange={e => updateRole(profile.id, e.target.value as Role)}
												onBlur={() => setEditingRole(null)}
											>
												{(Object.keys(ROLE_LABELS) as Role[]).map(r => (
													<option key={r} value={r}>{ROLE_LABELS[r]}</option>
												))}
											</select>
										) : (
											<span className={`text-xs px-2.5 py-1 rounded-full border ${ROLE_BADGE[profile.role]}`}>
												{ROLE_LABELS[profile.role]}
											</span>
										)}
									</td>
									<td className="px-5 py-4 hidden sm:table-cell">
										<span className="text-sm text-slate-400">{projectCounts[profile.id] || 0}</span>
									</td>
									<td className="px-5 py-4 hidden md:table-cell">
										<span className="text-sm text-slate-400">{taskCounts[profile.id] || 0}</span>
									</td>
									<td className="px-5 py-4 hidden lg:table-cell">
										<span className="text-xs text-slate-600">
											{new Date(profile.created_at).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })}
										</span>
									</td>
									{canAssignRoles && (
										<td className="px-5 py-4">
											{profile.id !== currentUser?.id && (
												<button
													onClick={() => setEditingRole(editingRole === profile.id ? null : profile.id)}
													className="text-xs text-slate-500 hover:text-indigo-400 transition-colors px-2 py-1 hover:bg-indigo-900/20 rounded-lg"
												>
													Cambiar rol
												</button>
											)}
										</td>
									)}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
