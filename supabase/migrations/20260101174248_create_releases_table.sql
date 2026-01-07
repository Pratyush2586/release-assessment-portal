/*
  # Create releases table for impact assessment portal

  1. New Tables
    - `releases`
      - `id` (uuid, primary key)
      - `version` (text, unique) - e.g., "EB20", "EB21", "EB25.1"
      - `release_date` (timestamp)
      - `is_active` (boolean) - Whether this release is available for selection
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `releases` table
    - Add policy for authenticated users to read releases
*/

CREATE TABLE IF NOT EXISTS releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text UNIQUE NOT NULL,
  release_date timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE releases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active releases"
  ON releases
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Insert default releases
INSERT INTO releases (version, is_active) VALUES
  ('EB20', true),
  ('EB21', true),
  ('EB22', true),
  ('EB23', true),
  ('EB24', true),
  ('EB25.1', true)
ON CONFLICT (version) DO NOTHING;
