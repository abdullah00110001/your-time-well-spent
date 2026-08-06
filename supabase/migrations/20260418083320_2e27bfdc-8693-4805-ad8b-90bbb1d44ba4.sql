-- ============================================================
-- 1. Fix recursive RLS on accountability_group_members
-- The old SELECT policy queried itself (no alias on inner ref)
-- which Postgres treats as `agm.group_id = agm.group_id` and
-- creates infinite recursion when used inside other policies.
-- ============================================================

-- Helper: SECURITY DEFINER avoids recursion
CREATE OR REPLACE FUNCTION public.is_group_member(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.accountability_group_members
    WHERE group_id = _group_id AND user_id = _user_id
  );
$$;

-- Drop the buggy policies
DROP POLICY IF EXISTS "Members can view group members" ON public.accountability_group_members;
DROP POLICY IF EXISTS "Members can view groups" ON public.accountability_groups;
DROP POLICY IF EXISTS "Group members can view wake status" ON public.group_wake_status;

-- Recreate correctly using the helper
CREATE POLICY "Members can view group members"
ON public.accountability_group_members
FOR SELECT
USING (
  public.is_group_member(group_id, auth.uid())
  OR user_id = auth.uid()
);

CREATE POLICY "Members can view groups"
ON public.accountability_groups
FOR SELECT
USING (
  public.is_group_member(id, auth.uid())
  OR created_by = auth.uid()
);

CREATE POLICY "Group members can view wake status"
ON public.group_wake_status
FOR SELECT
USING ( public.is_group_member(group_id, auth.uid()) );

-- Allow admins to remove members
CREATE POLICY "Admins can remove members"
ON public.accountability_group_members
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.accountability_groups g
    WHERE g.id = accountability_group_members.group_id
      AND g.created_by = auth.uid()
  )
);

-- Allow admins to update member roles
CREATE POLICY "Admins can update member roles"
ON public.accountability_group_members
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.accountability_groups g
    WHERE g.id = accountability_group_members.group_id
      AND g.created_by = auth.uid()
  )
);

-- ============================================================
-- 2. Custom Daily Fields tables (used by CustomFieldsManager)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.daily_custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  field_key text NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL CHECK (field_type IN ('number','boolean','text','minutes')),
  unit text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, field_key)
);

ALTER TABLE public.daily_custom_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own custom fields"
ON public.daily_custom_fields
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_daily_custom_fields_updated_at
BEFORE UPDATE ON public.daily_custom_fields
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.daily_custom_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  field_id uuid NOT NULL REFERENCES public.daily_custom_fields(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  value_number numeric,
  value_text text,
  value_bool boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, field_id, date)
);

ALTER TABLE public.daily_custom_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own custom values"
ON public.daily_custom_values
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_daily_custom_values_updated_at
BEFORE UPDATE ON public.daily_custom_values
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_daily_custom_values_lookup
ON public.daily_custom_values(user_id, date);