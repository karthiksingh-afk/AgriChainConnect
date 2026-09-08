-- Migration: 20260908171119_init-agrichain-schema.sql
-- AgriChain Connect: B2B Agricultural Supply Chain Platform Schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Controlled Enums per PRD
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM (
        'farmer',
        'local_aggregator',
        'wholesaler',
        'manufacturer',
        'distributor',
        'final_retailer'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE preferred_language AS ENUM ('en', 'hi', 'pa', 'mr');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE listing_status AS ENUM ('available', 'offer_received', 'sold', 'delivered', 'inactive');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE negotiation_status AS ENUM ('active', 'accepted', 'rejected', 'expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE offer_status AS ENUM ('pending', 'countered', 'accepted', 'rejected', 'expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE order_status AS ENUM (
        'order_placed',
        'confirmed',
        'packed',
        'shipped',
        'out_for_delivery',
        'delivered',
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM ('escrow_wallet', 'upi_bank_transfer', 'cash_logged');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE escrow_status AS ENUM ('not_applicable', 'funded', 'held', 'released', 'disputed', 'refunded');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE cash_status AS ENUM ('not_applicable', 'pending_confirmation', 'confirmed_match', 'mismatch');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE processing_stage AS ENUM ('raw', 'in_process', 'packaged_finished');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Core Users Table (PRD Section 11.5 + Section 10 Geolocation)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    mobile_number TEXT NOT NULL,
    role user_role NOT NULL,
    preferred_language preferred_language NOT NULL DEFAULT 'en',
    latitude NUMERIC(9,6),
    longitude NUMERIC(9,6),
    location_address TEXT,
    is_available BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_location ON public.users(latitude, longitude) WHERE is_available = true;

-- Helper function to get role securely
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id UUID)
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT role FROM public.users WHERE id = p_user_id;
$$;

-- Trading capability functions
CREATE OR REPLACE FUNCTION public.can_user_sell(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT role IN ('farmer', 'local_aggregator', 'wholesaler', 'manufacturer', 'distributor')
    FROM public.users WHERE id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.can_user_buy(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT role IN ('local_aggregator', 'wholesaler', 'manufacturer', 'distributor', 'final_retailer')
    FROM public.users WHERE id = p_user_id;
$$;

-- 3. Stock Pools Table (Section 4.2 Aggregator inventory pooling)
CREATE TABLE IF NOT EXISTS public.stock_pools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    crop_type TEXT NOT NULL,
    category TEXT NOT NULL,
    quality_grade TEXT NOT NULL,
    total_quantity NUMERIC NOT NULL DEFAULT 0 CHECK (total_quantity >= 0),
    available_quantity NUMERIC NOT NULL DEFAULT 0 CHECK (available_quantity >= 0),
    unit TEXT NOT NULL DEFAULT 'kg',
    average_procurement_cost NUMERIC NOT NULL DEFAULT 0 CHECK (average_procurement_cost >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_pools_aggregator ON public.stock_pools(aggregator_id);

-- 4. Crop / Product Listings Table
CREATE TABLE IF NOT EXISTS public.listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    crop_type TEXT NOT NULL,
    category TEXT NOT NULL,
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    unit TEXT NOT NULL DEFAULT 'kg',
    quality_grade TEXT,
    asking_price_per_unit NUMERIC NOT NULL CHECK (asking_price_per_unit > 0),
    status listing_status NOT NULL DEFAULT 'available',
    harvest_date DATE,
    location TEXT,
    pickup_availability TEXT,
    images JSONB NOT NULL DEFAULT '[]'::jsonb,
    stock_pool_id UUID REFERENCES public.stock_pools(id) ON DELETE SET NULL,
    processing_stage processing_stage,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listings_seller ON public.listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON public.listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_category ON public.listings(category);

-- Trigger: Ensure listing seller has sell permission
CREATE OR REPLACE FUNCTION public.check_listing_seller_role()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT public.can_user_sell(NEW.seller_id) THEN
        RAISE EXCEPTION 'User role cannot create sell listings (sell-only or dual-sided roles only)';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_listing_seller_role ON public.listings;
CREATE TRIGGER trg_check_listing_seller_role
BEFORE INSERT OR UPDATE OF seller_id ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.check_listing_seller_role();

-- 5. Negotiation Threads & Offers (Section 5.2)
CREATE TABLE IF NOT EXISTS public.negotiation_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status negotiation_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_diff_buyer_seller CHECK (buyer_id <> seller_id)
);

CREATE INDEX IF NOT EXISTS idx_negotiation_threads_buyer ON public.negotiation_threads(buyer_id);
CREATE INDEX IF NOT EXISTS idx_negotiation_threads_seller ON public.negotiation_threads(seller_id);
CREATE INDEX IF NOT EXISTS idx_negotiation_threads_listing ON public.negotiation_threads(listing_id);

-- Trigger: Ensure thread buyer has buy permission
CREATE OR REPLACE FUNCTION public.check_negotiation_buyer_role()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT public.can_user_buy(NEW.buyer_id) THEN
        RAISE EXCEPTION 'User role cannot initiate buy negotiations (buy-only or dual-sided roles only)';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_negotiation_buyer_role ON public.negotiation_threads;
CREATE TRIGGER trg_check_negotiation_buyer_role
BEFORE INSERT OR UPDATE OF buyer_id ON public.negotiation_threads
FOR EACH ROW EXECUTE FUNCTION public.check_negotiation_buyer_role();

CREATE TABLE IF NOT EXISTS public.negotiation_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES public.negotiation_threads(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    proposed_price_per_unit NUMERIC NOT NULL CHECK (proposed_price_per_unit > 0),
    proposed_quantity NUMERIC NOT NULL CHECK (proposed_quantity > 0),
    message TEXT,
    pickup_terms TEXT,
    expires_at TIMESTAMPTZ,
    status offer_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_negotiation_offers_thread ON public.negotiation_offers(thread_id);

-- 6. Orders Table & Order Status History (Section 12)
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    seller_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    listing_id UUID REFERENCES public.listings(id) ON DELETE SET NULL,
    negotiation_thread_id UUID REFERENCES public.negotiation_threads(id) ON DELETE SET NULL,
    accepted_offer_id UUID REFERENCES public.negotiation_offers(id) ON DELETE SET NULL,
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC NOT NULL CHECK (unit_price > 0),
    total_amount NUMERIC NOT NULL CHECK (total_amount > 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    status order_status NOT NULL DEFAULT 'order_placed',
    estimated_delivery_date TIMESTAMPTZ,
    pickup_dropoff_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_order_diff_parties CHECK (buyer_id <> seller_id)
);

CREATE INDEX IF NOT EXISTS idx_orders_buyer ON public.orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller ON public.orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

CREATE TABLE IF NOT EXISTS public.order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    status order_status NOT NULL,
    notes TEXT,
    updated_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON public.order_status_history(order_id);

-- 7. Payments & Escrow Records (Section 5.1)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
    payer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    payee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    payment_method payment_method NOT NULL,
    escrow_status escrow_status NOT NULL DEFAULT 'not_applicable',
    cash_status cash_status NOT NULL DEFAULT 'not_applicable',
    cash_seller_reported_amount NUMERIC,
    cash_seller_reported_date TIMESTAMPTZ,
    cash_buyer_reported_amount NUMERIC,
    cash_buyer_reported_date TIMESTAMPTZ,
    transaction_reference TEXT,
    inspection_window_ends_at TIMESTAMPTZ,
    dispute_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_payer ON public.payments(payer_id);
CREATE INDEX IF NOT EXISTS idx_payments_payee ON public.payments(payee_id);

CREATE TABLE IF NOT EXISTS public.escrow_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
    event_type escrow_status NOT NULL,
    actor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_escrow_events_payment ON public.escrow_events(payment_id);

-- 8. Trust Score System (Section 9)
CREATE TABLE IF NOT EXISTS public.trust_scores (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    aggregate_score NUMERIC(5,2) NOT NULL DEFAULT 80.00 CHECK (aggregate_score BETWEEN 0 AND 100),
    star_rating NUMERIC(3,2) NOT NULL DEFAULT 4.00 CHECK (star_rating BETWEEN 0 AND 5),
    is_high_risk BOOLEAN NOT NULL DEFAULT false,
    is_new_member BOOLEAN NOT NULL DEFAULT true,
    total_transactions INTEGER NOT NULL DEFAULT 0,
    payment_reliability_score NUMERIC(5,2) NOT NULL DEFAULT 80.00 CHECK (payment_reliability_score BETWEEN 0 AND 100),
    order_fulfillment_score NUMERIC(5,2) NOT NULL DEFAULT 80.00 CHECK (order_fulfillment_score BETWEEN 0 AND 100),
    operational_punctuality_score NUMERIC(5,2) NOT NULL DEFAULT 80.00 CHECK (operational_punctuality_score BETWEEN 0 AND 100),
    peer_reviews_score NUMERIC(5,2) NOT NULL DEFAULT 80.00 CHECK (peer_reviews_score BETWEEN 0 AND 100),
    last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.trust_score_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    aggregate_score NUMERIC(5,2) NOT NULL,
    star_rating NUMERIC(3,2) NOT NULL,
    payment_reliability_score NUMERIC(5,2) NOT NULL,
    order_fulfillment_score NUMERIC(5,2) NOT NULL,
    operational_punctuality_score NUMERIC(5,2) NOT NULL,
    peer_reviews_score NUMERIC(5,2) NOT NULL,
    reason TEXT NOT NULL,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trust_history_user ON public.trust_score_history(user_id);

CREATE TABLE IF NOT EXISTS public.peer_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reviewed_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_order_reviewer UNIQUE (order_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_peer_reviews_reviewed ON public.peer_reviews(reviewed_user_id);

-- 9. Live Market Index Price Feed (Section 8.6, 6)
CREATE TABLE IF NOT EXISTS public.market_index_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    crop_category TEXT NOT NULL,
    crop_name TEXT NOT NULL,
    region TEXT NOT NULL,
    market_center_mandi TEXT NOT NULL,
    modal_price NUMERIC NOT NULL CHECK (modal_price >= 0),
    min_price NUMERIC NOT NULL CHECK (min_price >= 0),
    max_price NUMERIC NOT NULL CHECK (max_price >= 0),
    unit TEXT NOT NULL DEFAULT 'quintal',
    currency TEXT NOT NULL DEFAULT 'INR',
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_market_prices_crop ON public.market_index_prices(crop_name, region);

-- 10. Route Optimization Recommendations (Section 8)
CREATE TABLE IF NOT EXISTS public.route_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    crop_category TEXT NOT NULL,
    source_tier user_role NOT NULL,
    destination_tier user_role NOT NULL,
    recommended_route JSONB NOT NULL,
    standard_route JSONB NOT NULL,
    skipped_nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
    net_profitability_analysis JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_route_rec_seller ON public.route_recommendations(seller_id);

-- 11. ₹100 Value Distribution Dataset (Section 6)
CREATE TABLE IF NOT EXISTS public.value_distributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    crop_category TEXT NOT NULL UNIQUE,
    farmer_share NUMERIC(5,2) NOT NULL,
    aggregator_share NUMERIC(5,2) NOT NULL,
    wholesaler_share NUMERIC(5,2) NOT NULL,
    manufacturer_share NUMERIC(5,2) NOT NULL,
    distributor_share NUMERIC(5,2) NOT NULL,
    retailer_share NUMERIC(5,2) NOT NULL,
    data_source TEXT NOT NULL DEFAULT 'market_benchmark',
    notes TEXT,
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT total_value_100 CHECK ((farmer_share + aggregator_share + wholesaler_share + manufacturer_share + distributor_share + retailer_share) = 100.00)
);

-- Seed Section 6.2 Baseline Data
INSERT INTO public.value_distributions (
    crop_category,
    farmer_share,
    aggregator_share,
    wholesaler_share,
    manufacturer_share,
    distributor_share,
    retailer_share,
    data_source,
    notes
) VALUES (
    'All Commodities (Benchmark)',
    28.00,
    7.00,
    12.00,
    25.00,
    10.00,
    18.00,
    'market_benchmark',
    'Standard PRD Section 6.2 illustrative baseline distribution across the six tiers.'
) ON CONFLICT (crop_category) DO NOTHING;

INSERT INTO public.value_distributions (
    crop_category,
    farmer_share,
    aggregator_share,
    wholesaler_share,
    manufacturer_share,
    distributor_share,
    retailer_share,
    data_source,
    notes
) VALUES (
    'Grains & Cereals (Wheat, Rice)',
    32.00,
    8.00,
    14.00,
    20.00,
    11.00,
    15.00,
    'market_benchmark',
    'High bulk staple distribution model.'
) ON CONFLICT (crop_category) DO NOTHING;

INSERT INTO public.value_distributions (
    crop_category,
    farmer_share,
    aggregator_share,
    wholesaler_share,
    manufacturer_share,
    distributor_share,
    retailer_share,
    data_source,
    notes
) VALUES (
    'Fresh Fruits & Vegetables',
    24.00,
    9.00,
    15.00,
    18.00,
    14.00,
    20.00,
    'market_benchmark',
    'Perishable cold chain distribution model with higher logistics and retail margins.'
) ON CONFLICT (crop_category) DO NOTHING;

-- Seed Sample Mandi Prices for Market Index
INSERT INTO public.market_index_prices (
    crop_category, crop_name, region, market_center_mandi, modal_price, min_price, max_price, unit
) VALUES
    ('Grains & Cereals', 'Wheat', 'Punjab', 'Khanna Mandi', 2275.00, 2200.00, 2350.00, 'quintal'),
    ('Grains & Cereals', 'Basmati Rice', 'Haryana', 'Karnal Mandi', 3850.00, 3700.00, 4100.00, 'quintal'),
    ('Fresh Fruits & Vegetables', 'Tomato', 'Maharashtra', 'Nashik Mandi', 1800.00, 1500.00, 2200.00, 'quintal'),
    ('Fresh Fruits & Vegetables', 'Onion', 'Maharashtra', 'Lasalgaon Mandi', 2400.00, 2100.00, 2800.00, 'quintal'),
    ('Pulses', 'Chana (Gram)', 'Madhya Pradesh', 'Indore Mandi', 5400.00, 5200.00, 5650.00, 'quintal')
ON CONFLICT DO NOTHING;

-- 12. Row Level Security Policies (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.negotiation_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.negotiation_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escrow_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trust_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trust_score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peer_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_index_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.value_distributions ENABLE ROW LEVEL SECURITY;

-- Grants to runtime roles (anon & authenticated)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;

-- Policies for public.users
DROP POLICY IF EXISTS users_read_policy ON public.users;
CREATE POLICY users_read_policy ON public.users
FOR SELECT TO authenticated, anon
USING (true);

DROP POLICY IF EXISTS users_update_policy ON public.users;
CREATE POLICY users_update_policy ON public.users
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Policies for listings
DROP POLICY IF EXISTS listings_read_policy ON public.listings;
CREATE POLICY listings_read_policy ON public.listings
FOR SELECT TO authenticated, anon
USING (status = 'available' OR seller_id = auth.uid());

DROP POLICY IF EXISTS listings_write_policy ON public.listings;
CREATE POLICY listings_write_policy ON public.listings
FOR INSERT TO authenticated
WITH CHECK (seller_id = auth.uid() AND public.can_user_sell(auth.uid()));

DROP POLICY IF EXISTS listings_modify_policy ON public.listings;
CREATE POLICY listings_modify_policy ON public.listings
FOR UPDATE TO authenticated
USING (seller_id = auth.uid())
WITH CHECK (seller_id = auth.uid());

-- Policies for negotiation threads
DROP POLICY IF EXISTS threads_read_policy ON public.negotiation_threads;
CREATE POLICY threads_read_policy ON public.negotiation_threads
FOR SELECT TO authenticated
USING (buyer_id = auth.uid() OR seller_id = auth.uid());

DROP POLICY IF EXISTS threads_insert_policy ON public.negotiation_threads;
CREATE POLICY threads_insert_policy ON public.negotiation_threads
FOR INSERT TO authenticated
WITH CHECK (buyer_id = auth.uid() AND public.can_user_buy(auth.uid()));

DROP POLICY IF EXISTS threads_update_policy ON public.negotiation_threads;
CREATE POLICY threads_update_policy ON public.negotiation_threads
FOR UPDATE TO authenticated
USING (buyer_id = auth.uid() OR seller_id = auth.uid());

-- Policies for negotiation offers
DROP POLICY IF EXISTS offers_read_policy ON public.negotiation_offers;
CREATE POLICY offers_read_policy ON public.negotiation_offers
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.negotiation_threads t
        WHERE t.id = thread_id AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
    )
);

DROP POLICY IF EXISTS offers_insert_policy ON public.negotiation_offers;
CREATE POLICY offers_insert_policy ON public.negotiation_offers
FOR INSERT TO authenticated
WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.negotiation_threads t
        WHERE t.id = thread_id AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
    )
);

-- Policies for orders
DROP POLICY IF EXISTS orders_read_policy ON public.orders;
CREATE POLICY orders_read_policy ON public.orders
FOR SELECT TO authenticated
USING (buyer_id = auth.uid() OR seller_id = auth.uid());

DROP POLICY IF EXISTS orders_insert_policy ON public.orders;
CREATE POLICY orders_insert_policy ON public.orders
FOR INSERT TO authenticated
WITH CHECK (buyer_id = auth.uid() AND public.can_user_buy(auth.uid()));

DROP POLICY IF EXISTS orders_update_policy ON public.orders;
CREATE POLICY orders_update_policy ON public.orders
FOR UPDATE TO authenticated
USING (buyer_id = auth.uid() OR seller_id = auth.uid());

-- Policies for order status history
DROP POLICY IF EXISTS order_status_read_policy ON public.order_status_history;
CREATE POLICY order_status_read_policy ON public.order_status_history
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
);

DROP POLICY IF EXISTS order_status_insert_policy ON public.order_status_history;
CREATE POLICY order_status_insert_policy ON public.order_status_history
FOR INSERT TO authenticated
WITH CHECK (
    updated_by = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
);

-- Policies for payments
DROP POLICY IF EXISTS payments_read_policy ON public.payments;
CREATE POLICY payments_read_policy ON public.payments
FOR SELECT TO authenticated
USING (payer_id = auth.uid() OR payee_id = auth.uid());

DROP POLICY IF EXISTS payments_write_policy ON public.payments;
CREATE POLICY payments_write_policy ON public.payments
FOR ALL TO authenticated
USING (payer_id = auth.uid() OR payee_id = auth.uid())
WITH CHECK (payer_id = auth.uid() OR payee_id = auth.uid());

-- Policies for trust score
DROP POLICY IF EXISTS trust_scores_public_read ON public.trust_scores;
CREATE POLICY trust_scores_public_read ON public.trust_scores
FOR SELECT TO authenticated, anon
USING (true);

DROP POLICY IF EXISTS trust_history_private_read ON public.trust_score_history;
CREATE POLICY trust_history_private_read ON public.trust_score_history
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Policies for peer reviews
DROP POLICY IF EXISTS peer_reviews_read_policy ON public.peer_reviews;
CREATE POLICY peer_reviews_read_policy ON public.peer_reviews
FOR SELECT TO authenticated, anon
USING (true);

DROP POLICY IF EXISTS peer_reviews_insert_policy ON public.peer_reviews;
CREATE POLICY peer_reviews_insert_policy ON public.peer_reviews
FOR INSERT TO authenticated
WITH CHECK (reviewer_id = auth.uid());

-- Policies for market index & value distribution (read-only for all)
DROP POLICY IF EXISTS market_index_read ON public.market_index_prices;
CREATE POLICY market_index_read ON public.market_index_prices
FOR SELECT TO authenticated, anon
USING (true);

DROP POLICY IF EXISTS value_dist_read ON public.value_distributions;
CREATE POLICY value_dist_read ON public.value_distributions
FOR SELECT TO authenticated, anon
USING (true);

-- Policies for route recommendations
DROP POLICY IF EXISTS route_rec_read ON public.route_recommendations;
CREATE POLICY route_rec_read ON public.route_recommendations
FOR SELECT TO authenticated
USING (seller_id = auth.uid());

DROP POLICY IF EXISTS route_rec_write ON public.route_recommendations;
CREATE POLICY route_rec_write ON public.route_recommendations
FOR INSERT TO authenticated
WITH CHECK (seller_id = auth.uid());
