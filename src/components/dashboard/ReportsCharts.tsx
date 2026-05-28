import { useEffect, useState } from "react";
import {
	AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
	RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
	BarChart, Bar, Cell, Legend,
} from "recharts";
import { supabase } from "../../lib/supabase";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#a855f7"];

const CustomTooltip = ({ active, payload, label }: any) => {
	if (active && payload && payload.length) {
		return (
			<div className="bg-slate-800 border border-slate-600 rounded-lg p-3 text-sm shadow-xl">
				{label && <p className="text-slate-400 mb-1">{label}</p>}
				{payload.map((entry: any, i: number) => (
					<p key={i} style={{ color: entry.color || entry.fill || "#6366f1" }}>
						{entry.name}: <span className="font-semibold">{entry.value}</span>
					</p>
				))}
			</div>
		);
	}
	return null;
};

export default function ReportsCharts() {
	const [tasksTrend, setTasksTrend] = useState<any[]>([]);
	const [projectsRisks, setProjectsRisks] = useState<any[]>([]);
	const [teamPerformance, setTeamPerformance] = useState<any[]>([]);
	const [completionRate, setCompletionRate] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => { loadData(); }, []);

	async function loadData() {
		const [tasksRes, projectsRes, risksRes, membersRes] = await Promise.all([
			supabase.from("tasks").select("created_at, status, priority"),
			supabase.from("projects").select("name, code, progress, status"),
			supabase.from("project_risks").select("probability, impact, project_id, projects(code)"),
			supabase.from("project_members").select("user_id, role, profiles(full_name)"),
		]);

		// Tasks trend (last 7 days)
		const now = new Date();
		const trend = Array.from({ length: 7 }, (_, i) => {
			const d = new Date(now);
			d.setDate(d.getDate() - (6 - i));
			const label = d.toLocaleDateString("es", { weekday: "short", day: "numeric" });
			const dayStr = d.toISOString().split("T")[0];
			const dayTasks = (tasksRes.data || []).filter((t: any) => t.created_at?.startsWith(dayStr));
			return {
				name: label,
				creadas: dayTasks.length,
				completadas: dayTasks.filter((t: any) => t.status === "done").length,
			};
		});
		setTasksTrend(trend);

		// Projects completion rates
		const projData = (projectsRes.data || []).slice(0, 8).map((p: any) => ({
			name: p.code,
			progreso: p.progress || 0,
			fill: p.status === "completed" ? "#10b981" : p.status === "active" ? "#6366f1" : p.status === "on_hold" ? "#f59e0b" : "#475569",
		}));
		setCompletionRate(projData);

		// Risk distribution by project
		const risksByProject: Record<string, { name: string; high: number; medium: number; low: number }> = {};
		(risksRes.data || []).forEach((r: any) => {
			const code = r.projects?.code || r.project_id?.slice(0, 6);
			if (!risksByProject[code]) risksByProject[code] = { name: code, high: 0, medium: 0, low: 0 };
			risksByProject[code][r.probability as "high" | "medium" | "low"]++;
		});
		setProjectsRisks(Object.values(risksByProject).slice(0, 6));

		// Team roles radar
		const roleCounts: Record<string, number> = {};
		(membersRes.data || []).forEach((m: any) => {
			const key = m.role === "project_leader" ? "Líderes" : m.role === "pmo" ? "PMO" : m.role === "gestor" ? "Gestores" : "Clientes";
			roleCounts[key] = (roleCounts[key] || 0) + 1;
		});
		setTeamPerformance([
			{ subject: "Líderes", A: roleCounts["Líderes"] || 0, fullMark: 10 },
			{ subject: "PMO", A: roleCounts["PMO"] || 0, fullMark: 10 },
			{ subject: "Gestores", A: roleCounts["Gestores"] || 0, fullMark: 10 },
			{ subject: "Clientes", A: roleCounts["Clientes"] || 0, fullMark: 10 },
		]);

		setLoading(false);
	}

	if (loading) {
		return (
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{[1,2,3,4].map(i => (
					<div key={i} className="bg-slate-800 rounded-xl border border-slate-700 p-6 h-72 animate-pulse">
						<div className="h-4 bg-slate-700 rounded w-1/2 mb-6"></div>
						<div className="h-48 bg-slate-700/50 rounded"></div>
					</div>
				))}
			</div>
		);
	}

	return (
		<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
			{/* Tasks trend */}
			<div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
				<h3 className="text-sm font-semibold text-slate-300 mb-5">Tendencia de Tareas (últimos 7 días)</h3>
				<ResponsiveContainer width="100%" height={220}>
					<AreaChart data={tasksTrend}>
						<defs>
							<linearGradient id="colorCreadas" x1="0" y1="0" x2="0" y2="1">
								<stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
								<stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
							</linearGradient>
							<linearGradient id="colorCompletadas" x1="0" y1="0" x2="0" y2="1">
								<stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
								<stop offset="95%" stopColor="#10b981" stopOpacity={0} />
							</linearGradient>
						</defs>
						<CartesianGrid strokeDasharray="3 3" stroke="#334155" />
						<XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
						<YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
						<Tooltip content={<CustomTooltip />} />
						<Legend wrapperStyle={{ fontSize: "11px", color: "#94a3b8" }} />
						<Area type="monotone" dataKey="creadas" name="Creadas" stroke="#6366f1" fill="url(#colorCreadas)" strokeWidth={2} dot={false} />
						<Area type="monotone" dataKey="completadas" name="Completadas" stroke="#10b981" fill="url(#colorCompletadas)" strokeWidth={2} dot={false} />
					</AreaChart>
				</ResponsiveContainer>
			</div>

			{/* Projects progress */}
			<div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
				<h3 className="text-sm font-semibold text-slate-300 mb-5">Progreso por Proyecto</h3>
				{completionRate.length === 0 ? (
					<div className="h-52 flex items-center justify-center text-slate-600 text-sm">Sin datos</div>
				) : (
					<ResponsiveContainer width="100%" height={220}>
						<BarChart data={completionRate} layout="vertical" barSize={14}>
							<CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
							<XAxis type="number" domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
							<YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
							<Tooltip content={<CustomTooltip />} formatter={(v: any) => `${v}%`} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
							<Bar dataKey="progreso" name="Progreso" radius={[0, 4, 4, 0]}>
								{completionRate.map((entry, i) => (
									<Cell key={i} fill={entry.fill} />
								))}
							</Bar>
						</BarChart>
					</ResponsiveContainer>
				)}
			</div>

			{/* Risks by project */}
			<div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
				<h3 className="text-sm font-semibold text-slate-300 mb-5">Riesgos por Proyecto</h3>
				{projectsRisks.length === 0 ? (
					<div className="h-52 flex items-center justify-center text-slate-600 text-sm">Sin riesgos registrados</div>
				) : (
					<>
						<ResponsiveContainer width="100%" height={200}>
							<BarChart data={projectsRisks} barSize={12}>
								<CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
								<XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
								<YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
								<Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
								<Bar dataKey="high" name="Alto" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
								<Bar dataKey="medium" name="Medio" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
								<Bar dataKey="low" name="Bajo" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
							</BarChart>
						</ResponsiveContainer>
						<div className="flex gap-4 mt-2">
							{[{ color: "#ef4444", l: "Alto" }, { color: "#f59e0b", l: "Medio" }, { color: "#10b981", l: "Bajo" }].map(x => (
								<div key={x.l} className="flex items-center gap-1.5 text-xs text-slate-500">
									<div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: x.color }}></div>{x.l}
								</div>
							))}
						</div>
					</>
				)}
			</div>

			{/* Team radar */}
			<div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
				<h3 className="text-sm font-semibold text-slate-300 mb-5">Distribución del Equipo por Rol</h3>
				<ResponsiveContainer width="100%" height={220}>
					<RadarChart data={teamPerformance} cx="50%" cy="50%" outerRadius="65%">
						<PolarGrid stroke="#334155" />
						<PolarAngleAxis dataKey="subject" tick={{ fill: "#94a3b8", fontSize: 11 }} />
						<PolarRadiusAxis tick={{ fill: "#64748b", fontSize: 9 }} axisLine={false} />
						<Radar name="Equipo" dataKey="A" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} strokeWidth={2} />
						<Tooltip content={<CustomTooltip />} />
					</RadarChart>
				</ResponsiveContainer>
			</div>
		</div>
	);
}
