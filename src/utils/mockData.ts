import { AssessmentResults, ApiChange, DatabaseChange, AssessmentSummary } from '../types';

export const generateMockResults = (): AssessmentResults => {
  const apiChanges: ApiChange[] = [
    {
      endpoint: '/api/v2/users/{id}',
      method: 'GET',
      change_type: 'Modified',
      summary: 'Added new query parameter "includeMetadata" for expanded user information',
      details: {
        parameters_changed: ['includeMetadata'],
        response_schema_changed: true,
        breaking_changes: [],
      },
    },
    {
      endpoint: '/api/v2/users/{id}/permissions',
      method: 'GET',
      change_type: 'Added',
      summary: 'New endpoint to retrieve user permissions and role assignments',
    },
    {
      endpoint: '/api/v1/auth/token',
      method: 'POST',
      change_type: 'Removed',
      summary: 'Deprecated in favor of /api/v2/auth/login. Removed support for legacy token format.',
      details: {
        breaking_changes: ['Client must migrate to v2 endpoint'],
      },
    },
    {
      endpoint: '/api/v2/reports/{id}',
      method: 'PATCH',
      change_type: 'Modified',
      summary: 'Added support for partial updates using JSON Patch format',
    },
    {
      endpoint: '/api/v2/webhooks',
      method: 'POST',
      change_type: 'Modified',
      summary: 'New required field "event_type" in request body',
      details: {
        parameters_changed: ['event_type (required)'],
        breaking_changes: ['Missing event_type will return 400 Bad Request'],
      },
    },
  ];

  const databaseChanges: DatabaseChange[] = [
    {
      table_name: 'users',
      change_type: 'Modified',
      summary: 'Added column "last_login_at", removed "legacy_user_id" column',
      details: {
        columns_added: ['last_login_at (timestamptz)'],
        columns_removed: ['legacy_user_id'],
      },
    },
    {
      table_name: 'audit_logs',
      change_type: 'Added',
      summary: 'New table for tracking all user actions and API calls for compliance',
      details: {
        columns_added: ['id', 'user_id', 'action', 'resource_type', 'timestamp', 'ip_address'],
      },
    },
    {
      table_name: 'user_permissions',
      change_type: 'Modified',
      summary: 'Renamed column "role" to "permission_level", added "metadata" column',
      details: {
        columns_modified: ['role → permission_level'],
        columns_added: ['metadata (jsonb)'],
      },
    },
    {
      table_name: 'old_reports',
      change_type: 'Removed',
      summary: 'Deprecated table removed. Data migrated to "reports" table.',
    },
    {
      table_name: 'webhooks',
      change_type: 'Modified',
      summary: 'Added "delivery_attempts" and "last_error_message" columns for better error tracking',
      details: {
        columns_added: ['delivery_attempts (integer)', 'last_error_message (text)'],
      },
    },
  ];

  const summary: AssessmentSummary = {
    api_endpoints_modified: 3,
    api_endpoints_added: 1,
    api_endpoints_removed: 1,
    database_tables_modified: 3,
    database_tables_added: 1,
    database_tables_removed: 1,
    risk_level: 'Medium',
    breaking_changes: true,
    key_findings: [
      'Deprecated API endpoint /api/v1/auth/token has been removed. Clients must migrate to /api/v2/auth/login.',
      'New required field "event_type" in POST /api/v2/webhooks will cause requests without it to fail.',
      'Column "legacy_user_id" removed from users table. Ensure all references are updated.',
      'New audit_logs table available for compliance tracking.',
      'Overall upgrade is medium risk due to breaking changes. Requires client library updates and migration scripts.',
    ],
  };

  return {
    id: '12345678-1234-1234-1234-123456789012',
    request_id: '12345678-1234-1234-1234-123456789012',
    summary,
    api_changes: apiChanges,
    database_changes: databaseChanges,
    raw_data: { apiChanges, databaseChanges, summary },
    generated_at: new Date().toISOString(),
  };
};
