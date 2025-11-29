-- Create enum for user roles
CREATE TYPE app_role AS ENUM ('admin', 'worker');

-- Create profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  role app_role NOT NULL DEFAULT 'worker',
  profile_photo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create livestock categories table
CREATE TABLE livestock_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE livestock_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view livestock categories"
  ON livestock_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage livestock categories"
  ON livestock_categories FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Create livestock census table
CREATE TABLE livestock_census (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  livestock_category_id UUID NOT NULL REFERENCES livestock_categories(id) ON DELETE CASCADE,
  total_count INT NOT NULL DEFAULT 0,
  updated_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE livestock_census ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view livestock census"
  ON livestock_census FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage livestock census"
  ON livestock_census FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Create feed types table
CREATE TABLE feed_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_name TEXT NOT NULL UNIQUE,
  unit_type TEXT NOT NULL,
  price_per_unit DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE feed_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view feed types"
  ON feed_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage feed types"
  ON feed_types FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Create feed inventory table
CREATE TABLE feed_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_type_id UUID NOT NULL REFERENCES feed_types(id) ON DELETE CASCADE,
  quantity_in_stock DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE feed_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view feed inventory"
  ON feed_inventory FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage feed inventory"
  ON feed_inventory FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Create mortality records table
CREATE TABLE mortality_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  livestock_category_id UUID NOT NULL REFERENCES livestock_categories(id) ON DELETE CASCADE,
  quantity_dead INT NOT NULL,
  reason TEXT,
  recorded_by UUID NOT NULL REFERENCES profiles(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE mortality_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view mortality records"
  ON mortality_records FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create mortality records"
  ON mortality_records FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = recorded_by);

CREATE POLICY "Only admins can update/delete mortality records"
  ON mortality_records FOR UPDATE
  TO authenticated
  USING (is_admin());

CREATE POLICY "Only admins can delete mortality records"
  ON mortality_records FOR DELETE
  TO authenticated
  USING (is_admin());

-- Create daily production table
CREATE TABLE daily_production (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  crates INT NOT NULL DEFAULT 0,
  pieces INT NOT NULL DEFAULT 0,
  recorded_by UUID NOT NULL REFERENCES profiles(id),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE daily_production ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view daily production"
  ON daily_production FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create daily production"
  ON daily_production FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = recorded_by);

CREATE POLICY "Only admins can update/delete daily production"
  ON daily_production FOR UPDATE
  TO authenticated
  USING (is_admin());

CREATE POLICY "Only admins can delete daily production"
  ON daily_production FOR DELETE
  TO authenticated
  USING (is_admin());

-- Create miscellaneous expenses table
CREATE TABLE miscellaneous_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_type TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE miscellaneous_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view expenses"
  ON miscellaneous_expenses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage expenses"
  ON miscellaneous_expenses FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Create sales records table
CREATE TABLE sales_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name TEXT NOT NULL,
  product_type TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit TEXT NOT NULL,
  price_per_unit DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  buyer_name TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sales_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view sales records"
  ON sales_records FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create sales records"
  ON sales_records FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = recorded_by);

CREATE POLICY "Only admins can update/delete sales records"
  ON sales_records FOR UPDATE
  TO authenticated
  USING (is_admin());

CREATE POLICY "Only admins can delete sales records"
  ON sales_records FOR DELETE
  TO authenticated
  USING (is_admin());

-- Create trigger function to auto-update livestock census on mortality
CREATE OR REPLACE FUNCTION update_livestock_census()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE livestock_census
  SET updated_count = updated_count - NEW.quantity_dead,
      updated_at = NOW()
  WHERE livestock_category_id = NEW.livestock_category_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on mortality records
CREATE TRIGGER on_mortality_update_census
AFTER INSERT ON mortality_records
FOR EACH ROW
EXECUTE FUNCTION update_livestock_census();

-- Create trigger function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'worker')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION handle_new_user();