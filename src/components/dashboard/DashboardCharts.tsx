import { useEffect, useState } from "react";
import {
	BarChart,
	Bar,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
	PieChart,
	Pie,
	Cell,
	LineChart,
	Line,
	Legend,
} from "recharts";
import { supabase } from "../../lib/supabase";

const COLORS = {
	indigo: "#6366f1",
	emerald: "#10b981",
	amber: "#f59e0b",
	red: "#ef4444",
	blue: "#3b82f6",
	purple: "#a855f7",
};

const statusColors = {
	planning: COLORS.blue,
	active: COLORS.emerald,
	on_hold: COLORS.amber,
	completed: COLORS.indigo,
	cancelled: COLORS.red,
};

const statusLabels = {
	planning: "Planificación",
	active: "Activo",
	on_hold: "En Espera",
	completed: "Completado",
	cancelled: "Cancelado",
};

const priorityColors = {
	low: COLORS.emerald,
	medium: COLORS.amber,
	high: COLORS.red,
	urgent: "#dc2626",
};

export default function DashboardCharts() {
	const [projectsByStatus, setProjectsByStatus] = useState<any[]>([]);
	const [tasksByPriority, setTasksByPriority] = useState<any[]>([]);
	const [workloadData, setWorkloadData] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		loadData();
	}, []);

	async function loadData() {
		const [projectsRes, tasksRes, membersRes] = await Promise.all([
			supabase.from("projects").select("status"),
			supabase.from("tasks").select("priority, status, assigned_to"),
			supabase
				.from("project_members")
				.select("user_id, profiles(full_name)")
				.limit(50),
		]);

		// Projects by status
		if (projectsRes.data) {
			const counts: Record<string, number> = {};
			projectsRes.data.forEach((p: any) => {
				counts[p.status] = (counts[p.status] || 0) + 1;
			});
			setProjectsByStatus(
				Object.entries(counts).map(([status, count]) => ({
					name: statusLabels[status as keyof typeof statusLabels] || status,
					value: count,
					color: statusColors[status as keyof typeof statusColors] || COLORS.blue,
				}))
			);
		}

		// Tasks by priority
		if (tasksRes.data) {
			const counts: Record<string, number> = {};
			tasksRes.data.forEach((t: any) => {
				counts[t.priority] = (counts[t.priority] || 0) + 1;
			});
			const priorityLabels: Record<string, string> = {
				low: "Baja",
				medium: "Media",
				high: "Alta",
				urgent: "Urgente",
			};
			setTasksByPriority(
				Object.entries(counts).map(([priority, count]) => ({
					name: priorityLabels[priority] || priority,
					tareas: count,
					fill: priorityColors[priority as keyof typeof priorityColors] || COLORS.blue,
				}))
			);
		}

		// Workload by user (tasks assigned)
		if (tasksRes.data && membersRes.data) {
			const userTaskCounts: Record<string, { todo: number; in_progress: number; done: number; name: string }> = {};
			tasksRes.data.forEach((t: any) => {
				if (t.assigned_to) {
					if (!userTaskCounts[t.assigned_to]) {
						userTaskCounts[t.assigned_to] = { todo: 0, in_progress: 0, done: 0, name: t.assigned_to.slice(0, 8) };
					}
					if (t.status === "todo") userTaskCounts[t.assigned_to].todo++;
					else if (t.status === "in_progress" || t.status === "review") userTaskCounts[t.assigned_to].in_progress++;
					else if (t.status === "done") userTaskCounts[t.assigned_to].done++;
				}
			});

			// Map names from members
			membersRes.data.forEach((m: any) => {
				if (userTaskCounts[m.user_id] && m.profiles?.full_name) {
					userTaskCounts[m.user_id].name = m.profiles.full_name.split(" ")[0];
				}
			});

			setWorkloadData(Object.values(userTaskCounts).slice(0, 8));
		}

		setLoading(false);
	}

	if (loading) {
		return (
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{[1, 2, 3].map((i) => (
					<div key={i} className="bg-slate-800 rounded-xl border border-slate-700 p-6 h-72 animate-pulse">
						<div className="h-4 bg-slate-700 rounded w-1/2 mb-6"></div>
						<div className="h-48 bg-slate-700/50 rounded"></div>
					</div>
				))}
			</div>
		);
	}

	const CustomTooltip = ({ active, payload, label }: any) => {
		if (active && payload && payload.length) {
			return (
				<div className="bg-slate-800 border border-slate-600 rounded-lg p-3 text-sm shadow-xl">
					{label && <p className="text-slate-400 mb-1">{label}</p>}
					{payload.map((entry: any, i: number) => (
						<p key={i} style={{ color: entry.color || entry.fill }}>
							{entry.name}: <span className="font-semibold">{entry.value}</span>
						</p>
					))}
				</div>
			);
		}
		return null;
	};

	return (
		<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
			{/* Projects by status - Pie */}
			<div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
				<h3 className="text-sm font-semibold text-slate-300 mb-5">Estado de Proyectos</h3>
				{projectsByStatus.length === 0 ? (
					<div className="h-52 flex items-center justify-center text-slate-600 text-sm">
						Sin datos disponibles
					</div>
				) : (
					<>
						<ResponsiveContainer width="100%" height={180}>
							<PieChart>
								<Pie
									data={projectsByStatus}
									cx="50%"
									cy="50%"
									innerRadius={50}
									outerRadius={75}
									paddingAngle={3}
									dataKey="value"
								>
									{projectsByStatus.map((entry, i) => (
										<Cell key={i} fill={entry.color} />
									))}
								</Pie>
								<Tooltip content={<CustomTooltip />} />
							</PieChart>
						</ResponsiveContainer>
						<div className="mt-3 space-y-1.5">
							{projectsByStatus.map((item, i) => (
								<div key={i} className="flex items-center justify-between text-xs">
									<div className="flex items-center gap-2">
										<div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></div>
										<span className="text-slate-400">{item.name}</span>
									</div>
									<span className="font-semibold text-slate-300">{item.value}</span>
								</div>
							))}
						</div>
					</>
				)}
			</div>

			{/* Tasks by priority - Bar */}
			<div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
				<h3 className="text-sm font-semibold text-slate-300 mb-5">Tareas por Prioridad</h3>
				{tasksByPriority.length === 0 ? (
					<div className="h-52 flex items-center justify-center text-slate-600 text-sm">
						Sin tareas registradas
					</div>
				) : (
					<ResponsiveContainer width="100%" height={220}>
						<BarChart data={tasksByPriority} barSize={28}>
							<CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
							<XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
							<YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
							<Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
							<Bar dataKey="tareas" radius={[4, 4, 0, 0]}>
								{tasksByPriority.map((entry, i) => (
									<Cell key={i} fill={entry.fill} />
								))}
							</Bar>
						</BarChart>
					</ResponsiveContainer>
				)}
			</div>

			{/* Workload per person - Bar stacked */}
			<div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
				<h3 className="text-sm font-semibold text-slate-300 mb-5">Carga Laboral del Equipo</h3>
				{workloadData.length === 0 ? (
					<div className="h-52 flex items-center justify-center text-slate-600 text-sm">
						Sin asignaciones registradas
					</div>
				) : (
					<>
						<ResponsiveContainer width="100%" height={180}>
							<BarChart data={workloadData} barSize={16}>
								<CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
								<XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
								<YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
								<Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
								<Bar dataKey="todo" name="Por hacer" stackId="a" fill="#475569" radius={[0, 0, 0, 0]} />
								<Bar dataKey="in_progress" name="En progreso" stackId="a" fill={COLORS.amber} radius={[0, 0, 0, 0]} />
								<Bar dataKey="done" name="Completadas" stackId="a" fill={COLORS.emerald} radius={[4, 4, 0, 0]} />
							</BarChart>
						</ResponsiveContainer>
						<div className="flex gap-4 mt-3">
							{[
								{ color: "#475569", label: "Pendiente" },
								{ color: COLORS.amber, label: "En progreso" },
								{ color: COLORS.emerald, label: "Hecho" },
							].map((l) => (
								<div key={l.label} className="flex items-center gap-1.5 text-xs text-slate-500">
									<div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: l.color }}></div>
									{l.label}
								</div>
							))}
						</div>
					</>
				)}
			</div>
		</div>
	);
}
