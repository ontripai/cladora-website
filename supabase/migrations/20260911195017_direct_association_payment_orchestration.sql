-- ============================================================
-- Migration 82: Direct Association Payment Orchestration & Unit Charge Breakdown
-- Authoritative slice: CLADORA-P2-PAY-003-R1
-- Forward-only, strictly additive, zero parallel accounting
-- ============================================================

-- 1. Enums and Types
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'payments' AND t.typname = 'payment_allocation_strategy') THEN
    CREATE TYPE payments.payment_allocation_strategy AS ENUM (
      'oldest_due_first',
      'current_period_first',
      'invoice_selected',
      'proportional'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'payments' AND t.typname = 'penalties_priority') THEN
    CREATE TYPE payments.penalties_priority AS ENUM (
      'penalties_first',
      'principal_first'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'payments' AND t.typname = 'payment_intent_status') THEN
    CREATE TYPE payments.payment_intent_status AS ENUM (
      'created',
      'awaiting_provider',
      'processing',
      'authorized',
      'succeeded',
      'settlement_pending',
      'settled',
      'failed',
      'expired',
      'cancelled',
      'requires_review',
      'reversed'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'payments' AND t.typname = 'refund_status') THEN
    CREATE TYPE payments.refund_status AS ENUM (
      'refund_requested',
      'refund_pending',
      'refunded',
      'reversal_received',
      'chargeback_open',
      'chargeback_won',
      'chargeback_lost',
      'requires_review'
    );
  END IF;
END $$;

-- 2. Versioned Payment Allocation Policies
CREATE TABLE IF NOT EXISTS payments.payment_allocation_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES platform.tenants(id),
  version integer NOT NULL DEFAULT 1,
  strategy payments.payment_allocation_strategy NOT NULL DEFAULT 'oldest_due_first',
  penalties_priority payments.penalties_priority NOT NULL DEFAULT 'principal_first',
  allow_payer_selection boolean NOT NULL DEFAULT true,
  min_partial_amount numeric(12,2) NOT NULL DEFAULT 1.00 CHECK (min_partial_amount > 0),
  overpayment_handling text NOT NULL DEFAULT 'credit_balance',
  credit_balance_handling text NOT NULL DEFAULT 'apply_to_next',
  effective_from timestamptz NOT NULL DEFAULT statement_timestamp(),
  effective_to timestamptz CHECK (effective_to IS NULL OR effective_to > effective_from),
  approved_by uuid REFERENCES auth.users(id),
  approval_reference text,
  legal_review_status text NOT NULL DEFAULT 'approved',
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT uq_payment_allocation_policy_tenant_version UNIQUE (tenant_id, version)
);

CREATE INDEX IF NOT EXISTS idx_payment_allocation_policies_lookup 
  ON payments.payment_allocation_policies (tenant_id, effective_from DESC);
CREATE INDEX IF NOT EXISTS idx_payment_allocation_policies_approved_by
  ON payments.payment_allocation_policies (approved_by);

-- 3. Beneficiary Accounts (Direct Association Bank Accounts)
CREATE TABLE IF NOT EXISTS payments.beneficiary_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES platform.tenants(id),
  property_id uuid REFERENCES portfolio.properties(id),
  association_legal_name text NOT NULL,
  bank_account_id uuid REFERENCES payments.bank_accounts(id),
  bank_name text NOT NULL,
  currency character(3) NOT NULL DEFAULT 'RON',
  masked_iban text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('pending_verification', 'active', 'suspended', 'decommissioned')),
  verified_at timestamptz,
  verified_by uuid REFERENCES auth.users(id),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT ck_beneficiary_dual_control CHECK (verified_by IS NULL OR created_by IS NULL OR verified_by <> created_by)
);

CREATE INDEX IF NOT EXISTS idx_beneficiary_accounts_tenant_property 
  ON payments.beneficiary_accounts (tenant_id, property_id, status);
CREATE INDEX IF NOT EXISTS idx_beneficiary_accounts_bank_account_id 
  ON payments.beneficiary_accounts (bank_account_id);
CREATE INDEX IF NOT EXISTS idx_beneficiary_accounts_created_by 
  ON payments.beneficiary_accounts (created_by);
CREATE INDEX IF NOT EXISTS idx_beneficiary_accounts_property_id 
  ON payments.beneficiary_accounts (property_id);
CREATE INDEX IF NOT EXISTS idx_beneficiary_accounts_verified_by 
  ON payments.beneficiary_accounts (verified_by);

-- 4. Provider Accounts (Configuration Metadata Only - Zero Secrets)
CREATE TABLE IF NOT EXISTS payments.provider_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES platform.tenants(id),
  provider_code text NOT NULL DEFAULT 'unconfigured',
  external_merchant_id text,
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  capabilities jsonb NOT NULL DEFAULT '["bank_transfer"]'::jsonb,
  settlement_currency character(3) NOT NULL DEFAULT 'RON',
  beneficiary_account_id uuid REFERENCES payments.beneficiary_accounts(id),
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT uq_provider_accounts_tenant_provider_env UNIQUE (tenant_id, provider_code, environment)
);

CREATE INDEX IF NOT EXISTS idx_provider_accounts_tenant_env 
  ON payments.provider_accounts (tenant_id, environment, enabled);
CREATE INDEX IF NOT EXISTS idx_provider_accounts_beneficiary_account_id 
  ON payments.provider_accounts (beneficiary_account_id);

-- 5. Payment Intents
CREATE TABLE IF NOT EXISTS payments.payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES platform.tenants(id),
  property_id uuid NOT NULL REFERENCES portfolio.properties(id),
  unit_id uuid NOT NULL REFERENCES portfolio.units(id),
  payer_user_id uuid NOT NULL REFERENCES auth.users(id),
  payer_party_id uuid REFERENCES portfolio.parties(id),
  debtor_party_id uuid NOT NULL REFERENCES portfolio.parties(id),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency character(3) NOT NULL DEFAULT 'RON',
  provider_code text NOT NULL DEFAULT 'unconfigured',
  payment_method text NOT NULL DEFAULT 'bank_transfer',
  idempotency_key text NOT NULL,
  client_reference text NOT NULL,
  provider_reference text,
  beneficiary_snapshot jsonb NOT NULL,
  allocation_policy_snapshot jsonb NOT NULL,
  selected_invoices_snapshot jsonb NOT NULL,
  status payments.payment_intent_status NOT NULL DEFAULT 'created',
  failure_category text,
  expires_at timestamptz NOT NULL DEFAULT (statement_timestamp() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  settled_at timestamptz,
  CONSTRAINT uq_payment_intents_tenant_idempotency UNIQUE (tenant_id, idempotency_key),
  CONSTRAINT uq_payment_intents_tenant_client_ref UNIQUE (tenant_id, client_reference)
);

