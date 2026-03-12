-- HRMS Belarus: initial schema from SCHEMA.md
-- Enums, base tables, composite FKs, DEFERRABLE FKs for cycles, CHECKs, triggers

-- Extensions
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Enums
CREATE TYPE candidate_status AS ENUM ('applied', 'interview', 'offer', 'prehire', 'closed');
CREATE TYPE employment_type AS ENUM ('main', 'part_time', 'intern');
CREATE TYPE employment_status AS ENUM ('active', 'terminated', 'draft');
CREATE TYPE order_kind AS ENUM ('hire', 'transfer', 'leave', 'travel', 'misc', 'termination');
CREATE TYPE order_status AS ENUM ('draft', 'registered', 'signed', 'canceled');
CREATE TYPE item_type AS ENUM ('hire', 'transfer', 'leave', 'travel', 'misc', 'termination', 'cancel');
CREATE TYPE item_state AS ENUM ('draft', 'applied', 'voided');
CREATE TYPE absence_type AS ENUM ('leave', 'travel');
CREATE TYPE absence_status AS ENUM ('active', 'canceled');
CREATE TYPE contract_type AS ENUM ('employment_contract', 'contract');
CREATE TYPE amendment_type AS ENUM ('amendment', 'extension');

-- 1. Organizations & branches
CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

CREATE TABLE branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);
CREATE UNIQUE INDEX branches_organization_id_id_key ON branches (organization_id, id);

-- 2. Reference: countries
CREATE TABLE countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text,
  name text NOT NULL
);

-- 3. Org structure (branch-scoped)
CREATE TABLE departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);
CREATE UNIQUE INDEX departments_branch_id_id_key ON departments (branch_id, id);

CREATE TABLE positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);
CREATE UNIQUE INDEX positions_branch_id_id_key ON positions (branch_id, id);

-- 4. Order registers (journal/series)
CREATE TABLE order_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id),
  register_code text NOT NULL,
  suffix text,
  retention_group text,
  year int NOT NULL,
  last_seq int NOT NULL DEFAULT 0,
  prefix text,
  number_format text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  UNIQUE (branch_id, register_code, year)
);
CREATE UNIQUE INDEX order_registers_branch_id_id_key ON order_registers (branch_id, id);

-- 5. Reference: termination_reasons
CREATE TABLE termination_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text,
  name text NOT NULL
);

-- 6. Persons (branch-scoped)
CREATE TABLE persons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id),
  person_no text,
  last_name text,
  first_name text,
  patronymic text,
  birth_date date,
  gender text,
  citizenship_id uuid REFERENCES countries(id),
  contact_phone text,
  contact_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);
CREATE UNIQUE INDEX persons_branch_id_id_key ON persons (branch_id, id);

-- 7. Person documents
CREATE TABLE person_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  person_id uuid NOT NULL,
  doc_type text NOT NULL,
  series text,
  number text,
  issued_by text,
  issued_at date,
  expires_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  FOREIGN KEY (branch_id, person_id) REFERENCES persons (branch_id, id)
);
CREATE UNIQUE INDEX person_documents_branch_id_id_key ON person_documents (branch_id, id);

-- 8. Candidates (recruitment pipeline)
CREATE TABLE candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  person_id uuid NOT NULL,
  status candidate_status NOT NULL DEFAULT 'applied',
  vacancy_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  FOREIGN KEY (branch_id, person_id) REFERENCES persons (branch_id, id)
);
CREATE UNIQUE INDEX candidates_branch_id_id_key ON candidates (branch_id, id);
CREATE UNIQUE INDEX candidates_branch_person_active_key ON candidates (branch_id, person_id) WHERE status != 'closed';

-- 9. Orders (header)
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id),
  order_kind order_kind NOT NULL,
  order_register_id uuid REFERENCES order_registers(id),
  order_date date NOT NULL,
  effective_date date,
  reg_seq int,
  reg_number text,
  status order_status NOT NULL DEFAULT 'draft',
  title text,
  note text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  CONSTRAINT orders_reg_seq_number_check CHECK (
    (status IN ('registered', 'signed')) = (reg_seq IS NOT NULL AND reg_number IS NOT NULL)
  )
);
CREATE UNIQUE INDEX orders_branch_id_id_key ON orders (branch_id, id);
CREATE UNIQUE INDEX orders_register_seq_key ON orders (order_register_id, reg_seq) WHERE reg_seq IS NOT NULL;

