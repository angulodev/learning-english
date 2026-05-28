import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Role = "project_leader" | "pmo" | "gestor" | "cliente";

export type Profile = {
	id: string;
	email: string;
	full_name: string;
	avatar_url: string | null;
	role: Role;
	created_at: string;
};

export type Project = {
	id: string;
	code: string;
	name: string;
	description: string | null;
	status: "planning" | "active" | "on_hold" | "completed" | "cancelled";
	start_date: string | null;
	end_date: string | null;
	leader_id: string | null;
	budget: number | null;
	progress: number;
	created_at: string;
	updated_at: string;
	leader?: Profile;
	members?: ProjectMember[];
};

export type ProjectStage = {
	id: string;
	project_id: string;
	name: string;
	description: string | null;
	status: "pending" | "in_progress" | "completed";
	start_date: string | null;
	end_date: string | null;
	order_index: number;
	created_at: string;
};

export type ProjectRisk = {
	id: string;
	project_id: string;
	title: string;
	description: string | null;
	probability: "low" | "medium" | "high";
	impact: "low" | "medium" | "high";
	mitigation: string | null;
	status: "identified" | "mitigated" | "occurred" | "closed";
	created_at: string;
};

export type ProjectComment = {
	id: string;
	project_id: string;
	author_id: string;
	content: string;
	created_at: string;
	author?: Profile;
};

export type ProjectMember = {
	id: string;
	project_id: string;
	user_id: string;
	role: Role;
	created_at: string;
	user?: Profile;
};

export type Task = {
	id: string;
	project_id: string;
	stage_id: string | null;
	title: string;
	description: string | null;
	status: "todo" | "in_progress" | "review" | "done";
	assigned_to: string | null;
	priority: "low" | "medium" | "high" | "urgent";
	due_date: string | null;
	created_at: string;
	updated_at: string;
	assignee?: Profile;
	project?: Project;
};

export const ROLE_LABELS: Record<Role, string> = {
	project_leader: "Líder de Proyecto",
	pmo: "PMO",
	gestor: "Gestor",
	cliente: "Cliente",
};

export const ROLE_COLORS: Record<Role, string> = {
	project_leader: "badge-purple",
	pmo: "badge-blue",
	gestor: "badge-green",
	cliente: "badge-yellow",
};

export const STATUS_LABELS: Record<Project["status"], string> = {
	planning: "Planificación",
	active: "Activo",
	on_hold: "En Espera",
	completed: "Completado",
	cancelled: "Cancelado",
};

export const STATUS_COLORS: Record<Project["status"], string> = {
	planning: "badge-blue",
	active: "badge-green",
	on_hold: "badge-yellow",
	completed: "badge-gray",
	cancelled: "badge-red",
};
