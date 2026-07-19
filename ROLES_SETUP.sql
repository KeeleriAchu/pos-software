-- ============================================================
-- POS MANAGER - ADD ROLES TO USERS
-- Run this in Supabase SQL Editor -> New Query -> Run All
-- ============================================================

-- 1. Add role column to users table if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- 2. Make an existing user an admin
-- Replace 'your_email@example.com' with the email of the user you want to make an admin
UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';

-- You can safely run this multiple times.
