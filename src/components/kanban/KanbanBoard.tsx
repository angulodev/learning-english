import { useEffect, useState, useCallback } from "react";
import {
	DndContext,
	DragOverlay,
	closestCorners,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	type DragEndEvent,
	type DragStartEvent,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "../../lib/supabase";
import type { Task } from "../../lib/supabase";

const COLUMNS = [
	{ id: "todo", label: "Por Hacer", color: "border-slate-600", accent: "#6366f1" },
	{ id: "in_progress", label: "En Progreso", color: "border-amber-600/50", accent: "#f59e0b" },
	{ id: "review", label: "En Revisión", color: "border-blue-600/50", accent: "#3b82f6" },
	{ id: "done", label: "Completado", color: "border-emerald-600/50", accent: "#10b981" },
] as const;

const PRIORITY_CONFIG = {
	low: { label: "Baja", color: "bg-emerald-900/50 text-emerald-400" },
	medium: { label: "Media", color: "bg-amber-900/50 text-amber-400" },
	high: { label: "Alta", color: "bg-red-900/50 text-red-400" },
	urgent: { label: "Urgente", color: "bg-red-700/50 text-red-300 font-semibold" },
};

function TaskCard({ task, isDragging }: { task: Task; isDragging?: boolean }) {
	const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
		id: task.id,
	});

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
	const dueDate = task.due_date
		? new Date(task.due_date).toLocaleDateString("es", { day: "numeric", month: "short" })
		: null;
	const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "done";

	return (
		<div
			ref={setNodeRef}
			style={style}
			{...attributes}
			{...listeners}
			className="bg-slate-700/60 border border-slate-600/50 rounded-xl p-4 cursor-grab active:cursor-grabbing hover:border-slate-500 hover:bg-slate-700 transition-all duration-150 shadow-sm"
		>
			<div className="flex items-start justify-between gap-2 mb-2">
				<p className="text-sm font-medium text-slate-200 leading-snug">{task.title}</p>
				<span className={`text-xs px-1.5 py-0.5 rounded-md whitespace-nowrap shrink-0 ${priority.color}`}>
					{priority.label}
				</span>
			</div>

			{task.description && (
				<p className="text-xs text-slate-500 mb-3 line-clamp-2">{task.description}</p>
			)}

			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					{task.assignee && (
						<div
							className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white"
							title={task.assignee.full_name}
						>
							{task.assignee.avatar_url ? (
								<img src={task.assignee.avatar_url} className="w-5 h-5 rounded-full object-cover" alt="" />
							) : (
								task.assignee.full_name?.charAt(0).toUpperCase()
							)}
						</div>
					)}
					{task.project && (
						<span className="text-[10px] text-slate-500 font-mono">{task.project.code}</span>
					)}
				</div>
				{dueDate && (
					<span className={`text-[10px] ${isOverdue ? "text-red-400" : "text-slate-500"}`}>
						{isOverdue ? "⚠ " : ""}
						{dueDate}
					</span>
				)}
			</div>
		</div>
	);
}

type FilterOptions = {
	projectId: string;
	assigneeId: string;
	priority: string;
};

