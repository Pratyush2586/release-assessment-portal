import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { AssessmentRequest, Release } from '../types';
import { AlertCircle, Download } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export const Dashboard: React.FC = () => {
  const [requests, setRequests] = useState<AssessmentRequest[]>([]);
  const [releases, setReleases] = useState<Map<string, Release>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');

        const { data: releasesData, error: releasesError } = await supabase
          .from('releases')
          .select('*')
          .eq('is_active', true);

        if (releasesError) throw releasesError;

        const releaseMap = new Map(
          (releasesData || []).map((r) => [r.id, r])
        );
        setReleases(releaseMap);

        const { data: requestsData, error: requestsError } = await supabase
          .from('assessment_requests')
          .select('*')
          .order('created_at', { ascending: false });

        if (requestsError) throw requestsError;
        setRequests(requestsData || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load requests');
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    const subscription = supabase
      .channel('assessment_requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assessment_requests' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const filteredRequests = requests.filter((req) => {
    const matchesSearch = req.id.includes(searchTerm) || (req.title?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'Queued':
        return 'bg-neutral-100 text-neutral-700';
      case 'Running':
        return 'bg-blue-100 text-blue-700';
      case 'Completed':
        return 'bg-green-100 text-green-700';
      case 'Failed':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-neutral-100 text-neutral-700';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'API':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Database':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'API + Database':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default:
        return 'bg-neutral-50 text-neutral-700 border-neutral-200';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-neutral-200 rounded w-1/4 animate-pulse"></div>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-neutral-200 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900 mb-2">Your Assessment Requests</h1>
        <p className="text-neutral-600">Manage and track your release impact assessments</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="w-full sm:w-96">
          <input
            type="text"
            placeholder="Search by ID or title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Statuses</option>
          <option value="Queued">Queued</option>
          <option value="Running">Running</option>
          <option value="Completed">Completed</option>
          <option value="Failed">Failed</option>
        </select>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md flex items-start space-x-3">
          <AlertCircle className="text-red-600 mt-0.5 flex-shrink-0" size={20} />
          <div>
            <p className="font-medium text-red-900">Unable to load requests</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {filteredRequests.length === 0 && !error ? (
        <div className="text-center py-12 border border-neutral-200 rounded-lg bg-white">
          <div className="inline-block p-3 bg-neutral-100 rounded-full mb-4">
            <AlertCircle className="text-neutral-600" size={24} />
          </div>
          <h3 className="text-lg font-semibold text-neutral-900 mb-2">
            {requests.length === 0 ? 'No assessment requests yet' : 'No matching requests'}
          </h3>
          <p className="text-neutral-600 mb-6">
            {requests.length === 0
              ? 'Create your first impact assessment to compare API and database changes between releases.'
              : 'Try adjusting your search or filters.'}
          </p>
          {requests.length === 0 && (
            <Link
              to="/request/new"
              className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
            >
              Create Assessment
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-700 uppercase tracking-wide">
                  ID
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-700 uppercase tracking-wide">
                  Type
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-700 uppercase tracking-wide">
                  Releases
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-700 uppercase tracking-wide">
                  Environment
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-700 uppercase tracking-wide">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-700 uppercase tracking-wide">
                  Submitted
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-700 uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((request) => (
                <tr
                  key={request.id}
                  className="border-b border-neutral-200 hover:bg-neutral-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      to={`/request/${request.id}`}
                      className="text-blue-600 hover:text-blue-700 font-mono text-sm"
                    >
                      #{request.id.slice(0, 8).toUpperCase()}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-1 text-xs font-medium rounded border ${getTypeColor(
                        request.report_type
                      )}`}
                    >
                      {request.report_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-700">
                    {releases.get(request.current_release_id)?.version || '?'} →{' '}
                    {releases.get(request.target_release_id)?.version || '?'}
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-600">
                    {request.environment}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`inline-block px-2 py-1 text-xs font-medium rounded ${getStatusBadgeColor(
                          request.status
                        )}`}
                      >
                        {request.status}
                      </span>
                      {request.status === 'Running' && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-600">
                    <span title={new Date(request.created_at).toLocaleString()}>
                      {formatDistanceToNow(new Date(request.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <Link
                        to={`/request/${request.id}`}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        View
                      </Link>
                      {request.status === 'Completed' && (
                        <Link
                          to={`/request/${request.id}/results`}
                          title="Download report"
                          className="text-neutral-600 hover:text-neutral-900"
                        >
                          <Download size={18} />
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-sm text-neutral-600">
        {filteredRequests.length > 0 && `Showing ${filteredRequests.length} of ${requests.length} requests`}
      </div>
    </div>
  );
};