-- 10. Order items (before employments due to cycle: employments reference order_items)
CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  order_id uuid NOT NULL,
  line_no int NOT NULL,
  person_id uuid NOT NULL,
  employment_id uuid,
  item_type item_type NOT NULL,
  reverses_item_id uuid REFERENCES order_items(id) DEFERRABLE INITIALLY DEFERRED,
  reversed_by_item_id uuid REFERENCES order_items(id) DEFERRABLE INITIALLY DEFERRED,
  effective_from date,
  effective_to date,
  payload jsonb,
  contract_id uuid,
  contract_amendment_id uuid,
  state item_state NOT NULL DEFAULT 'draft',
  applied_at timestamptz,
  applied_by uuid REFERENCES auth.users(id),
  voided_at timestamptz,
  voided_by uuid REFERENCES auth.users(id),
  void_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  FOREIGN KEY (branch_id, order_id) REFERENCES orders (branch_id, id),
  FOREIGN KEY (branch_id, person_id) REFERENCES persons (branch_id, id)
);
CREATE UNIQUE INDEX order_items_branch_id_id_key ON order_items (branch_id, id);
CREATE UNIQUE INDEX order_items_reverses_item_key ON order_items (reverses_item_id) WHERE item_type = 'cancel';

-- CHECKs order_items by item_type (simplified: hire/transfer/termination/leave/travel/cancel)
ALTER TABLE order_items ADD CONSTRAINT order_items_hire_check CHECK (
  item_type != 'hire' OR (effective_from IS NOT NULL)
);
ALTER TABLE order_items ADD CONSTRAINT order_items_transfer_check CHECK (
  item_type != 'transfer' OR (employment_id IS NOT NULL AND effective_from IS NOT NULL)
);
ALTER TABLE order_items ADD CONSTRAINT order_items_termination_check CHECK (
  item_type != 'termination' OR (employment_id IS NOT NULL AND effective_from IS NOT NULL)
);
ALTER TABLE order_items ADD CONSTRAINT order_items_leave_travel_check CHECK (
  item_type NOT IN ('leave', 'travel') OR (
    employment_id IS NOT NULL AND effective_from IS NOT NULL AND effective_to IS NOT NULL AND effective_to >= effective_from
  )
);
ALTER TABLE order_items ADD CONSTRAINT order_items_cancel_check CHECK (
  item_type != 'cancel' OR reverses_item_id IS NOT NULL
);
ALTER TABLE order_items ADD CONSTRAINT order_items_state_check CHECK (
  (state = 'draft' AND applied_at IS NULL AND voided_at IS NULL)
  OR (state = 'applied' AND applied_at IS NOT NULL AND voided_at IS NULL)
  OR (state = 'voided' AND voided_at IS NOT NULL)
);

-- 11. Employments (references order_items — DEFERRABLE)
CREATE TABLE employments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  person_id uuid NOT NULL,
  employment_type employment_type NOT NULL DEFAULT 'main',
  status employment_status NOT NULL DEFAULT 'active',
  start_date date NOT NULL,
  end_date date,
  termination_reason_id uuid REFERENCES termination_reasons(id),
  hire_order_item_id uuid REFERENCES order_items(id) DEFERRABLE INITIALLY DEFERRED,
  termination_order_item_id uuid REFERENCES order_items(id) DEFERRABLE INITIALLY DEFERRED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  FOREIGN KEY (branch_id, person_id) REFERENCES persons (branch_id, id)
);
CREATE UNIQUE INDEX employments_branch_id_id_key ON employments (branch_id, id);
CREATE UNIQUE INDEX employments_one_active_per_person ON employments (person_id) WHERE status = 'active';

-- Add FK order_items.employment_id -> employments
ALTER TABLE order_items ADD CONSTRAINT order_items_employment_id_fkey
  FOREIGN KEY (branch_id, employment_id) REFERENCES employments (branch_id, id);

-- 12. Assignments
CREATE TABLE assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  employment_id uuid NOT NULL,
  department_id uuid NOT NULL,
  position_id uuid NOT NULL,
  rate numeric,
  start_date date NOT NULL,
  end_date date,
  basis_order_item_id uuid REFERENCES order_items(id) DEFERRABLE INITIALLY DEFERRED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  FOREIGN KEY (branch_id, employment_id) REFERENCES employments (branch_id, id),
  FOREIGN KEY (branch_id, department_id) REFERENCES departments (branch_id, id),
  FOREIGN KEY (branch_id, position_id) REFERENCES positions (branch_id, id)
);
CREATE UNIQUE INDEX assignments_branch_id_id_key ON assignments (branch_id, id);
CREATE UNIQUE INDEX assignments_one_active_per_employment ON assignments (employment_id) WHERE end_date IS NULL;
CREATE UNIQUE INDEX assignments_basis_order_item_key ON assignments (basis_order_item_id) WHERE basis_order_item_id IS NOT NULL;

