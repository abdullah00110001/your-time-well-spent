-- Create unified wallet system for BlackBox PDF

-- Enum for credit transaction types
CREATE TYPE public.credit_transaction_type AS ENUM (
  'initial_grant',
  'purchase',
  'tool_usage',
  'ad_bonus',
  'admin_grant',
  'admin_revoke',
  'referral_bonus',
  'daily_bonus',
  'refund'
);

-- Enum for PDF tool types
CREATE TYPE public.pdf_tool_type AS ENUM (
  'merge',
  'split',
  'compress',
  'convert_to_pdf',
  'convert_from_pdf',
  'rotate',
  'watermark',
  'password_protect',
  'unlock',
  'extract_pages',
  'ocr',
  'edit_text',
  'sign',
  'redact',
  'compare',
  'optimize'
);

-- Unified wallet table
CREATE TABLE public.user_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  balance INTEGER NOT NULL DEFAULT 50,
  lifetime_earned INTEGER NOT NULL DEFAULT 50,
  lifetime_spent INTEGER NOT NULL DEFAULT 0,
  is_premium BOOLEAN DEFAULT false,
  premium_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Credit transactions log (audit trail)
CREATE TABLE public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  wallet_id UUID REFERENCES public.user_wallets(id) ON DELETE CASCADE,
  transaction_type credit_transaction_type NOT NULL,
  amount INTEGER NOT NULL,
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  tool_used pdf_tool_type,
  file_size_mb NUMERIC(10,2),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- PDF tool configuration (admin-controlled pricing)
CREATE TABLE public.pdf_tool_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_type pdf_tool_type NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '📄',
  is_premium BOOLEAN DEFAULT false,
  base_credits INTEGER NOT NULL DEFAULT 1,
  credits_per_mb NUMERIC(5,2) DEFAULT 0.5,
  max_free_size_mb INTEGER DEFAULT 5,
  is_enabled BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Ad configuration (admin-controlled)
CREATE TABLE public.ad_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placement TEXT NOT NULL UNIQUE,
  is_enabled BOOLEAN DEFAULT true,
  ad_code TEXT,
  fallback_message TEXT DEFAULT 'Processing sponsored by our partners',
  watch_duration_seconds INTEGER DEFAULT 30,
  credits_reward INTEGER DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- PDF processing logs (analytics)
CREATE TABLE public.pdf_processing_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tool_type pdf_tool_type NOT NULL,
  file_count INTEGER DEFAULT 1,
  total_size_mb NUMERIC(10,2),
  credits_used INTEGER DEFAULT 0,
  processing_time_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  was_ad_unlock BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdf_tool_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdf_processing_logs ENABLE ROW LEVEL SECURITY;

-- Wallet policies
CREATE POLICY "Users can view their own wallet"
ON public.user_wallets FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own wallet"
ON public.user_wallets FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wallet"
ON public.user_wallets FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all wallets"
ON public.user_wallets FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Transaction policies
CREATE POLICY "Users can view their own transactions"
ON public.credit_transactions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own transactions"
ON public.credit_transactions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all transactions"
ON public.credit_transactions FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Tool config policies (public read, admin write)
CREATE POLICY "Anyone can view enabled tool configs"
ON public.pdf_tool_configs FOR SELECT
USING (true);

CREATE POLICY "Admins can manage tool configs"
ON public.pdf_tool_configs FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Ad config policies
CREATE POLICY "Anyone can view ad configs"
ON public.ad_configurations FOR SELECT
USING (true);

CREATE POLICY "Admins can manage ad configs"
ON public.ad_configurations FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Processing log policies
CREATE POLICY "Users can view their own logs"
ON public.pdf_processing_logs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own logs"
ON public.pdf_processing_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all logs"
ON public.pdf_processing_logs FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_user_wallets_updated_at
BEFORE UPDATE ON public.user_wallets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pdf_tool_configs_updated_at
BEFORE UPDATE ON public.pdf_tool_configs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ad_configurations_updated_at
BEFORE UPDATE ON public.ad_configurations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to auto-create wallet on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user_wallet()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_wallets (user_id, balance, lifetime_earned)
  VALUES (NEW.id, 50, 50);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger on auth.users for auto wallet creation
CREATE TRIGGER on_auth_user_created_wallet
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_wallet();

-- Insert default tool configurations
INSERT INTO public.pdf_tool_configs (tool_type, name, description, icon, is_premium, base_credits, credits_per_mb, max_free_size_mb, sort_order) VALUES
('merge', 'Merge PDFs', 'Combine multiple PDFs into one secure document', '🔗', false, 2, 0.5, 10, 1),
('split', 'Split PDF', 'Extract pages or split into multiple files', '✂️', false, 2, 0.3, 10, 2),
('compress', 'Compress PDF', 'Reduce file size without quality loss', '📦', false, 1, 0.2, 15, 3),
('convert_to_pdf', 'Convert to PDF', 'Transform images and documents to PDF', '📄', false, 1, 0.3, 10, 4),
('convert_from_pdf', 'PDF to Image', 'Export PDF pages as high-quality images', '🖼️', false, 2, 0.5, 10, 5),
('rotate', 'Rotate Pages', 'Adjust page orientation securely', '🔄', false, 1, 0.1, 20, 6),
('watermark', 'Add Watermark', 'Brand your documents with custom watermarks', '💧', true, 3, 0.5, 10, 7),
('password_protect', 'Password Protect', 'Encrypt PDFs with military-grade encryption', '🔒', true, 4, 0.5, 10, 8),
('unlock', 'Unlock PDF', 'Remove password protection securely', '🔓', true, 5, 0.5, 10, 9),
('extract_pages', 'Extract Pages', 'Pull specific pages from a document', '📑', false, 2, 0.3, 10, 10),
('ocr', 'OCR Recognition', 'Extract text from scanned documents', '👁️', true, 8, 1.0, 5, 11),
('edit_text', 'Edit Text', 'Modify text content in-place', '✏️', true, 10, 1.0, 5, 12),
('sign', 'Digital Signature', 'Add legally-binding digital signatures', '✍️', true, 5, 0.5, 10, 13),
('redact', 'Redact Content', 'Permanently remove sensitive information', '█', true, 6, 0.8, 5, 14),
('compare', 'Compare PDFs', 'Detect differences between documents', '⚖️', true, 8, 1.0, 5, 15),
('optimize', 'Web Optimize', 'Optimize PDFs for web delivery', '🌐', false, 2, 0.3, 15, 16);

-- Insert default ad configurations
INSERT INTO public.ad_configurations (placement, is_enabled, watch_duration_seconds, credits_reward, fallback_message) VALUES
('sidebar', true, 0, 0, 'Secure processing powered by partners'),
('download_interstitial', true, 30, 5, 'Watch to unlock processing credits'),
('tool_page_banner', true, 0, 0, 'Enterprise-grade security');