CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'bank',
  balance numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'NGN',
  yield_rate numeric NOT NULL DEFAULT 0,
  is_emergency_fund boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'land',
  current_value numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'NGN',
  appreciation numeric NOT NULL DEFAULT 10,
  liquid boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.fx_rates (
  currency text PRIMARY KEY,
  per_usd numeric NOT NULL,
  as_of timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'official'
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts, public.assets TO authenticated;
GRANT ALL ON public.accounts, public.assets, public.fx_rates TO service_role;
GRANT SELECT ON public.fx_rates TO authenticated;

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own accounts" ON public.accounts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own assets" ON public.assets FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "signed-in users read fx rates" ON public.fx_rates FOR SELECT TO authenticated USING (true);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS fx_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS inflation_fx_correlation numeric NOT NULL DEFAULT 0.6,
  ADD COLUMN IF NOT EXISTS cash_yield_ratio numeric NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS foreign_inflation numeric NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS grow_contributions boolean NOT NULL DEFAULT true;

-- Keep a rate the user deliberately entered (anything other than the old 1500 default) as their NGN override.
UPDATE public.profiles SET fx_overrides = jsonb_build_object('NGN', usd_ngn_rate)
  WHERE usd_ngn_rate IS NOT NULL AND usd_ngn_rate <> 1500 AND fx_overrides = '{}'::jsonb;
COMMENT ON COLUMN public.profiles.usd_ngn_rate IS 'DEPRECATED: replaced by fx_rates + fx_overrides';

ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS saved_in text NOT NULL DEFAULT 'money market',
  ADD COLUMN IF NOT EXISTS goal_inflation numeric,
  ADD COLUMN IF NOT EXISTS target_month integer NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS linked_account_id uuid;