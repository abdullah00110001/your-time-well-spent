-- =============================================
-- LIFE-SCALE SAAS ADMIN PANEL DATABASE SCHEMA
-- =============================================

-- 1. Admin Roles & Permissions
CREATE TYPE admin_role_type AS ENUM ('super_admin', 'finance_admin', 'support_admin', 'policy_admin', 'analyst', 'auditor');

CREATE TABLE admin_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    role admin_role_type NOT NULL DEFAULT 'auditor',
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID
);

ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage admin roles"
ON admin_roles FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- 2. Feature Flags & Module Control
CREATE TABLE feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_enabled BOOLEAN DEFAULT true,
    enabled_for_plans TEXT[] DEFAULT '{}',
    enabled_for_regions TEXT[] DEFAULT '{}',
    enabled_for_device_brands TEXT[] DEFAULT '{}',
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage feature flags"
ON feature_flags FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view enabled features"
ON feature_flags FOR SELECT USING (is_enabled = true);

-- 3. Alarm System Configuration
CREATE TABLE alarm_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key TEXT UNIQUE NOT NULL,
    strictness_level INTEGER DEFAULT 5,
    dismiss_protection JSONB DEFAULT '{"require_action": true, "min_awake_time_seconds": 30}',
    snooze_limits JSONB DEFAULT '{"max_snoozes": 3, "snooze_interval_minutes": 5}',
    group_enforcement JSONB DEFAULT '{"peer_wake_enabled": true, "escalation_delay_minutes": 5}',
    oem_overrides JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE alarm_configurations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage alarm configs" ON alarm_configurations FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view alarm configs" ON alarm_configurations FOR SELECT USING (true);

-- 4. Shield System Configuration
CREATE TABLE shield_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key TEXT UNIQUE NOT NULL,
    blocking_rules JSONB DEFAULT '{}',
    time_locks JSONB DEFAULT '{}',
    emergency_bypass_limits INTEGER DEFAULT 3,
    cooldown_penalty_minutes INTEGER DEFAULT 30,
    relapse_escalation JSONB DEFAULT '{"threshold": 3, "penalty_multiplier": 1.5}',
    strength_by_plan JSONB DEFAULT '{"free": 1, "premium": 3, "ultimate": 5}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE shield_configurations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage shield configs" ON shield_configurations FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view shield configs" ON shield_configurations FOR SELECT USING (true);

-- 5. Behavior Rule Engine
CREATE TABLE behavior_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    trigger_conditions JSONB NOT NULL,
    actions JSONB NOT NULL,
    time_decay JSONB DEFAULT '{}',
    escalation_config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID
);

ALTER TABLE behavior_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage behavior rules" ON behavior_rules FOR ALL USING (has_role(auth.uid(), 'admin'));

-- 6. AI Control Settings
CREATE TABLE ai_control_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT UNIQUE NOT NULL,
    nudging_intensity INTEGER DEFAULT 5,
    is_paused BOOLEAN DEFAULT false,
    override_rules JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ai_control_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage AI settings" ON ai_control_settings FOR ALL USING (has_role(auth.uid(), 'admin'));

-- 7. Subscription Plans
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    tier TEXT NOT NULL,
    price_monthly DECIMAL(10,2),
    price_yearly DECIMAL(10,2),
    price_lifetime DECIMAL(10,2),
    features JSONB DEFAULT '[]',
    region_pricing JSONB DEFAULT '{}',
    play_store_product_id TEXT,
    stripe_price_id TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active plans" ON subscription_plans FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage plans" ON subscription_plans FOR ALL USING (has_role(auth.uid(), 'admin'));

-- 8. User Subscriptions / Entitlements
CREATE TABLE user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    plan_id UUID REFERENCES subscription_plans(id),
    status TEXT DEFAULT 'active',
    platform TEXT,
    purchase_token TEXT,
    starts_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ,
    is_trial BOOLEAN DEFAULT false,
    trial_ends_at TIMESTAMPTZ,
    grace_period_ends_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subscriptions" ON user_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage subscriptions" ON user_subscriptions FOR ALL USING (has_role(auth.uid(), 'admin'));

-- 9. Coupons & Discounts
CREATE TABLE coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    discount_type TEXT DEFAULT 'percentage',
    discount_value DECIMAL(10,2) NOT NULL,
    max_uses INTEGER,
    uses_count INTEGER DEFAULT 0,
    valid_from TIMESTAMPTZ DEFAULT now(),
    valid_until TIMESTAMPTZ,
    applicable_plans TEXT[] DEFAULT '{}',
    applicable_regions TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID
);

ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage coupons" ON coupons FOR ALL USING (has_role(auth.uid(), 'admin'));

-- 10. Payment Logs
CREATE TABLE payment_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    plan_id UUID REFERENCES subscription_plans(id),
    amount DECIMAL(10,2),
    currency TEXT DEFAULT 'USD',
    platform TEXT,
    transaction_id TEXT,
    status TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE payment_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own payments" ON payment_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all payments" ON payment_logs FOR ALL USING (has_role(auth.uid(), 'admin'));