-- 13. Absence periods
CREATE TABLE absence_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  employment_id uuid NOT NULL,
  absence_type absence_type NOT NULL,
  subtype text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  period daterange GENERATED ALWAYS AS (daterange(start_date, end_date, '[]')) STORED,
  basis_order_item_id uuid REFERENCES order_items(id) DEFERRABLE INITIALLY DEFERRED,
  status absence_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  FOREIGN KEY (branch_id, employment_id) REFERENCES employments (branch_id, id)
);
CREATE UNIQUE INDEX absence_periods_branch_id_id_key ON absence_periods (branch_id, id);
CREATE UNIQUE INDEX absence_periods_basis_order_item_key ON absence_periods (basis_order_item_id) WHERE basis_order_item_id IS NOT NULL;
-- Exclusion: no overlapping active periods per employment (btree_gist for uuid + daterange)
ALTER TABLE absence_periods ADD CONSTRAINT absence_periods_no_overlap_active
  EXCLUDE USING gist (employment_id WITH =, period WITH &&)
  WHERE (status = 'active');

-- 14. Contracts
CREATE TABLE contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  person_id uuid NOT NULL,
  employment_id uuid,
  contract_type contract_type NOT NULL,
  doc_number text,
  signed_at date,
  valid_from date,
  valid_to date,
  hire_order_item_id uuid REFERENCES order_items(id) DEFERRABLE INITIALLY DEFERRED,
  storage_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  FOREIGN KEY (branch_id, person_id) REFERENCES persons (branch_id, id),
  FOREIGN KEY (branch_id, employment_id) REFERENCES employments (branch_id, id)
);
CREATE UNIQUE INDEX contracts_branch_id_id_key ON contracts (branch_id, id);

-- 15. Contract amendments
CREATE TABLE contract_amendments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  contract_id uuid NOT NULL REFERENCES contracts(id),
  amendment_type amendment_type NOT NULL,
  order_item_id uuid REFERENCES order_items(id) DEFERRABLE INITIALLY DEFERRED,
  doc_number text,
  signed_at date,
  valid_from date,
  valid_to date,
  payload jsonb,
  storage_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  FOREIGN KEY (branch_id, contract_id) REFERENCES contracts (branch_id, id)
);
CREATE UNIQUE INDEX contract_amendments_branch_id_id_key ON contract_amendments (branch_id, id);

-- Add FK order_items.contract_id, contract_amendment_id
ALTER TABLE order_items ADD CONSTRAINT order_items_contract_id_fkey
  FOREIGN KEY (branch_id, contract_id) REFERENCES contracts (branch_id, id);
ALTER TABLE order_items ADD CONSTRAINT order_items_contract_amendment_id_fkey
  FOREIGN KEY (branch_id, contract_amendment_id) REFERENCES contract_amendments (branch_id, id);

-- 16. Profiles (system users)
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 17. User roles
CREATE TABLE user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('global_admin', 'branch_admin', 'hr', 'viewer')),
  branch_id uuid REFERENCES branches(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, branch_id),
  CONSTRAINT user_roles_global_admin_branch_check CHECK (
    (role = 'global_admin') = (branch_id IS NULL)
  )
);

-- Trigger: set order_items.branch_id from orders
CREATE OR REPLACE FUNCTION set_order_items_branch_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.branch_id IS NULL AND NEW.order_id IS NOT NULL THEN
    SELECT branch_id INTO NEW.branch_id FROM orders WHERE id = NEW.order_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER order_items_set_branch_id
  BEFORE INSERT ON order_items
  FOR EACH ROW EXECUTE PROCEDURE set_order_items_branch_id();

-- Trigger: set assignments/absence_periods branch_id from employments
CREATE OR REPLACE FUNCTION set_assignments_branch_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.branch_id IS NULL AND NEW.employment_id IS NOT NULL THEN
    SELECT branch_id INTO NEW.branch_id FROM employments WHERE id = NEW.employment_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER assignments_set_branch_id
  BEFORE INSERT ON assignments
  FOR EACH ROW EXECUTE PROCEDURE set_assignments_branch_id();

CREATE OR REPLACE FUNCTION set_absence_periods_branch_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.branch_id IS NULL AND NEW.employment_id IS NOT NULL THEN
    SELECT branch_id INTO NEW.branch_id FROM employments WHERE id = NEW.employment_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER absence_periods_set_branch_id
  BEFORE INSERT ON absence_periods
  FOR EACH ROW EXECUTE PROCEDURE set_absence_periods_branch_id();