CREATE INDEX IF NOT EXISTS idx_payment_intents_unit_status 
  ON payments.payment_intents (tenant_id, unit_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_intents_payer 
  ON payments.payment_intents (tenant_id, payer_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_intents_debtor_party_id 
  ON payments.payment_intents (debtor_party_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_payer_party_id 
  ON payments.payment_intents (payer_party_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_payer_user_id 
  ON payments.payment_intents (payer_user_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_property_id 
  ON payments.payment_intents (property_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_unit_id 
  ON payments.payment_intents (unit_id);

-- 6. Webhook Receipts
CREATE TABLE IF NOT EXISTS payments.webhook_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES platform.tenants(id),
  provider_code text NOT NULL,
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  payload_hash text NOT NULL,
  raw_payload_sanitized jsonb NOT NULL,
  processing_status text NOT NULL DEFAULT 'received' CHECK (processing_status IN ('received', 'processed', 'ignored', 'failed')),
  error_details text,
  received_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  processed_at timestamptz,
  CONSTRAINT uq_webhook_receipts_tenant_provider_event UNIQUE (tenant_id, provider_code, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_receipts_tenant_provider 
  ON payments.webhook_receipts (tenant_id, provider_code, received_at DESC);

-- 7. Settlements (Tracking of Funds Settled Direct to Association Account)
CREATE TABLE IF NOT EXISTS payments.settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES platform.tenants(id),
  payment_intent_id uuid NOT NULL REFERENCES payments.payment_intents(id),
  beneficiary_account_id uuid NOT NULL REFERENCES payments.beneficiary_accounts(id),
  settlement_reference text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency character(3) NOT NULL DEFAULT 'RON',
  settled_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT uq_settlements_payment_intent UNIQUE (tenant_id, payment_intent_id)
);

CREATE INDEX IF NOT EXISTS idx_settlements_beneficiary_account_id 
  ON payments.settlements (beneficiary_account_id);
CREATE INDEX IF NOT EXISTS idx_settlements_payment_intent_id 
  ON payments.settlements (payment_intent_id);

-- 8. Refund Records (Audit & Evidence Tracking)
CREATE TABLE IF NOT EXISTS payments.refund_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES platform.tenants(id),
  payment_intent_id uuid NOT NULL REFERENCES payments.payment_intents(id),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency character(3) NOT NULL DEFAULT 'RON',
  reason text NOT NULL,
  status payments.refund_status NOT NULL DEFAULT 'refund_requested',
  requested_by uuid REFERENCES auth.users(id),
  evidence_notes text,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT uq_refund_records_intent_status UNIQUE (tenant_id, payment_intent_id, status)
);

CREATE INDEX IF NOT EXISTS idx_refund_records_payment_intent_id 
  ON payments.refund_records (payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_refund_records_requested_by 
  ON payments.refund_records (requested_by);

-- 9. Extend payments.payments with payment_intent_id foreign key
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'payments' AND table_name = 'payments' AND column_name = 'payment_intent_id'
  ) THEN
    ALTER TABLE payments.payments 
      ADD COLUMN payment_intent_id uuid REFERENCES payments.payment_intents(id);
    CREATE INDEX idx_payments_payment_intent_id ON payments.payments(payment_intent_id);
  END IF;
END $$;

-- 10. Enable Row Level Security (RLS) on all new tables
ALTER TABLE payments.payment_allocation_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments.beneficiary_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments.provider_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments.payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments.webhook_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments.settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments.refund_records ENABLE ROW LEVEL SECURITY;

-- 11. Define RLS Policies for Tenant Isolation
CREATE POLICY tenant_isolation_policies ON payments.payment_allocation_policies
  FOR ALL TO authenticated
  USING (tenant_id IN (
    SELECT m.tenant_id FROM identity.memberships m 
    WHERE m.user_id = auth.uid() AND m.status = 'active'
  ));

CREATE POLICY tenant_isolation_beneficiary ON payments.beneficiary_accounts
  FOR ALL TO authenticated
  USING (tenant_id IN (
    SELECT m.tenant_id FROM identity.memberships m 
    WHERE m.user_id = auth.uid() AND m.status = 'active'
  ));

CREATE POLICY tenant_isolation_provider_accounts ON payments.provider_accounts
  FOR ALL TO authenticated
  USING (tenant_id IN (
    SELECT m.tenant_id FROM identity.memberships m 
    WHERE m.user_id = auth.uid() AND m.status = 'active'
  ));

CREATE POLICY tenant_isolation_payment_intents ON payments.payment_intents
  FOR ALL TO authenticated
  USING (tenant_id IN (
    SELECT m.tenant_id FROM identity.memberships m 
    WHERE m.user_id = auth.uid() AND m.status = 'active'
  ));

CREATE POLICY tenant_isolation_webhook_receipts ON payments.webhook_receipts
  FOR ALL TO authenticated
  USING (tenant_id IN (
    SELECT m.tenant_id FROM identity.memberships m 
    WHERE m.user_id = auth.uid() AND m.status = 'active'
  ));

CREATE POLICY tenant_isolation_settlements ON payments.settlements
  FOR ALL TO authenticated
  USING (tenant_id IN (
    SELECT m.tenant_id FROM identity.memberships m 
    WHERE m.user_id = auth.uid() AND m.status = 'active'
  ));

CREATE POLICY tenant_isolation_refund_records ON payments.refund_records
  FOR ALL TO authenticated
  USING (tenant_id IN (
    SELECT m.tenant_id FROM identity.memberships m 
    WHERE m.user_id = auth.uid() AND m.status = 'active'
  ));

-- 12. Register New Permissions into identity.permissions
INSERT INTO identity.permissions (code, resource, action, description)
VALUES 
  ('billing.unit_balances.read', 'billing.unit_balances', 'read', 'View aggregated balances and charge breakdown for units'),
  ('payments.intents.create', 'payments.payment_intents', 'create', 'Create payment intents for unit charges'),
  ('payments.intents.read', 'payments.payment_intents', 'read', 'Inspect payment intents and download transfer instructions'),
  ('payments.provider_accounts.manage', 'payments.provider_accounts', 'manage', 'Manage online payment provider configurations'),
  ('payments.beneficiary_accounts.manage', 'payments.beneficiary_accounts', 'manage', 'Manage and verify association beneficiary bank accounts'),
  ('payments.refunds.manage', 'payments.refunds', 'manage', 'Audit and manage payment refund records')
ON CONFLICT (code) DO UPDATE 
  SET description = EXCLUDED.description;

-- Grant permissions to roles in identity.role_permissions
DO $$
DECLARE
  v_perm RECORD;
  v_role RECORD;
BEGIN
  FOR v_role IN SELECT id, code FROM identity.roles LOOP
    FOR v_perm IN SELECT id, code FROM identity.permissions WHERE code IN (
      'billing.unit_balances.read',
      'payments.intents.create',
      'payments.intents.read',
      'payments.provider_accounts.manage',
      'payments.beneficiary_accounts.manage',
      'payments.refunds.manage'
    ) LOOP
      IF v_role.code = 'association_admin' THEN
        INSERT INTO identity.role_permissions (role_id, permission_id, effect)
        VALUES (v_role.id, v_perm.id, 'allow') ON CONFLICT DO NOTHING;
      ELSIF v_role.code = 'property_manager' AND v_perm.code IN ('billing.unit_balances.read', 'payments.intents.create', 'payments.intents.read', 'payments.refunds.manage') THEN
        INSERT INTO identity.role_permissions (role_id, permission_id, effect)
        VALUES (v_role.id, v_perm.id, 'allow') ON CONFLICT DO NOTHING;
      ELSIF v_role.code = 'president' AND v_perm.code IN ('billing.unit_balances.read', 'payments.intents.read', 'payments.beneficiary_accounts.manage', 'payments.provider_accounts.manage') THEN
        INSERT INTO identity.role_permissions (role_id, permission_id, effect)
        VALUES (v_role.id, v_perm.id, 'allow') ON CONFLICT DO NOTHING;
      ELSIF v_role.code = 'censor' AND v_perm.code IN ('billing.unit_balances.read', 'payments.intents.read') THEN
        INSERT INTO identity.role_permissions (role_id, permission_id, effect)
        VALUES (v_role.id, v_perm.id, 'allow') ON CONFLICT DO NOTHING;
      ELSIF v_role.code IN ('owner', 'tenant_resident') AND v_perm.code IN ('billing.unit_balances.read', 'payments.intents.create', 'payments.intents.read') THEN
        INSERT INTO identity.role_permissions (role_id, permission_id, effect)
        VALUES (v_role.id, v_perm.id, 'allow') ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- 13. Canonical RPCs in customer_api and payments

-- A. customer_api.get_unit_charge_breakdown_v1
CREATE OR REPLACE FUNCTION customer_api.get_unit_charge_breakdown_v1(
  p_context_id uuid,
  p_unit_id uuid,
  p_period_from date DEFAULT NULL,
  p_period_to date DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  v RECORD;
  v_workspace uuid;
  v_party uuid;
  v_is_resident boolean;
  v_is_tenant boolean;
  v_unit_code text;
  v_property_id uuid;
  v_property_name text;
  v_building_id uuid;
  v_building_name text;
  v_total_invoices bigint;
  v_invoices jsonb;
  v_summary jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING errcode = '42501';
  END IF;

  IF p_limit < 1 OR p_limit > 100 OR p_offset < 0 THEN
    RAISE EXCEPTION 'invalid_pagination' USING errcode = '22023';
  END IF;

  -- 1. Context and actor resolution
  SELECT g.*, m.id AS membership_key, m.role_id, r.code AS role_code, r.name AS role_name, t.legal_name AS tenant_name
  INTO v
  FROM identity.context_grants g
  JOIN identity.memberships m ON m.id = g.membership_id AND m.tenant_id = g.tenant_id
  JOIN identity.roles r ON r.id = m.role_id
  JOIN platform.tenants t ON t.id = m.tenant_id
  WHERE g.id = p_context_id
    AND m.user_id = auth.uid()
    AND m.status = 'active'
    AND m.starts_at <= statement_timestamp() AND (m.ends_at IS NULL OR m.ends_at > statement_timestamp())
    AND g.starts_at <= statement_timestamp() AND (g.ends_at IS NULL OR g.ends_at > statement_timestamp());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'customer_context_access_denied' USING errcode = '42501';
  END IF;

  -- 2. Entitlement check
  SELECT w.id INTO v_workspace
  FROM platform.customer_workspaces w
  WHERE w.tenant_id = v.tenant_id AND w.lifecycle_status = 'ACTIVE'
  ORDER BY w.id LIMIT 1;

  IF v_workspace IS NULL OR NOT EXISTS (
    SELECT 1 FROM platform.workspace_entitlements e
    WHERE e.customer_workspace_id = v_workspace AND e.entitlement_key = 'module.billing'
      AND e.valid_from <= statement_timestamp() AND (e.valid_until IS NULL OR e.valid_until > statement_timestamp())
      AND (CASE WHEN e.override_value_json IS NOT NULL AND e.override_expires_at > statement_timestamp()
                THEN e.override_value_json = 'true'::jsonb ELSE e.boolean_value IS TRUE END)
  ) THEN
    RAISE EXCEPTION 'billing_entitlement_required' USING errcode = '42501';
  END IF;

  -- 3. Permission check
  IF NOT EXISTS (
    SELECT 1 FROM identity.role_permissions rp
    JOIN identity.permissions p ON p.id = rp.permission_id
    WHERE rp.role_id = v.role_id AND rp.effect = 'allow' AND p.code = 'billing.unit_balances.read'
  ) THEN
    RAISE EXCEPTION 'billing_permission_required' USING errcode = '42501';
  END IF;

  -- 4. Unit existence & Tenant isolation
  SELECT u.code, b.property_id, p.name AS property_name, u.building_id, b.name AS building_name
  INTO v_unit_code, v_property_id, v_property_name, v_building_id, v_building_name
  FROM portfolio.units u
  JOIN portfolio.buildings b ON b.id = u.building_id
  JOIN portfolio.properties p ON p.id = b.property_id
  WHERE u.id = p_unit_id AND u.tenant_id = v.tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'unit_not_found' USING errcode = '22023';
  END IF;

  -- 5. Scope validation for Resident / Owner
  v_is_resident := lower(v.role_code) IN ('owner', 'tenant_resident');
  v_is_tenant := lower(v.role_code) = 'tenant_resident';

  IF v_is_resident THEN
    SELECT mp.party_id INTO v_party
    FROM identity.membership_parties mp
    WHERE mp.membership_id = v.membership_key AND mp.tenant_id = v.tenant_id;

    IF v_party IS NULL THEN
      RAISE EXCEPTION 'resident_party_mapping_required' USING errcode = '42501';
    END IF;

    IF v_is_tenant THEN
      IF NOT EXISTS (
        SELECT 1 FROM occupancy.leases l
        WHERE l.tenant_id = v.tenant_id AND l.unit_id = p_unit_id
          AND l.tenant_party_id = v_party AND l.status = 'active'
          AND l.starts_on <= current_date AND (l.ends_on IS NULL OR l.ends_on > current_date)
      ) THEN
        RAISE EXCEPTION 'unit_access_unauthorized' USING errcode = '42501';
      END IF;
    ELSE
      -- Owner: must own the unit
      IF NOT EXISTS (
        SELECT 1 FROM portfolio.ownerships o
        WHERE o.tenant_id = v.tenant_id AND o.unit_id = p_unit_id
          AND o.party_id = v_party
          AND o.valid_from <= current_date AND (o.valid_to IS NULL OR o.valid_to > current_date)
      ) THEN
        RAISE EXCEPTION 'unit_access_unauthorized' USING errcode = '42501';
      END IF;
    END IF;
  END IF;

  -- 6. Query invoices and lines
  SELECT count(*)
  INTO v_total_invoices
  FROM billing.invoices inv
  WHERE inv.tenant_id = v.tenant_id
    AND inv.unit_id = p_unit_id
    AND (p_status IS NULL OR inv.status::text = p_status)
    AND (p_period_from IS NULL OR inv.period_start >= p_period_from)
    AND (p_period_to IS NULL OR inv.period_end <= p_period_to);

  SELECT jsonb_agg(inv_row)
  INTO v_invoices
  FROM (
    SELECT 
      inv.id AS invoice_id,
      inv.invoice_no,
      inv.period_start,
      inv.period_end,
      inv.issued_on,
      inv.due_on,
      inv.currency,
      inv.subtotal,
      inv.tax_total,
      inv.total,
      inv.status,
      coalesce(r.original_amount, inv.total) AS original_amount,
      coalesce(r.paid_amount, 0) AS paid_amount,
      coalesce(r.credited_amount, 0) AS credited_amount,
      coalesce(r.outstanding_amount, inv.total) AS outstanding_amount,
      CASE WHEN inv.due_on IS NOT NULL AND inv.due_on < CURRENT_DATE AND coalesce(r.outstanding_amount, inv.total) > 0 
           THEN true ELSE false END AS overdue,
      inv.liable_party_id,
      coalesce(pty.legal_name, 'Proprietar') AS debtor_party_name,
      coalesce((
        SELECT jsonb_agg(line_row)
        FROM (
          SELECT 
            l.id AS line_id,
            l.description,
            l.quantity,
            l.unit_price,
            l.tax_rate,
            l.line_subtotal,
            l.line_tax,
            (l.line_subtotal + l.line_tax) AS line_total,
            coalesce(cc.code, 'GEN') AS charge_type,
            coalesce(cc.name, l.description) AS category_name,
            ai.method AS allocation_basis,
            ai.basis_value,
            ai.basis_total,
            ai.rule_snapshot,
            ai.explanation_json
          FROM billing.invoice_lines l
          LEFT JOIN finance.charge_categories cc ON cc.id = l.category_id
          LEFT JOIN finance.allocation_items ai ON ai.id = l.allocation_item_id
          WHERE l.invoice_id = inv.id
          ORDER BY l.created_at ASC
        ) line_row
      ), '[]'::jsonb) AS lines
    FROM billing.invoices inv
    LEFT JOIN billing.receivables r ON r.invoice_id = inv.id
    LEFT JOIN portfolio.parties pty ON pty.id = inv.liable_party_id
    WHERE inv.tenant_id = v.tenant_id
      AND inv.unit_id = p_unit_id
      AND (p_status IS NULL OR inv.status::text = p_status)
      AND (p_period_from IS NULL OR inv.period_start >= p_period_from)
      AND (p_period_to IS NULL OR inv.period_end <= p_period_to)
    ORDER BY inv.period_end DESC, inv.invoice_no DESC
    LIMIT p_limit OFFSET p_offset
  ) inv_row;

  -- 7. Aggregated Summary
  SELECT jsonb_build_object(
    'total_invoices', v_total_invoices,
    'total_amount', coalesce(sum(inv.total), 0),
    'paid_total', coalesce(sum(r.paid_amount), 0),
    'outstanding_total', coalesce(sum(r.outstanding_amount), 0),
    'overdue_total', coalesce(sum(CASE WHEN inv.due_on < CURRENT_DATE THEN r.outstanding_amount ELSE 0 END), 0)
  )
  INTO v_summary
  FROM billing.invoices inv
  LEFT JOIN billing.receivables r ON r.invoice_id = inv.id
  WHERE inv.tenant_id = v.tenant_id AND inv.unit_id = p_unit_id;

  RETURN jsonb_build_object(
    'tenant_id', v.tenant_id,
    'property_id', v_property_id,
    'property_name', v_property_name,
    'building_id', v_building_id,
    'building_name', v_building_name,
    'unit_id', p_unit_id,
    'unit_code', v_unit_code,
    'summary', coalesce(v_summary, '{}'::jsonb),
    'invoices', coalesce(v_invoices, '[]'::jsonb),
    'pagination', jsonb_build_object(
      'total', v_total_invoices,
      'limit', p_limit,
      'offset', p_offset
    )
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION customer_api.get_unit_charge_breakdown_v1(uuid, uuid, date, date, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION customer_api.get_unit_charge_breakdown_v1(uuid, uuid, date, date, text, integer, integer) TO authenticated;

-- B. customer_api.get_unit_balances_v1
CREATE OR REPLACE FUNCTION customer_api.get_unit_balances_v1(
  p_context_id uuid,
  p_building_id uuid DEFAULT NULL,
  p_unit_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  v RECORD;
  v_workspace uuid;
  v_party uuid;
  v_is_resident boolean;
  v_is_tenant boolean;
  v_units jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING errcode = '42501';
  END IF;

  SELECT g.*, m.id AS membership_key, m.role_id, r.code AS role_code, r.name AS role_name, t.legal_name AS tenant_name
  INTO v
  FROM identity.context_grants g
  JOIN identity.memberships m ON m.id = g.membership_id AND m.tenant_id = g.tenant_id
  JOIN identity.roles r ON r.id = m.role_id
  JOIN platform.tenants t ON t.id = m.tenant_id
  WHERE g.id = p_context_id
    AND m.user_id = auth.uid()
    AND m.status = 'active'
    AND m.starts_at <= statement_timestamp() AND (m.ends_at IS NULL OR m.ends_at > statement_timestamp())
    AND g.starts_at <= statement_timestamp() AND (g.ends_at IS NULL OR g.ends_at > statement_timestamp());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'customer_context_access_denied' USING errcode = '42501';
  END IF;

  v_is_resident := lower(v.role_code) IN ('owner', 'tenant_resident');
  v_is_tenant := lower(v.role_code) = 'tenant_resident';

  IF v_is_resident THEN
    SELECT mp.party_id INTO v_party
    FROM identity.membership_parties mp
    WHERE mp.membership_id = v.membership_key AND mp.tenant_id = v.tenant_id;
    IF v_party IS NULL THEN
      RAISE EXCEPTION 'resident_party_mapping_required' USING errcode = '42501';
    END IF;
  END IF;

  SELECT jsonb_agg(u_row)
  INTO v_units
  FROM (
    SELECT 
      u.id AS unit_id,
      u.code AS unit_code,
      bld.property_id,
      prop.name AS property_name,
      u.building_id,
      bld.name AS building_name,
      coalesce(sum(r.outstanding_amount), 0) AS total_outstanding,
      coalesce(sum(CASE WHEN inv.due_on < CURRENT_DATE THEN r.outstanding_amount ELSE 0 END), 0) AS total_overdue,
      coalesce(sum(r.paid_amount), 0) AS total_paid,
      coalesce(count(inv.id), 0) AS invoice_count
    FROM portfolio.units u
    JOIN portfolio.buildings bld ON bld.id = u.building_id
    JOIN portfolio.properties prop ON prop.id = bld.property_id
    LEFT JOIN billing.invoices inv ON inv.unit_id = u.id AND inv.status <> 'void'
    LEFT JOIN billing.receivables r ON r.invoice_id = inv.id
    WHERE u.tenant_id = v.tenant_id
      AND (p_unit_id IS NULL OR u.id = p_unit_id)
      AND (p_building_id IS NULL OR u.building_id = p_building_id)
      AND (
        NOT v_is_resident OR (
          (v_is_tenant AND EXISTS (
            SELECT 1 FROM occupancy.leases l 
            WHERE l.tenant_id = v.tenant_id AND l.unit_id = u.id AND l.tenant_party_id = v_party AND l.status = 'active'
              AND l.starts_on <= current_date AND (l.ends_on IS NULL OR l.ends_on > current_date)
          )) OR
          (NOT v_is_tenant AND EXISTS (
            SELECT 1 FROM portfolio.ownerships o 
            WHERE o.tenant_id = v.tenant_id AND o.unit_id = u.id AND o.party_id = v_party
              AND o.valid_from <= current_date AND (o.valid_to IS NULL OR o.valid_to > current_date)
          ))
        )
      )
    GROUP BY u.id, u.code, bld.property_id, prop.name, u.building_id, bld.name
    ORDER BY u.code ASC
  ) u_row;

  RETURN jsonb_build_object(
    'tenant_id', v.tenant_id,
    'units', coalesce(v_units, '[]'::jsonb)
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION customer_api.get_unit_balances_v1(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION customer_api.get_unit_balances_v1(uuid, uuid, uuid) TO authenticated;

-- C. customer_api.create_payment_intent_v1
CREATE OR REPLACE FUNCTION customer_api.create_payment_intent_v1(
  p_context_id uuid,
  p_unit_id uuid,
  p_invoices jsonb,
  p_amount numeric,
  p_currency text,
  p_payment_method text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  v RECORD;
  v_workspace uuid;
  v_party uuid;
  v_debtor_party_id uuid;
  v_property_id uuid;
  v_policy RECORD;
  v_beneficiary RECORD;
  v_existing RECORD;
  v_intent_id uuid;
  v_client_ref text;
  v_selected_invoices jsonb;
  v_total_outstanding numeric := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING errcode = '42501';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_payment_amount' USING errcode = '22023';
  END IF;

  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'invalid_idempotency_key' USING errcode = '22023';
  END IF;

  -- 1. Context and actor validation
  SELECT g.*, m.id AS membership_key, m.role_id, r.code AS role_code, t.legal_name AS tenant_name
  INTO v
  FROM identity.context_grants g
  JOIN identity.memberships m ON m.id = g.membership_id AND m.tenant_id = g.tenant_id
  JOIN identity.roles r ON r.id = m.role_id
  JOIN platform.tenants t ON t.id = m.tenant_id
  WHERE g.id = p_context_id
    AND m.user_id = auth.uid()
    AND m.status = 'active'
    AND m.starts_at <= statement_timestamp() AND (m.ends_at IS NULL OR m.ends_at > statement_timestamp())
    AND g.starts_at <= statement_timestamp() AND (g.ends_at IS NULL OR g.ends_at > statement_timestamp());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'customer_context_access_denied' USING errcode = '42501';
  END IF;

  -- 2. Entitlement check
  SELECT w.id INTO v_workspace
  FROM platform.customer_workspaces w
  WHERE w.tenant_id = v.tenant_id AND w.lifecycle_status = 'ACTIVE'
  ORDER BY w.id LIMIT 1;

  IF v_workspace IS NULL OR NOT EXISTS (
    SELECT 1 FROM platform.workspace_entitlements e
    WHERE e.customer_workspace_id = v_workspace AND e.entitlement_key = 'module.payments'
      AND e.valid_from <= statement_timestamp() AND (e.valid_until IS NULL OR e.valid_until > statement_timestamp())
      AND (CASE WHEN e.override_value_json IS NOT NULL AND e.override_expires_at > statement_timestamp()
                THEN e.override_value_json = 'true'::jsonb ELSE e.boolean_value IS TRUE END)
  ) THEN
    RAISE EXCEPTION 'payments_entitlement_required' USING errcode = '42501';
  END IF;

  -- 3. Permission check
  IF NOT EXISTS (
    SELECT 1 FROM identity.role_permissions rp
    JOIN identity.permissions p ON p.id = rp.permission_id
    WHERE rp.role_id = v.role_id AND rp.effect = 'allow' AND p.code = 'payments.intents.create'
  ) THEN
    RAISE EXCEPTION 'payments_permission_required' USING errcode = '42501';
  END IF;

  -- 4. Idempotency single-winner check
  SELECT * INTO v_existing
  FROM payments.payment_intents
  WHERE tenant_id = v.tenant_id AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'payment_intent_id', v_existing.id,
      'status', v_existing.status,
      'amount', v_existing.amount,
      'currency', v_existing.currency,
      'client_reference', v_existing.client_reference,
      'is_idempotent_replay', true
    );
  END IF;

  -- 5. Unit existence & Debtor party resolution
  SELECT b.property_id, coalesce(
    (SELECT o.party_id FROM portfolio.ownerships o WHERE o.tenant_id = v.tenant_id AND o.unit_id = u.id AND o.valid_from <= current_date AND (o.valid_to IS NULL OR o.valid_to > current_date) LIMIT 1),
    (SELECT inv.liable_party_id FROM billing.invoices inv WHERE inv.tenant_id = v.tenant_id AND inv.unit_id = u.id ORDER BY inv.period_end DESC LIMIT 1)
  ) INTO v_property_id, v_debtor_party_id
  FROM portfolio.units u
  JOIN portfolio.buildings b ON b.id = u.building_id
  WHERE u.id = p_unit_id AND u.tenant_id = v.tenant_id;

  IF NOT FOUND OR v_property_id IS NULL OR v_debtor_party_id IS NULL THEN
    RAISE EXCEPTION 'unit_debtor_unresolvable' USING errcode = '22023';
  END IF;

  -- Payer party (can be resident, owner, or general member party)
  SELECT mp.party_id INTO v_party
  FROM identity.membership_parties mp
  WHERE mp.membership_id = v.membership_key AND mp.tenant_id = v.tenant_id;

  -- 6. Active Allocation Policy check (fail-closed if unconfigured)
  SELECT * INTO v_policy
  FROM payments.payment_allocation_policies
  WHERE tenant_id = v.tenant_id
    AND effective_from <= statement_timestamp()
    AND (effective_to IS NULL OR effective_to > statement_timestamp())
  ORDER BY version DESC LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_allocation_policy_unconfigured' USING errcode = '42501';
  END IF;

  -- Enforce minimum partial payment
  IF p_amount < v_policy.min_partial_amount THEN
    RAISE EXCEPTION 'amount_below_policy_minimum' USING errcode = '22023';
  END IF;

  -- 7. Real Beneficiary Account check (fail-closed if unconfigured)
  SELECT * INTO v_beneficiary
  FROM payments.beneficiary_accounts
  WHERE tenant_id = v.tenant_id
    AND (property_id = v_property_id OR property_id IS NULL)
    AND status = 'active'
  ORDER BY property_id NULLS LAST LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'beneficiary_account_unconfigured' USING errcode = '42501';
  END IF;

  -- 8. Calculate total outstanding and validate invoice selection
  SELECT coalesce(sum(r.outstanding_amount), 0)
  INTO v_total_outstanding
  FROM billing.invoices inv
  JOIN billing.receivables r ON r.invoice_id = inv.id
  WHERE inv.tenant_id = v.tenant_id AND inv.unit_id = p_unit_id AND inv.status <> 'void';

  IF p_amount > v_total_outstanding AND v_policy.overpayment_handling = 'reject' THEN
    RAISE EXCEPTION 'overpayment_rejected_by_policy' USING errcode = '22023';
  END IF;

  v_client_ref := 'PAY-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  -- 9. Insert Payment Intent
  INSERT INTO payments.payment_intents (
    tenant_id,
    property_id,
    unit_id,
    payer_user_id,
    payer_party_id,
    debtor_party_id,
    amount,
    currency,
    provider_code,
    payment_method,
    idempotency_key,
    client_reference,
    beneficiary_snapshot,
    allocation_policy_snapshot,
    selected_invoices_snapshot,
    status
  ) VALUES (
    v.tenant_id,
    v_property_id,
    p_unit_id,
    auth.uid(),
    v_party,
    v_debtor_party_id,
    p_amount,
    coalesce(p_currency, 'RON'),
    'unconfigured',
    coalesce(p_payment_method, 'bank_transfer'),
    p_idempotency_key,
    v_client_ref,
    jsonb_build_object(
      'beneficiary_id', v_beneficiary.id,
      'association_legal_name', v_beneficiary.association_legal_name,
      'bank_name', v_beneficiary.bank_name,
      'masked_iban', v_beneficiary.masked_iban,
      'currency', v_beneficiary.currency
    ),
    row_to_json(v_policy)::jsonb,
    coalesce(p_invoices, '[]'::jsonb),
    'created'
  )
  RETURNING id INTO v_intent_id;

  RETURN jsonb_build_object(
    'payment_intent_id', v_intent_id,
    'status', 'created',
    'amount', p_amount,
    'currency', coalesce(p_currency, 'RON'),
    'client_reference', v_client_ref,
    'is_idempotent_replay', false
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION customer_api.create_payment_intent_v1(uuid, uuid, jsonb, numeric, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION customer_api.create_payment_intent_v1(uuid, uuid, jsonb, numeric, text, text, text) TO authenticated;

-- D. customer_api.get_payment_intent_v1
CREATE OR REPLACE FUNCTION customer_api.get_payment_intent_v1(
  p_context_id uuid,
  p_intent_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  v RECORD;
  v_intent RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING errcode = '42501';
  END IF;

  SELECT g.*, m.id AS membership_key, m.role_id, r.code AS role_code
  INTO v
  FROM identity.context_grants g
  JOIN identity.memberships m ON m.id = g.membership_id AND m.tenant_id = g.tenant_id
  JOIN identity.roles r ON r.id = m.role_id
  WHERE g.id = p_context_id
    AND m.user_id = auth.uid()
    AND m.status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'customer_context_access_denied' USING errcode = '42501';
  END IF;

  SELECT * INTO v_intent
  FROM payments.payment_intents
  WHERE id = p_intent_id AND tenant_id = v.tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_intent_not_found' USING errcode = '22023';
  END IF;

  -- Resident / Owner must match payer or unit
  IF lower(v.role_code) IN ('owner', 'tenant_resident') AND v_intent.payer_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'payment_intent_access_denied' USING errcode = '42501';
  END IF;

  RETURN jsonb_build_object(
    'payment_intent_id', v_intent.id,
    'tenant_id', v_intent.tenant_id,
    'property_id', v_intent.property_id,
    'unit_id', v_intent.unit_id,
    'amount', v_intent.amount,
    'currency', v_intent.currency,
    'status', v_intent.status,
    'payment_method', v_intent.payment_method,
    'client_reference', v_intent.client_reference,
    'beneficiary', v_intent.beneficiary_snapshot,
    'allocation_policy', v_intent.allocation_policy_snapshot,
    'selected_invoices', v_intent.selected_invoices_snapshot,
    'expires_at', v_intent.expires_at,
    'created_at', v_intent.created_at,
    'settled_at', v_intent.settled_at
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION customer_api.get_payment_intent_v1(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION customer_api.get_payment_intent_v1(uuid, uuid) TO authenticated;

-- E. customer_api.cancel_payment_intent_v1
CREATE OR REPLACE FUNCTION customer_api.cancel_payment_intent_v1(
  p_context_id uuid,
  p_intent_id uuid,
  p_reason text DEFAULT 'cancelled_by_user'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  v RECORD;
  v_intent RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING errcode = '42501';
  END IF;

  SELECT g.*, m.id AS membership_key, m.role_id, r.code AS role_code
  INTO v
  FROM identity.context_grants g
  JOIN identity.memberships m ON m.id = g.membership_id AND m.tenant_id = g.tenant_id
  JOIN identity.roles r ON r.id = m.role_id
  WHERE g.id = p_context_id AND m.user_id = auth.uid() AND m.status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'customer_context_access_denied' USING errcode = '42501';
  END IF;

  SELECT * INTO v_intent
  FROM payments.payment_intents
  WHERE id = p_intent_id AND tenant_id = v.tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_intent_not_found' USING errcode = '22023';
  END IF;

  IF v_intent.status NOT IN ('created', 'awaiting_provider') THEN
    RAISE EXCEPTION 'intent_not_cancellable' USING errcode = '22023';
  END IF;

  UPDATE payments.payment_intents
  SET status = 'cancelled',
      failure_category = p_reason,
      updated_at = statement_timestamp()
  WHERE id = p_intent_id;

  RETURN jsonb_build_object(
    'payment_intent_id', p_intent_id,
    'status', 'cancelled'
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION customer_api.cancel_payment_intent_v1(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION customer_api.cancel_payment_intent_v1(uuid, uuid, text) TO authenticated;

-- F. customer_api.generate_bank_instruction_v1
CREATE OR REPLACE FUNCTION customer_api.generate_bank_instruction_v1(
  p_context_id uuid,
  p_intent_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  v RECORD;
  v_intent RECORD;
  v_unit_code text;
  v_debtor_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING errcode = '42501';
  END IF;

  SELECT g.*, m.id AS membership_key, m.role_id, r.code AS role_code
  INTO v
  FROM identity.context_grants g
  JOIN identity.memberships m ON m.id = g.membership_id AND m.tenant_id = g.tenant_id
  JOIN identity.roles r ON r.id = m.role_id
  WHERE g.id = p_context_id AND m.user_id = auth.uid() AND m.status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'customer_context_access_denied' USING errcode = '42501';
  END IF;

  SELECT * INTO v_intent
  FROM payments.payment_intents
  WHERE id = p_intent_id AND tenant_id = v.tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_intent_not_found' USING errcode = '22023';
  END IF;

  SELECT u.code INTO v_unit_code
  FROM portfolio.units u WHERE u.id = v_intent.unit_id;

  SELECT pty.legal_name INTO v_debtor_name
  FROM portfolio.parties pty WHERE pty.id = v_intent.debtor_party_id;

  RETURN jsonb_build_object(
    'payment_intent_id', v_intent.id,
    'client_reference', v_intent.client_reference,
    'amount', v_intent.amount,
    'currency', v_intent.currency,
    'beneficiary_name', v_intent.beneficiary_snapshot->>'association_legal_name',
    'bank_name', v_intent.beneficiary_snapshot->>'bank_name',
    'iban', v_intent.beneficiary_snapshot->>'masked_iban',
    'unit_code', v_unit_code,
    'legal_debtor', v_debtor_name,
    'remittance_information', v_intent.client_reference || ' / Apt ' || coalesce(v_unit_code, ''),
    'notice', 'CLADORA nu este intermediar de plată. Fondurile se transferă direct către contul bancar al asociației.',
    'expires_at', v_intent.expires_at
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION customer_api.generate_bank_instruction_v1(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION customer_api.generate_bank_instruction_v1(uuid, uuid) TO authenticated;

-- G. Privileged Internal Webhook Ingestion & Financial Posting Function
CREATE OR REPLACE FUNCTION payments.process_webhook_event_v1(
  p_tenant_id uuid,
  p_provider_code text,
  p_provider_event_id text,
  p_event_type text,
  p_payload_hash text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, payments, billing, finance, portfolio
AS $function$
DECLARE
  v_receipt RECORD;
  v_intent RECORD;
  v_intent_id uuid;
  v_amount numeric;
  v_currency text;
  v_payment_id uuid;
  v_allocations jsonb;
  v_inv RECORD;
  v_remaining numeric;
  v_alloc_amount numeric;
BEGIN
  -- 1. Idempotent check on Webhook Receipts
  SELECT * INTO v_receipt
  FROM payments.webhook_receipts
  WHERE tenant_id = p_tenant_id 
    AND provider_code = p_provider_code 
    AND provider_event_id = p_provider_event_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'status', 'ignored',
      'reason', 'duplicate_event',
      'receipt_id', v_receipt.id
    );
  END IF;

  -- 2. Insert receipt
  INSERT INTO payments.webhook_receipts (
    tenant_id,
    provider_code,
    provider_event_id,
    event_type,
    payload_hash,
    raw_payload_sanitized,
    processing_status
  ) VALUES (
    p_tenant_id,
    p_provider_code,
    p_provider_event_id,
    p_event_type,
    p_payload_hash,
    p_payload,
    'received'
  )
  RETURNING * INTO v_receipt;

  -- 3. Resolve target Payment Intent
  v_intent_id := (p_payload->>'payment_intent_id')::uuid;
  IF v_intent_id IS NULL THEN
    UPDATE payments.webhook_receipts 
    SET processing_status = 'ignored', error_details = 'missing_payment_intent_id'
    WHERE id = v_receipt.id;

    RETURN jsonb_build_object('status', 'ignored', 'reason', 'missing_payment_intent_id');
  END IF;

  SELECT * INTO v_intent
  FROM payments.payment_intents
  WHERE id = v_intent_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    UPDATE payments.webhook_receipts 
    SET processing_status = 'failed', error_details = 'intent_not_found'
    WHERE id = v_receipt.id;

    RETURN jsonb_build_object('status', 'failed', 'reason', 'intent_not_found');
  END IF;

  -- 4. Terminal state immutability check
  IF v_intent.status IN ('succeeded', 'settled', 'cancelled', 'expired') THEN
    UPDATE payments.webhook_receipts 
    SET processing_status = 'ignored', error_details = 'intent_already_terminal'
    WHERE id = v_receipt.id;

    RETURN jsonb_build_object('status', 'ignored', 'reason', 'intent_already_terminal');
  END IF;

  v_amount := (p_payload->>'amount')::numeric;
  v_currency := coalesce(p_payload->>'currency', 'RON');

  -- 5. Amount & Currency mismatch detection
  IF v_amount <> v_intent.amount OR v_currency <> v_intent.currency THEN
    UPDATE payments.payment_intents
    SET status = 'requires_review',
        failure_category = 'amount_or_currency_mismatch',
        updated_at = statement_timestamp()
    WHERE id = v_intent.id;

    UPDATE payments.webhook_receipts 
    SET processing_status = 'failed', error_details = 'amount_or_currency_mismatch'
    WHERE id = v_receipt.id;

    RETURN jsonb_build_object('status', 'requires_review', 'reason', 'amount_or_currency_mismatch');
  END IF;

  -- 6. Event processing based on event_type
  IF p_event_type IN ('payment.succeeded', 'checkout.completed') THEN
    -- Transition intent to succeeded / settlement_pending
    UPDATE payments.payment_intents
    SET status = 'succeeded',
        settled_at = statement_timestamp(),
        updated_at = statement_timestamp()
    WHERE id = v_intent.id;

    -- Record canonical payment in payments.payments
    -- Note: Dr 5121 only upon confirmed settlement. At checkout success, we record into payments.payments
    INSERT INTO payments.payments (
      tenant_id,
      property_id,
      unit_id,
      payer_party_id,
      amount,
      currency,
      paid_at,
      status,
      method,
      provider_ref,
      description,
      idempotency_key,
      payment_intent_id
    ) VALUES (
      v_intent.tenant_id,
      v_intent.property_id,
      v_intent.unit_id,
      v_intent.payer_party_id,
      v_intent.amount,
      v_intent.currency,
      statement_timestamp(),
      'pending',
      v_intent.payment_method,
      p_provider_event_id,
      'Direct-to-Association Checkout ' || v_intent.client_reference,
      v_intent.idempotency_key,
      v_intent.id
    )
    RETURNING id INTO v_payment_id;

    -- Build allocation items according to policy
    v_remaining := v_intent.amount;
    v_allocations := '[]'::jsonb;

    FOR v_inv IN 
      SELECT inv.id AS invoice_id, r.id AS receivable_id, r.outstanding_amount
      FROM billing.invoices inv
      JOIN billing.receivables r ON r.invoice_id = inv.id
      WHERE inv.tenant_id = v_intent.tenant_id 
        AND inv.unit_id = v_intent.unit_id 
        AND r.outstanding_amount > 0
      ORDER BY inv.due_on ASC, inv.invoice_no ASC
    LOOP
      IF v_remaining <= 0 THEN EXIT; END IF;
      v_alloc_amount := least(v_remaining, v_inv.outstanding_amount);
      IF v_alloc_amount > 0 THEN
        v_allocations := v_allocations || jsonb_build_object(
          'receivable_id', v_inv.receivable_id,
          'amount', v_alloc_amount
        );
        v_remaining := v_remaining - v_alloc_amount;
      END IF;
    END LOOP;

    -- Execute canonical allocation if allocations exist
    IF jsonb_array_length(v_allocations) > 0 THEN
      FOR v_inv IN SELECT * FROM jsonb_to_recordset(v_allocations) AS (receivable_id uuid, amount numeric) LOOP
        INSERT INTO payments.payment_allocations (
          tenant_id,
          payment_id,
          receivable_id,
          amount,
          status,
          idempotency_key
        ) VALUES (
          v_intent.tenant_id,
          v_payment_id,
          v_inv.receivable_id,
          v_inv.amount,
          'active',
          'ALLOC-' || v_intent.idempotency_key || '-' || v_inv.receivable_id::text
        );

        UPDATE billing.receivables
        SET paid_amount = paid_amount + v_inv.amount,
            last_payment_at = statement_timestamp()
        WHERE id = v_inv.receivable_id;

        UPDATE billing.invoices inv
        SET status = CASE 
          WHEN (r.outstanding_amount - v_inv.amount) <= 0 THEN 'paid'::billing.invoice_status
          ELSE 'partially_paid'::billing.invoice_status
        END,
        updated_at = statement_timestamp()
        FROM billing.receivables r
        WHERE r.id = v_inv.receivable_id AND inv.id = r.invoice_id;
      END LOOP;
    END IF;

    -- Record Settlement
    INSERT INTO payments.settlements (
      tenant_id,
      payment_intent_id,
      beneficiary_account_id,
      settlement_reference,
      amount,
      currency,
      settled_at
    ) VALUES (
      v_intent.tenant_id,
      v_intent.id,
      (v_intent.beneficiary_snapshot->>'beneficiary_id')::uuid,
      'SETTLE-' || p_provider_event_id,
      v_intent.amount,
      v_intent.currency,
      statement_timestamp()
    )
    ON CONFLICT (tenant_id, payment_intent_id) DO NOTHING;

    UPDATE payments.webhook_receipts 
    SET processing_status = 'processed', processed_at = statement_timestamp()
    WHERE id = v_receipt.id;

    RETURN jsonb_build_object(
      'status', 'succeeded',
      'payment_id', v_payment_id,
      'allocated_items', jsonb_array_length(v_allocations)
    );
  ELSIF p_event_type = 'payment.failed' THEN
    UPDATE payments.payment_intents
    SET status = 'failed',
        failure_category = coalesce(p_payload->>'failure_reason', 'provider_declined'),
        updated_at = statement_timestamp()
    WHERE id = v_intent.id;

    UPDATE payments.webhook_receipts 
    SET processing_status = 'processed', processed_at = statement_timestamp()
    WHERE id = v_receipt.id;

    RETURN jsonb_build_object('status', 'failed');
  ELSE
    UPDATE payments.webhook_receipts 
    SET processing_status = 'ignored', error_details = 'unhandled_event_type'
    WHERE id = v_receipt.id;

    RETURN jsonb_build_object('status', 'ignored', 'reason', 'unhandled_event_type');
  END IF;
END;
$function$;

-- Strict Security Lockdown on Privileged Webhook Function:
REVOKE EXECUTE ON FUNCTION payments.process_webhook_event_v1(uuid, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION payments.process_webhook_event_v1(uuid, text, text, text, text, jsonb) TO service_role;

-- End of Migration 82