-- 11. Fraud & Abuse Detection
CREATE TABLE fraud_detection_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    detection_type TEXT NOT NULL,
    risk_score INTEGER DEFAULT 0,
    details JSONB DEFAULT '{}',
    action_taken TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE fraud_detection_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage fraud logs" ON fraud_detection_logs FOR ALL USING (has_role(auth.uid(), 'admin'));

-- 12. Device Intelligence
CREATE TABLE device_intelligence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    device_id TEXT,
    device_brand TEXT,
    device_model TEXT,
    os_version TEXT,
    app_version TEXT,
    permission_status JSONB DEFAULT '{}',
    battery_optimization_status TEXT,
    oem_risk_score INTEGER DEFAULT 0,
    last_seen_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE device_intelligence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own device" ON device_intelligence FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all devices" ON device_intelligence FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- 13. System Audit Logs
CREATE TABLE system_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID,
    actor_type TEXT DEFAULT 'user',
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id UUID,
    old_value JSONB,
    new_value JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE system_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view audit logs" ON system_audit_logs FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "System can insert logs" ON system_audit_logs FOR INSERT WITH CHECK (true);

-- 14. System Health & Disaster Control
CREATE TABLE system_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'healthy',
    last_check_at TIMESTAMPTZ DEFAULT now(),
    error_count INTEGER DEFAULT 0,
    recovery_mode BOOLEAN DEFAULT false,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE system_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage system health" ON system_health FOR ALL USING (has_role(auth.uid(), 'admin'));

-- 15. Policy & Governance
CREATE TABLE governance_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    rules JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    emergency_override BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE governance_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage policies" ON governance_policies FOR ALL USING (has_role(auth.uid(), 'admin'));

-- 16. User Risk Scores (behavioral analytics)
CREATE TABLE user_risk_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    discipline_score INTEGER DEFAULT 50,
    motivation_score INTEGER DEFAULT 50,
    addiction_risk_score INTEGER DEFAULT 0,
    churn_risk_score INTEGER DEFAULT 0,
    abuse_risk_score INTEGER DEFAULT 0,
    alarm_success_rate DECIMAL(5,2) DEFAULT 0,
    shield_break_rate DECIMAL(5,2) DEFAULT 0,
    focus_retention_score INTEGER DEFAULT 50,
    last_calculated_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_risk_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own scores" ON user_risk_scores FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all scores" ON user_risk_scores FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Insert default configurations
INSERT INTO alarm_configurations (config_key, strictness_level) VALUES ('default', 5);
INSERT INTO shield_configurations (config_key) VALUES ('default');
INSERT INTO ai_control_settings (setting_key, nudging_intensity) VALUES ('global', 5);

-- Insert default subscription plans
INSERT INTO subscription_plans (plan_key, name, tier, price_monthly, price_yearly, features) VALUES
('free', 'Free', 'free', 0, 0, '["basic_alarm", "basic_shield", "limited_groups"]'),
('premium', 'Premium', 'premium', 4.99, 39.99, '["unlimited_alarms", "advanced_shield", "group_accountability", "analytics"]'),
('ultimate', 'Ultimate', 'ultimate', 9.99, 79.99, '["all_features", "ai_coaching", "priority_support", "family_plan"]');

-- Insert default feature flags
INSERT INTO feature_flags (feature_key, name, is_enabled) VALUES
('rise_alarms', 'Rise Alarm System', true),
('shield_blocker', 'Shield Blocker', true),
('group_accountability', 'Group Accountability', true),
('ai_nudging', 'AI Nudging', true),
('advanced_analytics', 'Advanced Analytics', true);

-- Insert system health monitors
INSERT INTO system_health (service_name, status) VALUES
('alarm_service', 'healthy'),
('shield_service', 'healthy'),
('notification_service', 'healthy'),
('sync_service', 'healthy');

-- Create updated_at triggers
CREATE TRIGGER update_admin_roles_updated_at BEFORE UPDATE ON admin_roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_feature_flags_updated_at BEFORE UPDATE ON feature_flags FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_alarm_configurations_updated_at BEFORE UPDATE ON alarm_configurations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_shield_configurations_updated_at BEFORE UPDATE ON shield_configurations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_behavior_rules_updated_at BEFORE UPDATE ON behavior_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ai_control_settings_updated_at BEFORE UPDATE ON ai_control_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_subscriptions_updated_at BEFORE UPDATE ON user_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_device_intelligence_updated_at BEFORE UPDATE ON device_intelligence FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_health_updated_at BEFORE UPDATE ON system_health FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_governance_policies_updated_at BEFORE UPDATE ON governance_policies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_risk_scores_updated_at BEFORE UPDATE ON user_risk_scores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();