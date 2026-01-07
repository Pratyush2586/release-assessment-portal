export type ReportType = 'API' | 'Database' | 'API + Database';
export type Environment = 'Development' | 'Test' | 'Staging' | 'Production' | 'Not Applicable';
export type RequestStatus = 'Queued' | 'Running' | 'Completed' | 'Failed';

export interface Release {
  id: string;
  version: string;
  release_date: string;
  is_active: boolean;
  created_at: string;
}

export interface AssessmentRequest {
  id: string;
  user_id: string;
  report_type: ReportType;
  current_release_id: string;
  target_release_id: string;
  environment: Environment;
  title: string | null;
  description: string | null;
  status: RequestStatus;
  error_message: string | null;
  email_notification: boolean;
  inapp_notification: boolean;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  current_release?: Release;
  target_release?: Release;
}

export interface Attachment {
  id: string;
  request_id: string;
  filename: string;
  file_path: string;
  file_size: number;
  file_type: string;
  uploaded_at: string;
}

export interface AssessmentSummary {
  api_endpoints_modified: number;
  api_endpoints_added: number;
  api_endpoints_removed: number;
  database_tables_modified: number;
  database_tables_added: number;
  database_tables_removed: number;
  risk_level: 'Low' | 'Medium' | 'High';
  breaking_changes: boolean;
  key_findings: string[];
}

export interface ApiChange {
  endpoint: string;
  method: string;
  change_type: 'Added' | 'Modified' | 'Removed';
  summary: string;
  details?: {
    parameters_changed?: string[];
    response_schema_changed?: boolean;
    breaking_changes?: string[];
  };
}

export interface DatabaseChange {
  table_name: string;
  change_type: 'Added' | 'Modified' | 'Removed';
  summary: string;
  details?: {
    columns_added?: string[];
    columns_removed?: string[];
    columns_modified?: string[];
    indexes_changed?: string[];
  };
}

export interface AssessmentResults {
  id: string;
  request_id: string;
  summary: AssessmentSummary;
  api_changes?: ApiChange[];
  database_changes?: DatabaseChange[];
  raw_data: Record<string, unknown>;
  generated_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
  created_at: string;
}
