/*
  # Create assessment requests table

  1. New Tables
    - `assessment_requests`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `report_type` (text) - "API", "Database", or "API + Database"
      - `current_release_id` (uuid, foreign key to releases)
      - `target_release_id` (uuid, foreign key to releases)
      - `environment` (text) - "Development", "Test", "Staging", "Production", or "Not Applicable"
      - `title` (text, optional) - Custom request title
      - `description` (text, optional) - Request notes
      - `status` (text) - "Queued", "Running", "Completed", "Failed"
      - `error_message` (text, optional) - Error details if failed
      - `email_notification` (boolean)
      - `inapp_notification` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
      - `completed_at` (timestamp, optional)

  2. Security
    - Enable RLS on `assessment_requests` table
    - Users can only read/create their own requests
    - Users can only update their own requests (cancel)
*/

CREATE TABLE IF NOT EXISTS assessment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_type text NOT NULL CHECK (report_type IN ('API', 'Database', 'API + Database')),
  current_release_id uuid NOT NULL REFERENCES releases(id),
  target_release_id uuid NOT NULL REFERENCES releases(id),
  environment text DEFAULT 'Not Applicable' CHECK (environment IN ('Development', 'Test', 'Staging', 'Production', 'Not Applicable')),
  title text,
  description text,
  status text DEFAULT 'Queued' CHECK (status IN ('Queued', 'Running', 'Completed', 'Failed')),
  error_message text,
  email_notification boolean DEFAULT true,
  inapp_notification boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE assessment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own requests"
  ON assessment_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create requests"
  ON assessment_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own requests"
  ON assessment_requests
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_assessment_requests_user_id ON assessment_requests(user_id);
CREATE INDEX idx_assessment_requests_status ON assessment_requests(status);
CREATE INDEX idx_assessment_requests_created_at ON assessment_requests(created_at DESC);
