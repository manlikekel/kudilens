-- Net worth history: one snapshot per user per month, refreshed whenever the dashboard loads.
CREATE TABLE IF NOT EXISTS public.net_worth_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  month date NOT NULL,
  currency text NOT NULL DEFAULT 'NGN',
  net_worth numeric NOT NULL,
  investments numeric NOT NULL DEFAULT 0,
  cash numeric NOT NULL DEFAULT 0,
  assets numeric NOT NULL DEFAULT 0,
  debt numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, month)
);
CREATE INDEX IF NOT EXISTS net_worth_snapshots_user_month ON public.net_worth_snapshots (user_id, month DESC);

-- Monthly spending limits per category.
CREATE TABLE IF NOT EXISTS public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category text NOT NULL,
  monthly_limit numeric NOT NULL,
  currency text NOT NULL DEFAULT 'NGN',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category)
);

-- Saved what-if scenarios: a name and a list of changes (one-off costs, monthly changes, ...).
CREATE TABLE IF NOT EXISTS public.scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  changes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Sinking funds: how much has been set aside towards each yearly lump cost.
ALTER TABLE public.lump_costs ADD COLUMN IF NOT EXISTS saved numeric NOT NULL DEFAULT 0;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.net_worth_snapshots, public.budgets, public.scenarios TO authenticated;
GRANT ALL ON public.net_worth_snapshots, public.budgets, public.scenarios TO service_role;

ALTER TABLE public.net_worth_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own snapshots" ON public.net_worth_snapshots FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own budgets" ON public.budgets FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own scenarios" ON public.scenarios FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
