-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  age integer,
  retirement_age integer DEFAULT 60,
  base_currency text NOT NULL DEFAULT 'NGN',
  usd_ngn_rate numeric NOT NULL DEFAULT 1500,
  inflation_rate numeric NOT NULL DEFAULT 20,
  risk_tolerance text NOT NULL DEFAULT 'balanced',
  goals text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile delete" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);

-- FAMILY
CREATE TABLE public.family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  relationship text NOT NULL DEFAULT 'child',
  age integer NOT NULL DEFAULT 0,
  dependent boolean NOT NULL DEFAULT true,
  monthly_cost numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'NGN',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_members TO authenticated;
GRANT ALL ON public.family_members TO service_role;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own family all" ON public.family_members FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- DEBTS
CREATE TABLE public.debts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'loan',
  balance numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'NGN',
  interest_rate numeric NOT NULL DEFAULT 0,
  minimum_payment numeric NOT NULL DEFAULT 0,
  due_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.debts TO authenticated;
GRANT ALL ON public.debts TO service_role;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own debts all" ON public.debts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- INVESTMENTS
CREATE TABLE public.investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  asset_class text NOT NULL DEFAULT 'stocks',
  current_value numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'NGN',
  monthly_contribution numeric NOT NULL DEFAULT 0,
  expected_return numeric NOT NULL DEFAULT 10,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investments TO authenticated;
GRANT ALL ON public.investments TO service_role;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own investments all" ON public.investments FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- CASH FLOWS (income & spending)
CREATE TABLE public.cash_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  flow_type text NOT NULL DEFAULT 'expense',
  category text NOT NULL DEFAULT 'general',
  monthly_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'NGN',
  growth_rate numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_flows TO authenticated;
GRANT ALL ON public.cash_flows TO service_role;
ALTER TABLE public.cash_flows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own flows all" ON public.cash_flows FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ADVISOR MESSAGES (single ongoing conversation per user)
CREATE TABLE public.advisor_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.advisor_messages TO authenticated;
GRANT ALL ON public.advisor_messages TO service_role;
ALTER TABLE public.advisor_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own messages all" ON public.advisor_messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- auto profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();