export default function KanbanBoard() {
	const [tasks, setTasks] = useState<Task[]>([]);
	const [projects, setProjects] = useState<any[]>([]);
	const [members, setMembers] = useState<any[]>([]);
	const [filters, setFilters] = useState<FilterOptions>({ projectId: "", assigneeId: "", priority: "" });
	const [activeTask, setActiveTask] = useState<Task | null>(null);
	const [loading, setLoading] = useState(true);
	const [showNewTask, setShowNewTask] = useState(false);
	const [newTask, setNewTask] = useState({ title: "", priority: "medium", project_id: "", status: "todo" });

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
	);

	useEffect(() => {
		loadAll();
	}, []);

	async function loadAll() {
		const [tasksRes, projectsRes, profilesRes] = await Promise.all([
			supabase
				.from("tasks")
				.select("*, assignee:profiles(id, full_name, avatar_url), project:projects(id, name, code)")
				.order("created_at", { ascending: false }),
			supabase.from("projects").select("id, name, code").eq("status", "active"),
			supabase.from("profiles").select("id, full_name, avatar_url"),
		]);
		setTasks((tasksRes.data as any[]) || []);
		setProjects(projectsRes.data || []);
		setMembers(profilesRes.data || []);
		setLoading(false);
	}

	const filteredTasks = tasks.filter((t) => {
		if (filters.projectId && t.project_id !== filters.projectId) return false;
		if (filters.assigneeId && t.assigned_to !== filters.assigneeId) return false;
		if (filters.priority && t.priority !== filters.priority) return false;
		return true;
	});

	function getColumnTasks(columnId: string) {
		return filteredTasks.filter((t) => t.status === columnId);
	}

	function handleDragStart(event: DragStartEvent) {
		const task = tasks.find((t) => t.id === event.active.id);
		setActiveTask(task || null);
	}

	async function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event;
		setActiveTask(null);

		if (!over) return;

		const activeTask = tasks.find((t) => t.id === active.id);
		if (!activeTask) return;

		// Determine target column
		let targetStatus: string | undefined;
		if (COLUMNS.find((c) => c.id === over.id)) {
			targetStatus = over.id as string;
		} else {
			const overTask = tasks.find((t) => t.id === over.id);
			if (overTask) targetStatus = overTask.status;
		}

		if (!targetStatus || targetStatus === activeTask.status) return;

		// Optimistic update
		setTasks((prev) =>
			prev.map((t) => (t.id === activeTask.id ? { ...t, status: targetStatus as any } : t))
		);

		await supabase
			.from("tasks")
			.update({ status: targetStatus, updated_at: new Date().toISOString() })
			.eq("id", activeTask.id);
	}

	async function createTask() {
		if (!newTask.title.trim() || !newTask.project_id) return;
		const { data } = await supabase
			.from("tasks")
			.insert({
				title: newTask.title,
				priority: newTask.priority,
				project_id: newTask.project_id,
				status: newTask.status,
			})
			.select("*, project:projects(id, name, code)")
			.single();
		if (data) {
			setTasks((prev) => [data as any, ...prev]);
		}
		setNewTask({ title: "", priority: "medium", project_id: "", status: "todo" });
		setShowNewTask(false);
	}

	if (loading) {
		return (
			<div className="grid grid-cols-4 gap-4 p-6">
				{COLUMNS.map((c) => (
					<div key={c.id} className="bg-slate-800 rounded-xl border border-slate-700 p-4 animate-pulse">
						<div className="h-5 bg-slate-700 rounded w-3/4 mb-4"></div>
						{[1, 2, 3].map((i) => (
							<div key={i} className="h-20 bg-slate-700/50 rounded-xl mb-3"></div>
						))}
					</div>
				))}
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full">
			{/* Toolbar */}
			<div className="flex items-center gap-3 p-6 pb-4 flex-wrap">
				<select
					className="bg-slate-700/50 border border-slate-600 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
					value={filters.projectId}
					onChange={(e) => setFilters((f) => ({ ...f, projectId: e.target.value }))}
				>
					<option value="">Todos los proyectos</option>
					{projects.map((p) => (
						<option key={p.id} value={p.id}>{p.code} — {p.name}</option>
					))}
				</select>

				<select
					className="bg-slate-700/50 border border-slate-600 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
					value={filters.assigneeId}
					onChange={(e) => setFilters((f) => ({ ...f, assigneeId: e.target.value }))}
				>
					<option value="">Todos los miembros</option>
					{members.map((m) => (
						<option key={m.id} value={m.id}>{m.full_name}</option>
					))}
				</select>

				<select
					className="bg-slate-700/50 border border-slate-600 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
					value={filters.priority}
					onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}
				>
					<option value="">Todas las prioridades</option>
					<option value="low">Baja</option>
					<option value="medium">Media</option>
					<option value="high">Alta</option>
					<option value="urgent">Urgente</option>
				</select>

				<div className="ml-auto flex items-center gap-2">
					<span className="text-xs text-slate-500">{filteredTasks.length} tareas</span>
					<button
						onClick={() => setShowNewTask(true)}
						className="btn-primary"
					>
						<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
						</svg>
						Nueva Tarea
					</button>
				</div>
			</div>

			{/* New task modal */}
			{showNewTask && (
				<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
					<div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 w-full max-w-md shadow-2xl">
						<h3 className="text-base font-semibold text-slate-200 mb-5">Nueva Tarea</h3>
						<div className="space-y-4">
							<div>
								<label className="label">Título *</label>
								<input
									className="input"
									placeholder="Descripción de la tarea..."
									value={newTask.title}
									onChange={(e) => setNewTask((t) => ({ ...t, title: e.target.value }))}
									autoFocus
								/>
							</div>
							<div className="grid grid-cols-2 gap-3">
								<div>
									<label className="label">Proyecto *</label>
									<select
										className="input"
										value={newTask.project_id}
										onChange={(e) => setNewTask((t) => ({ ...t, project_id: e.target.value }))}
									>
										<option value="">Seleccionar...</option>
										{projects.map((p) => (
											<option key={p.id} value={p.id}>{p.code}</option>
										))}
									</select>
								</div>
								<div>
									<label className="label">Prioridad</label>
									<select
										className="input"
										value={newTask.priority}
										onChange={(e) => setNewTask((t) => ({ ...t, priority: e.target.value }))}
									>
										<option value="low">Baja</option>
										<option value="medium">Media</option>
										<option value="high">Alta</option>
										<option value="urgent">Urgente</option>
									</select>
								</div>
							</div>
							<div>
								<label className="label">Columna inicial</label>
								<select
									className="input"
									value={newTask.status}
									onChange={(e) => setNewTask((t) => ({ ...t, status: e.target.value }))}
								>
									{COLUMNS.map((c) => (
										<option key={c.id} value={c.id}>{c.label}</option>
									))}
								</select>
							</div>
						</div>
						<div className="flex gap-3 mt-6">
							<button onClick={createTask} className="btn-primary flex-1" disabled={!newTask.title.trim() || !newTask.project_id}>
								Crear Tarea
							</button>
							<button onClick={() => setShowNewTask(false)} className="btn-secondary">
								Cancelar
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Board */}
			<DndContext
				sensors={sensors}
				collisionDetection={closestCorners}
				onDragStart={handleDragStart}
				onDragEnd={handleDragEnd}
			>
				<div className="flex gap-4 px-6 pb-6 overflow-x-auto flex-1">
					{COLUMNS.map((column) => {
						const columnTasks = getColumnTasks(column.id);
						return (
							<div
								key={column.id}
								className={`flex flex-col bg-slate-800/50 rounded-xl border-t-2 ${column.color} min-w-[280px] w-[280px] flex-shrink-0`}
							>
								<div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
									<div className="flex items-center gap-2">
										<div
											className="w-2 h-2 rounded-full"
											style={{ backgroundColor: column.accent }}
										></div>
										<h3 className="text-sm font-semibold text-slate-300">{column.label}</h3>
									</div>
									<span className="text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded-full">
										{columnTasks.length}
									</span>
								</div>

								<SortableContext
									items={columnTasks.map((t) => t.id)}
									strategy={verticalListSortingStrategy}
								>
									<div className="flex-1 p-3 space-y-2 overflow-y-auto min-h-[200px]">
										{columnTasks.length === 0 ? (
											<div className="text-center text-slate-600 text-xs py-8">
												Sin tareas
											</div>
										) : (
											columnTasks.map((task) => (
												<TaskCard key={task.id} task={task} isDragging={activeTask?.id === task.id} />
											))
										)}
									</div>
								</SortableContext>
							</div>
						);
					})}
				</div>

				<DragOverlay>
					{activeTask ? (
						<div className="rotate-2 shadow-2xl">
							<TaskCard task={activeTask} />
						</div>
					) : null}
				</DragOverlay>
			</DndContext>
		</div>
	);
}