-- Trigger: set person_documents/candidates branch_id from persons
CREATE OR REPLACE FUNCTION set_person_child_branch_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.branch_id IS NULL AND NEW.person_id IS NOT NULL THEN
    SELECT branch_id INTO NEW.branch_id FROM persons WHERE id = NEW.person_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER person_documents_set_branch_id
  BEFORE INSERT ON person_documents
  FOR EACH ROW EXECUTE PROCEDURE set_person_child_branch_id();
CREATE TRIGGER candidates_set_branch_id
  BEFORE INSERT ON candidates
  FOR EACH ROW EXECUTE PROCEDURE set_person_child_branch_id();

-- Trigger: set contracts branch_id from persons
CREATE OR REPLACE FUNCTION set_contracts_branch_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.branch_id IS NULL AND NEW.person_id IS NOT NULL THEN
    SELECT branch_id INTO NEW.branch_id FROM persons WHERE id = NEW.person_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER contracts_set_branch_id
  BEFORE INSERT ON contracts
  FOR EACH ROW EXECUTE PROCEDURE set_contracts_branch_id();

-- Trigger: set contract_amendments branch_id from contracts
CREATE OR REPLACE FUNCTION set_contract_amendments_branch_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.branch_id IS NULL AND NEW.contract_id IS NOT NULL THEN
    SELECT branch_id INTO NEW.branch_id FROM contracts WHERE id = NEW.contract_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER contract_amendments_set_branch_id
  BEFORE INSERT ON contract_amendments
  FOR EACH ROW EXECUTE PROCEDURE set_contract_amendments_branch_id();

-- Audit: created_at/updated_at/created_by/updated_by (generic)
CREATE OR REPLACE FUNCTION set_audit_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
    NEW.updated_at := now();
    NEW.created_by := auth.uid();
    NEW.updated_by := auth.uid();
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
    NEW.updated_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Audit triggers (created_at/updated_at/created_by/updated_by)
CREATE TRIGGER organizations_set_audit BEFORE INSERT OR UPDATE ON organizations FOR EACH ROW EXECUTE PROCEDURE set_audit_columns();
CREATE TRIGGER branches_set_audit BEFORE INSERT OR UPDATE ON branches FOR EACH ROW EXECUTE PROCEDURE set_audit_columns();
CREATE TRIGGER departments_set_audit BEFORE INSERT OR UPDATE ON departments FOR EACH ROW EXECUTE PROCEDURE set_audit_columns();
CREATE TRIGGER positions_set_audit BEFORE INSERT OR UPDATE ON positions FOR EACH ROW EXECUTE PROCEDURE set_audit_columns();
CREATE TRIGGER order_registers_set_audit BEFORE INSERT OR UPDATE ON order_registers FOR EACH ROW EXECUTE PROCEDURE set_audit_columns();
CREATE TRIGGER persons_set_audit BEFORE INSERT OR UPDATE ON persons FOR EACH ROW EXECUTE PROCEDURE set_audit_columns();
CREATE TRIGGER person_documents_set_audit BEFORE INSERT OR UPDATE ON person_documents FOR EACH ROW EXECUTE PROCEDURE set_audit_columns();
CREATE TRIGGER candidates_set_audit BEFORE INSERT OR UPDATE ON candidates FOR EACH ROW EXECUTE PROCEDURE set_audit_columns();
CREATE TRIGGER orders_set_audit BEFORE INSERT OR UPDATE ON orders FOR EACH ROW EXECUTE PROCEDURE set_audit_columns();
CREATE TRIGGER order_items_set_audit BEFORE INSERT OR UPDATE ON order_items FOR EACH ROW EXECUTE PROCEDURE set_audit_columns();
CREATE TRIGGER employments_set_audit BEFORE INSERT OR UPDATE ON employments FOR EACH ROW EXECUTE PROCEDURE set_audit_columns();
CREATE TRIGGER assignments_set_audit BEFORE INSERT OR UPDATE ON assignments FOR EACH ROW EXECUTE PROCEDURE set_audit_columns();
CREATE TRIGGER absence_periods_set_audit BEFORE INSERT OR UPDATE ON absence_periods FOR EACH ROW EXECUTE PROCEDURE set_audit_columns();
CREATE TRIGGER contracts_set_audit BEFORE INSERT OR UPDATE ON contracts FOR EACH ROW EXECUTE PROCEDURE set_audit_columns();
CREATE TRIGGER contract_amendments_set_audit BEFORE INSERT OR UPDATE ON contract_amendments FOR EACH ROW EXECUTE PROCEDURE set_audit_columns();
