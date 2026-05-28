-- ============================================================
-- ProjectHub — Supabase Database Schema
-- Ejecutar en el editor SQL de Supabase
-- ============================================================

-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT,
  full_name   TEXT,
  avatar_url  TEXT,
  role        TEXT NOT NULL DEFAULT 'cliente'
                CHECK (role IN ('project_leader', 'pmo', 'gestor', 'cliente')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Projects
CREATE TABLE IF NOT EXISTS public.projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'planning'
                CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled')),
  start_date  DATE,
  end_date    DATE,
  leader_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  budget      NUMERIC(12, 2),
  progress    INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Project Stages
CREATE TABLE IF NOT EXISTS public.project_stages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'in_progress', 'completed')),
  start_date   DATE,
  end_date     DATE,
  order_index  INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Project Risks
CREATE TABLE IF NOT EXISTS public.project_risks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  probability  TEXT NOT NULL DEFAULT 'medium'
                 CHECK (probability IN ('low', 'medium', 'high')),
  impact       TEXT NOT NULL DEFAULT 'medium'
                 CHECK (impact IN ('low', 'medium', 'high')),
  mitigation   TEXT,
  status       TEXT NOT NULL DEFAULT 'identified'
                 CHECK (status IN ('identified', 'mitigated', 'occurred', 'closed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Project Comments
CREATE TABLE IF NOT EXISTS public.project_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Project Members (team assignments per project)
CREATE TABLE IF NOT EXISTS public.project_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'gestor'
                CHECK (role IN ('project_leader', 'pmo', 'gestor', 'cliente')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, user_id)
);

-- Tasks (Kanban)
CREATE TABLE IF NOT EXISTS public.tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  stage_id     UUID REFERENCES public.project_stages(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'todo'
                 CHECK (status IN ('todo', 'in_progress', 'review', 'done')),
  assigned_to  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  priority     TEXT NOT NULL DEFAULT 'medium'
                 CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date     DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Triggers
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url',
    'cliente'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_risks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks          ENABLE ROW LEVEL SECURITY;

-- Profiles: all authenticated users can read, only own row can update
CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Projects: all authenticated users can read; leaders/pmo can insert/update
CREATE POLICY "Projects are viewable by authenticated users"
  ON public.projects FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Project leaders and PMO can manage projects"
  ON public.projects FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('project_leader', 'pmo')
    )
  );

-- Project stages, risks, comments, members, tasks: same pattern
CREATE POLICY "Stages viewable by authenticated"
  ON public.project_stages FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Stages managed by leaders/pmo"
  ON public.project_stages FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('project_leader', 'pmo'))
  );

CREATE POLICY "Risks viewable by authenticated"
  ON public.project_risks FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Risks managed by leaders/pmo"
  ON public.project_risks FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('project_leader', 'pmo'))
  );

CREATE POLICY "Comments viewable by authenticated"
  ON public.project_comments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Any member can insert comments"
  ON public.project_comments FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = author_id);
CREATE POLICY "Authors can delete own comments"
  ON public.project_comments FOR DELETE USING (auth.uid() = author_id);

CREATE POLICY "Members viewable by authenticated"
  ON public.project_members FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Members managed by leaders/pmo"
  ON public.project_members FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('project_leader', 'pmo'))
  );

CREATE POLICY "Tasks viewable by authenticated"
  ON public.tasks FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Tasks managed by authenticated"
  ON public.tasks FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================
-- Sample data (optional — remove in production)
-- ============================================================

-- INSERT INTO public.projects (code, name, description, status, start_date, end_date, progress)
-- VALUES
--   ('PRY-001', 'Transformación Digital', 'Modernización de sistemas legacy', 'active', '2026-01-15', '2026-12-31', 35),
--   ('PRY-002', 'Portal Web Corporativo', 'Rediseño completo del sitio web', 'planning', '2026-06-01', '2026-09-30', 0),
--   ('PRY-003', 'App Móvil de Ventas', 'Aplicación para fuerza de ventas', 'on_hold', '2026-03-01', '2026-08-31', 60);
