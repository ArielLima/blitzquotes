-- BlitzPrices Product Schema
-- Run this in Supabase SQL Editor before running migrate.js

-- Drop existing table if needed (careful in production!)
-- drop table if exists products;

create table products (
  id uuid primary key default gen_random_uuid(),
  
  -- Source tracking
  source text not null,              -- 'homedepot', 'lowes'
  source_product_id text not null,   -- their ID
  source_url text,
  
  -- Identifiers (for cross-source matching)
  sku text,
  model_number text,
  upc text,                          -- GTIN-13 format (13 digits)
  
  -- Core product info
  name text not null,
  description text,                  -- for AI search matching
  manufacturer text,
  
  -- Pricing
  price decimal(10,2),
  original_price decimal(10,2),
  in_stock boolean default true,
  
  -- Categorization
  category text,                     -- leaf category
  root_category text,                -- top-level category
  
  -- Quality signals
  rating decimal(2,1),               -- e.g., 4.7
  review_count integer,              -- e.g., 1641
  
  -- Display
  image_url text,
  dimensions jsonb,
  
  -- Timestamps
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  -- Unique constraint for upserts
  unique(source, source_product_id)
);

-- Indexes for common queries
create index idx_products_source on products(source);
create index idx_products_upc on products(upc) where upc is not null;
create index idx_products_category on products(category);
create index idx_products_root_category on products(root_category);
create index idx_products_manufacturer on products(manufacturer);
create index idx_products_rating on products(rating desc nulls last);
create index idx_products_price on products(price);

-- Full-text search on name + description
create index idx_products_search on products using gin(
  to_tsvector('english', name || ' ' || coalesce(description, ''))
);

-- Enable Row Level Security (optional, adjust as needed)
-- alter table products enable row level security;

-- Public read access policy (if using RLS)
-- create policy "Public read access" on products for select using (true);

-- Comment on table
comment on table products is 'Product pricing data from Home Depot, Lowes, etc. for BlitzPrices';
