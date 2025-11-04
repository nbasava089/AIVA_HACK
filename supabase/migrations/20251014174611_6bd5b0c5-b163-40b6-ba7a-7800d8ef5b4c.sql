-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'editor', 'viewer');

-- Tenants table (for multi-tenant SaaS)
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tenant_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _tenant_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
      AND role = _role
  )
$$;

-- Folders table
CREATE TABLE public.folders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  parent_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

-- Assets table
CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  description TEXT,
  tags TEXT[],
  metadata JSONB DEFAULT '{}'::jsonb,
  license TEXT,
  owner_id UUID REFERENCES auth.users(id),
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- Asset versions table
CREATE TABLE public.asset_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE NOT NULL,
  version INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  change_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.asset_versions ENABLE ROW LEVEL SECURITY;

-- Asset shares table (for role-based sharing)
CREATE TABLE public.asset_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  shared_with_user_id UUID REFERENCES auth.users(id),
  shared_with_role public.app_role,
  permission TEXT NOT NULL CHECK (permission IN ('view', 'edit', 'delete')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK ((asset_id IS NOT NULL AND folder_id IS NULL) OR (asset_id IS NULL AND folder_id IS NOT NULL))
);

ALTER TABLE public.asset_shares ENABLE ROW LEVEL SECURITY;

-- Audit logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Chat history table
CREATE TABLE public.chat_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  response TEXT,
  action_taken JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;

-- Analytics events table
CREATE TABLE public.analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('view', 'download', 'share', 'upload', 'edit', 'delete')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tenants
CREATE POLICY "Users can view their tenant"
  ON public.tenants FOR SELECT
  USING (
    id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for profiles
CREATE POLICY "Users can view profiles in their tenant"
  ON public.profiles FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- RLS Policies for user_roles
CREATE POLICY "Users can view roles in their tenant"
  ON public.user_roles FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for folders
CREATE POLICY "Users can view folders in their tenant"
  ON public.folders FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Editors and admins can create folders"
  ON public.folders FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), tenant_id, 'admin') OR
    public.has_role(auth.uid(), tenant_id, 'editor')
  );

CREATE POLICY "Editors and admins can update folders"
  ON public.folders FOR UPDATE
  USING (
    public.has_role(auth.uid(), tenant_id, 'admin') OR
    public.has_role(auth.uid(), tenant_id, 'editor')
  );

CREATE POLICY "Admins can delete folders"
  ON public.folders FOR DELETE
  USING (public.has_role(auth.uid(), tenant_id, 'admin'));

-- RLS Policies for assets
CREATE POLICY "Users can view assets in their tenant"
  ON public.assets FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Editors and admins can create assets"
  ON public.assets FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), tenant_id, 'admin') OR
    public.has_role(auth.uid(), tenant_id, 'editor')
  );

CREATE POLICY "Editors and admins can update assets"
  ON public.assets FOR UPDATE
  USING (
    public.has_role(auth.uid(), tenant_id, 'admin') OR
    public.has_role(auth.uid(), tenant_id, 'editor')
  );

CREATE POLICY "Admins can delete assets"
  ON public.assets FOR DELETE
  USING (public.has_role(auth.uid(), tenant_id, 'admin'));

-- RLS Policies for asset_versions
CREATE POLICY "Users can view asset versions in their tenant"
  ON public.asset_versions FOR SELECT
  USING (
    asset_id IN (
      SELECT id FROM public.assets WHERE tenant_id IN (
        SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

-- RLS Policies for asset_shares
CREATE POLICY "Users can view shares in their tenant"
  ON public.asset_shares FOR SELECT
  USING (
    asset_id IN (
      SELECT id FROM public.assets WHERE tenant_id IN (
        SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
      )
    ) OR
    folder_id IN (
      SELECT id FROM public.folders WHERE tenant_id IN (
        SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

-- RLS Policies for audit_logs
CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (
    public.has_role(auth.uid(), tenant_id, 'admin')
  );

-- RLS Policies for chat_history
CREATE POLICY "Users can view their own chat history"
  ON public.chat_history FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create chat messages"
  ON public.chat_history FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for analytics_events
CREATE POLICY "Admins can view analytics"
  ON public.analytics_events FOR SELECT
  USING (
    public.has_role(auth.uid(), tenant_id, 'admin')
  );

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_folders_updated_at
  BEFORE UPDATE ON public.folders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assets_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_tenant_id UUID;
BEGIN
  -- Create a default tenant for new user
  INSERT INTO public.tenants (name, slug)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'My Organization'),
    LOWER(REPLACE(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.id::text), ' ', '-'))
  )
  RETURNING id INTO default_tenant_id;

  -- Create profile
  INSERT INTO public.profiles (id, tenant_id, email, full_name)
  VALUES (
    NEW.id,
    default_tenant_id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );

  -- Assign admin role
  INSERT INTO public.user_roles (user_id, tenant_id, role)
  VALUES (NEW.id, default_tenant_id, 'admin');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();