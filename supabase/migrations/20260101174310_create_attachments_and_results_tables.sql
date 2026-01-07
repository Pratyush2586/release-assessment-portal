/*
  # Create attachments and results tables

  1. New Tables
    - `attachments`
      - `id` (uuid, primary key)
      - `request_id` (uuid, foreign key to assessment_requests)
      - `filename` (text) - Original filename
      - `file_path` (text) - Path in Supabase Storage
      - `file_size` (integer) - Size in bytes
      - `file_type` (text) - MIME type
      - `uploaded_at` (timestamp)

    - `assessment_results`
      - `id` (uuid, primary key)
      - `request_id` (uuid, foreign key to assessment_requests, unique)
      - `summary` (jsonb) - High-level counts and findings
      - `api_changes` (jsonb, optional) - API impact data
      - `database_changes` (jsonb, optional) - Database impact data
      - `raw_data` (jsonb) - Full assessment data
      - `generated_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Users can only access their own attachments and results
*/

CREATE TABLE IF NOT EXISTS attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES assessment_requests(id) ON DELETE CASCADE,
  filename text NOT NULL,
  file_path text NOT NULL,
  file_size integer NOT NULL,
  file_type text NOT NULL,
  uploaded_at timestamptz DEFAULT now()
);

ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read attachments on their requests"
  ON attachments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assessment_requests
      WHERE assessment_requests.id = attachments.request_id
      AND assessment_requests.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create attachments on their requests"
  ON attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM assessment_requests
      WHERE assessment_requests.id = attachments.request_id
      AND assessment_requests.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete attachments on their requests"
  ON attachments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assessment_requests
      WHERE assessment_requests.id = attachments.request_id
      AND assessment_requests.user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS assessment_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE REFERENCES assessment_requests(id) ON DELETE CASCADE,
  summary jsonb NOT NULL,
  api_changes jsonb,
  database_changes jsonb,
  raw_data jsonb NOT NULL,
  generated_at timestamptz DEFAULT now()
);

ALTER TABLE assessment_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read results on their requests"
  ON assessment_results
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assessment_requests
      WHERE assessment_requests.id = assessment_results.request_id
      AND assessment_requests.user_id = auth.uid()
    )
  );

CREATE INDEX idx_attachments_request_id ON attachments(request_id);
CREATE INDEX idx_assessment_results_request_id ON assessment_results(request_id);
