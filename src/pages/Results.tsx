import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { AssessmentResults, AssessmentRequest, Release } from '../types';
import { AlertCircle, Download, Copy } from 'lucide-react';

export const Results: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [request, setRequest] = useState<AssessmentRequest | null>(null);
  const [results, setResults] = useState<AssessmentResults | null>(null);
  const [releases, setReleases] = useState<Map<string, Release>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'summary' | 'api' | 'database' | 'raw'>('summary');
  const [apiFilter, setApiFilter] = useState<string>('all');
  const [dbFilter, setDbFilter] = useState<string>('all');
  const [toast, setToast] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');

        const { data: requestData, error: requestError } = await supabase
          .from('assessment_requests')
          .select('*')
          .eq('id', id)
          .single();

        if (requestError) throw requestError;
        setRequest(requestData);

        const { data: resultsData, error: resultsError } = await supabase
          .from('assessment_results')
          .select('*')
          .eq('request_id', id)
          .single();

        if (resultsError) throw resultsError;
        setResults(resultsData);

        const { data: releasesData, error: releasesError } = await supabase
          .from('releases')
          .select('*');

        if (releasesError) throw releasesError;

        const releaseMap = new Map((releasesData || []).map((r) => [r.id, r]));
        setReleases(releaseMap);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load results');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleDownload = async (format: 'pdf' | 'json' | 'markdown') => {
    if (!results) return;

    try {
      setDownloading(true);

      let content = '';
      let filename = `assessment-${request?.id.slice(0, 8)}.`;

      if (format === 'json') {
        content = JSON.stringify(results, null, 2);
        filename += 'json';
      } else if (format === 'markdown') {
        content = generateMarkdown();
        filename += 'md';
      } else {
        // For PDF, we would normally use a library, but for now just download as JSON
        content = JSON.stringify(results, null, 2);
        filename = filename.replace('.', '.json');
      }

      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setToast('Report downloaded successfully');
      setTimeout(() => setToast(null), 2000);
    } catch (err) {
      setToast('Failed to download report');
    } finally {
      setDownloading(false);
    }
  };

  const generateMarkdown = (): string => {
    if (!results || !request) return '';

    let markdown = `# Impact Assessment Report\n\n`;
    markdown += `**Request ID:** ${request.id}\n`;
    markdown += `**Report Type:** ${request.report_type}\n`;
    markdown += `**Generated:** ${new Date(results.generated_at).toLocaleString()}\n\n`;

    markdown += `## Summary\n\n`;
    markdown += `- **API Endpoints Modified:** ${results.summary.api_endpoints_modified}\n`;
    markdown += `- **API Endpoints Added:** ${results.summary.api_endpoints_added}\n`;
    markdown += `- **API Endpoints Removed:** ${results.summary.api_endpoints_removed}\n`;
    markdown += `- **Database Tables Modified:** ${results.summary.database_tables_modified}\n`;
    markdown += `- **Database Tables Added:** ${results.summary.database_tables_added}\n`;
    markdown += `- **Database Tables Removed:** ${results.summary.database_tables_removed}\n`;
    markdown += `- **Risk Level:** ${results.summary.risk_level}\n`;
    markdown += `- **Breaking Changes:** ${results.summary.breaking_changes ? 'Yes' : 'No'}\n\n`;

    if (results.summary.key_findings.length > 0) {
      markdown += `## Key Findings\n\n`;
      results.summary.key_findings.forEach((finding) => {
        markdown += `- ${finding}\n`;
      });
      markdown += '\n';
    }

    if (results.api_changes && results.api_changes.length > 0) {
      markdown += `## API Changes\n\n`;
      results.api_changes.forEach((change) => {
        markdown += `### ${change.endpoint}\n`;
        markdown += `- **Method:** ${change.method}\n`;
        markdown += `- **Type:** ${change.change_type}\n`;
        markdown += `- **Summary:** ${change.summary}\n\n`;
      });
    }

    if (results.database_changes && results.database_changes.length > 0) {
      markdown += `## Database Changes\n\n`;
      results.database_changes.forEach((change) => {
        markdown += `### ${change.table_name}\n`;
        markdown += `- **Type:** ${change.change_type}\n`;
        markdown += `- **Summary:** ${change.summary}\n\n`;
      });
    }

    return markdown;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-neutral-200 rounded w-1/4 animate-pulse"></div>
        <div className="h-40 bg-neutral-200 rounded animate-pulse"></div>
      </div>
    );
  }

  if (error || !results) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md flex items-start space-x-3">
        <AlertCircle className="text-red-600 mt-0.5 flex-shrink-0" size={20} />
        <div>
          <p className="font-medium text-red-900">Results not available</p>
          <p className="text-sm text-red-700">{error || 'Report not found'}</p>
        </div>
      </div>
    );
  }

  const currentRelease = request ? releases.get(request.current_release_id) : null;
  const targetRelease = request ? releases.get(request.target_release_id) : null;

  const filteredApiChanges = (results.api_changes || []).filter((c) => {
    if (apiFilter === 'all') return true;
    return c.change_type === apiFilter;
  });

  const filteredDbChanges = (results.database_changes || []).filter((c) => {
    if (dbFilter === 'all') return true;
    return c.change_type === dbFilter;
  });

  const getChangeColor = (type: string) => {
    switch (type) {
      case 'Added':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'Modified':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'Removed':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-neutral-50 text-neutral-700 border-neutral-200';
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {toast && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 mb-2">Assessment Results</h1>
            {request && (
              <p className="text-sm text-neutral-600">
                {currentRelease?.version} → {targetRelease?.version}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleDownload('markdown')}
              disabled={downloading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-300 text-white text-sm font-medium rounded-md transition-colors flex items-center space-x-2"
            >
              <Download size={18} />
              <span>Download</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-neutral-600 uppercase mb-2">API Endpoints</p>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-neutral-900">
              {results.summary.api_endpoints_modified}
            </span>
            <span className="text-sm text-neutral-600">modified</span>
          </div>
          <div className="mt-2 text-sm text-neutral-600">
            <span className="text-green-600">+{results.summary.api_endpoints_added}</span>
            {' / '}
            <span className="text-red-600">-{results.summary.api_endpoints_removed}</span>
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-neutral-600 uppercase mb-2">Database Tables</p>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-neutral-900">
              {results.summary.database_tables_modified}
            </span>
            <span className="text-sm text-neutral-600">modified</span>
          </div>
          <div className="mt-2 text-sm text-neutral-600">
            <span className="text-green-600">+{results.summary.database_tables_added}</span>
            {' / '}
            <span className="text-red-600">-{results.summary.database_tables_removed}</span>
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-neutral-600 uppercase mb-2">Risk Level</p>
          <div className="flex items-center space-x-2">
            <div
              className={`w-3 h-3 rounded-full ${
                results.summary.risk_level === 'High'
                  ? 'bg-red-500'
                  : results.summary.risk_level === 'Medium'
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
              }`}
            ></div>
            <span className="text-lg font-semibold text-neutral-900">
              {results.summary.risk_level}
            </span>
          </div>
          {results.summary.breaking_changes && (
            <p className="text-sm text-red-600 mt-2">Breaking changes detected</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border border-neutral-200 rounded-lg">
        <div className="flex border-b border-neutral-200">
          {['summary', 'api', 'database', 'raw'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as typeof activeTab)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {tab === 'summary' && 'Summary'}
              {tab === 'api' && 'API Impact'}
              {tab === 'database' && 'Database Impact'}
              {tab === 'raw' && 'Raw Data'}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Summary Tab */}
          {activeTab === 'summary' && (
            <div className="space-y-6">
              {results.summary.key_findings.length > 0 && (
                <div>
                  <h3 className="font-semibold text-neutral-900 mb-4">Key Findings</h3>
                  <ul className="space-y-2">
                    {results.summary.key_findings.map((finding, idx) => (
                      <li key={idx} className="flex items-start space-x-3">
                        <span className="text-blue-600 font-bold mt-0.5">•</span>
                        <span className="text-neutral-700">{finding}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="p-4 bg-neutral-50 rounded-md border border-neutral-200">
                <p className="text-sm text-neutral-900">
                  <span className="font-semibold">Breaking Changes:</span>{' '}
                  {results.summary.breaking_changes ? (
                    <span className="text-red-600 font-medium">Yes - Review carefully</span>
                  ) : (
                    <span className="text-green-600 font-medium">No - Safe to upgrade</span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* API Tab */}
          {activeTab === 'api' && (
            <div className="space-y-4">
              {results.api_changes && results.api_changes.length > 0 ? (
                <>
                  <div className="flex gap-2">
                    {['all', 'Added', 'Modified', 'Removed'].map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setApiFilter(filter === 'all' ? 'all' : (filter as any))}
                        className={`px-3 py-1 text-sm rounded-md transition-colors ${
                          apiFilter === filter
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                        }`}
                      >
                        {filter === 'all' ? 'All Changes' : filter}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-3">
                    {filteredApiChanges.map((change, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-lg border ${getChangeColor(change.change_type)}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-mono text-sm font-semibold">{change.endpoint}</p>
                            <p className="text-xs mt-1">
                              <span className="inline-block px-2 py-0.5 bg-white/50 rounded text-xs font-medium mr-2">
                                {change.method}
                              </span>
                              <span className="inline-block px-2 py-0.5 bg-white/50 rounded text-xs font-medium">
                                {change.change_type}
                              </span>
                            </p>
                          </div>
                        </div>
                        <p className="text-sm mt-3">{change.summary}</p>
                        {change.details && (
                          <details className="mt-3 text-sm">
                            <summary className="cursor-pointer font-medium hover:text-opacity-80">
                              View details
                            </summary>
                            <div className="mt-2 space-y-1 text-xs font-mono">
                              {change.details.parameters_changed && (
                                <p>Parameters: {change.details.parameters_changed.join(', ')}</p>
                              )}
                              {change.details.breaking_changes &&
                                change.details.breaking_changes.length > 0 && (
                                  <p className="text-red-700">
                                    Breaking: {change.details.breaking_changes.join(', ')}
                                  </p>
                                )}
                            </div>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-center py-8 text-neutral-600">No API changes in this release</p>
              )}
            </div>
          )}

          {/* Database Tab */}
          {activeTab === 'database' && (
            <div className="space-y-4">
              {results.database_changes && results.database_changes.length > 0 ? (
                <>
                  <div className="flex gap-2">
                    {['all', 'Added', 'Modified', 'Removed'].map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setDbFilter(filter === 'all' ? 'all' : (filter as any))}
                        className={`px-3 py-1 text-sm rounded-md transition-colors ${
                          dbFilter === filter
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                        }`}
                      >
                        {filter === 'all' ? 'All Changes' : filter}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-3">
                    {filteredDbChanges.map((change, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-lg border ${getChangeColor(change.change_type)}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-mono text-sm font-semibold">{change.table_name}</p>
                            <p className="text-xs mt-1">
                              <span className="inline-block px-2 py-0.5 bg-white/50 rounded text-xs font-medium">
                                {change.change_type}
                              </span>
                            </p>
                          </div>
                        </div>
                        <p className="text-sm mt-3">{change.summary}</p>
                        {change.details && (
                          <details className="mt-3 text-sm">
                            <summary className="cursor-pointer font-medium hover:text-opacity-80">
                              View details
                            </summary>
                            <div className="mt-2 space-y-1 text-xs font-mono">
                              {change.details.columns_added && change.details.columns_added.length > 0 && (
                                <p className="text-green-700">
                                  Columns added: {change.details.columns_added.join(', ')}
                                </p>
                              )}
                              {change.details.columns_removed && change.details.columns_removed.length > 0 && (
                                <p className="text-red-700">
                                  Columns removed: {change.details.columns_removed.join(', ')}
                                </p>
                              )}
                            </div>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-center py-8 text-neutral-600">No database changes in this release</p>
              )}
            </div>
          )}

          {/* Raw Data Tab */}
          {activeTab === 'raw' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(results.raw_data, null, 2));
                    setToast('Copied to clipboard');
                    setTimeout(() => setToast(null), 2000);
                  }}
                  className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-sm font-medium rounded-md flex items-center space-x-2"
                >
                  <Copy size={16} />
                  <span>Copy</span>
                </button>
              </div>
              <pre className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 overflow-auto max-h-96 text-xs font-mono text-neutral-700">
                {JSON.stringify(results.raw_data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
