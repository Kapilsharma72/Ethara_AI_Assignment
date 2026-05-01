-- Migration: 002_add_user_role
-- Adds a global role column to users (admin or member).
-- Existing users default to 'admin'.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role VARCHAR(10) NOT NULL DEFAULT 'admin'
  CHECK (role IN ('admin', 'member'));
