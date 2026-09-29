ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS fx_depreciation numeric NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS education_inflation numeric NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS salary_growth numeric NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS income_stability text NOT NULL DEFAULT 'stable',
  ADD COLUMN IF NOT EXISTS life_cover numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS health_cover numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS emergency_fund numeric NOT NULL DEFAULT 0;

CREATE TABLE public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  target_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'NGN',
  target_year int NOT NULL,
  current_saved numeric NOT NULL DEFAULT 0,
  monthly_contribution numeric NOT NULL DEFAULT 0,
  priority int NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.lump_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'NGN',
  months int[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.investment_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'NGN',
  notes text,
  review jsonb,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  batch_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL,
  title text NOT NULL,
  finding text NOT NULL,
  metric text,
  severity text NOT NULL DEFAULT 'watch',
  action text,
  impact text,
  status text NOT NULL DEFAULT 'new',
  snoozed_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.monthly_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period text NOT NULL,
  report jsonb NOT NULL,
  net_worth numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, period)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals, public.lump_costs, public.investment_ideas, public.ai_insights, public.monthly_reviews TO authenticated;
GRANT ALL ON public.goals, public.lump_costs, public.investment_ideas, public.ai_insights, public.monthly_reviews TO service_role;

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lump_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own goals" ON public.goals FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own lump costs" ON public.lump_costs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own ideas" ON public.investment_ideas FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own insights" ON public.ai_insights FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own reviews" ON public.monthly_reviews FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);