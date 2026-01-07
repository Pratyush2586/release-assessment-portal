import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { AssessmentRequest, Release, Attachment } from '../types';
import { AlertCircle, Copy, Share2, Trash2, ArrowRight } from 'lucide-react';

export const RequestDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [request, setRequest] = useState<AssessmentRequest | null>(null);
  const [releases, setReleases] = useState<Map<string, Release>>(new Map());
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [canceling, setCanceling] = useState(false);

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

        const { data: releasesData, error: releasesError } = await supabase
          .from('releases')
          .select('*');

        if (releasesError) throw releasesError;

        const releaseMap = new Map((releasesData || []).map((r) => [r.id, r]));
        setReleases(releaseMap);

        const { data: attachmentsData, error: attachmentsError } = await supabase
          .from('attachments')
          .select('*')
          .eq('request_id', id);

        if (attachmentsError) throw attachmentsError;
        setAttachments(attachmentsData || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load request');
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    const subscription = supabase
      .channel(`request_${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'assessment_requests',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          setRequest(payload.new as AssessmentRequest);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [id]);

  const handleCopy = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setToast('Link copied to clipboard');
    setTimeout(() => setToast(null), 2000);
  };

  const handleCancel = async () => {
    if (!request) return;

    try {
      setCanceling(true);
      const { error } = await supabase
        .from('assessment_requests')
        .update({ status: 'Failed', error_message: 'Canceled by user' })
        .eq('id', request.id);

      if (error) throw error;

      setToast('Request canceled');
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err) {
      setToast('Failed to cancel request');
    } finally {
      setCanceling(false);
      setCancelConfirm(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Queued':
        return { bg: 'bg-neutral-100', text: 'text-neutral-700', border: 'border-neutral-300' };
      case 'Running':
        return { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' };
      case 'Completed':
        return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' };
      case 'Failed':
        return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' };
      default:
        return { bg: 'bg-neutral-100', text: 'text-neutral-700', border: 'border-neutral-300' };
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-neutral-200 rounded w-1/4 animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-neutral-200 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md flex items-start space-x-3">
        <AlertCircle className="text-red-600 mt-0.5 flex-shrink-0" size={20} />
        <div>
          <p className="font-medium text-red-900">Unable to load request</p>
          <p className="text-sm text-red-700">{error || 'Request not found'}</p>
        </div>
      </div>
    );
  }

  const currentRelease = releases.get(request.current_release_id);
  const targetRelease = releases.get(request.target_release_id);
  const statusColor = getStatusColor(request.status);
  const isCompleted = request.status === 'Completed';
  const isFailed = request.status === 'Failed';
  const isRunning = request.status === 'Running';

  const getTimelineSteps = () => {
    const steps = [
      { name: 'Queued', completed: true, current: request.status === 'Queued' },
      { name: 'Running', completed: isCompleted || isFailed, current: isRunning },
      { name: 'Completed', completed: isCompleted, current: false },
    ];
    return steps;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {toast && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-md text-blue-700 text-sm">
          {toast}
        </div>
      )}

      {/* Header Card */}
      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <h1 className="text-2xl font-bold text-neutral-900">Request</h1>
              <code className="bg-neutral-100 px-3 py-1 rounded text-sm font-mono text-neutral-700">
                #{request.id.slice(0, 8).toUpperCase()}
              </code>
              <button
                onClick={handleCopy}
                className="p-1 text-neutral-600 hover:text-neutral-900"
                title="Copy link"
              >
                <Copy size={18} />
              </button>
            </div>
            {request.title && <p className="text-neutral-600">{request.title}</p>}
          </div>
          <div className="flex items-center space-x-2">
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium border ${statusColor.bg} ${statusColor.text} ${statusColor.border}`}
            >
              {request.status}
            </span>
            {isRunning && <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>}
          </div>
        </div>
      </div>

      {/* Metadata Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-neutral-600 uppercase mb-1">Report Type</p>
          <p className="text-neutral-900 font-medium">{request.report_type}</p>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-neutral-600 uppercase mb-1">Releases</p>
          <p className="text-neutral-900 font-medium flex items-center space-x-2">
            <span>{currentRelease?.version || '?'}</span>
            <ArrowRight size={16} className="text-neutral-400" />
            <span>{targetRelease?.version || '?'}</span>
          </p>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-neutral-600 uppercase mb-1">Environment</p>
          <p className="text-neutral-900 font-medium">{request.environment}</p>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-neutral-600 uppercase mb-1">Submitted</p>
          <p className="text-neutral-900 font-medium">
            {new Date(request.created_at).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <h3 className="font-semibold text-neutral-900 mb-6">Status Timeline</h3>
        <div className="flex items-center justify-between">
          {getTimelineSteps().map((step, index) => (
            <React.Fragment key={step.name}>
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm mb-2 ${
                    step.completed || step.current
                      ? 'bg-green-100 text-green-700'
                      : 'bg-neutral-100 text-neutral-600'
                  }`}
                >
                  {step.completed ? '✓' : step.current ? '◐' : '○'}
                </div>
                <p className="text-xs font-medium text-neutral-700">{step.name}</p>
              </div>
              {index < getTimelineSteps().length - 1 && (
                <div className="flex-1 h-1 mx-4 mb-8 bg-neutral-200"></div>
              )}
            </React.Fragment>
          ))}
        </div>

        {isRunning && (
          <div className="mt-6 p-4 bg-blue-50 rounded-md border border-blue-200">
            <p className="text-sm text-blue-900">
              Assessment is currently being generated.
              <br />
              <span className="text-xs text-blue-700">Estimated completion: 10-15 minutes</span>
            </p>
          </div>
        )}

        {isFailed && request.error_message && (
          <div className="mt-6 p-4 bg-red-50 rounded-md border border-red-200">
            <p className="text-sm font-medium text-red-900">Assessment failed</p>
            <p className="text-sm text-red-700 mt-1">{request.error_message}</p>
            <button className="mt-3 text-sm text-red-600 hover:text-red-700 font-medium">
              Retry
            </button>
          </div>
        )}
      </div>

      {/* Description */}
      {request.description && (
        <div className="bg-white border border-neutral-200 rounded-lg p-6">
          <h3 className="font-semibold text-neutral-900 mb-3">Description</h3>
          <p className="text-neutral-700 whitespace-pre-wrap">{request.description}</p>
        </div>
      )}

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-lg p-6">
          <h3 className="font-semibold text-neutral-900 mb-4">Attachments ({attachments.length})</h3>
          <div className="space-y-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center justify-between p-3 bg-neutral-50 rounded border border-neutral-200"
              >
                <div>
                  <p className="text-sm font-medium text-neutral-900">{attachment.filename}</p>
                  <p className="text-xs text-neutral-600">
                    {(attachment.file_size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {isCompleted && (
          <Link
            to={`/request/${request.id}/results`}
            className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors text-center"
          >
            View Results
          </Link>
        )}

        <button
          onClick={handleCopy}
          className="px-4 py-3 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 font-medium rounded-md transition-colors flex items-center justify-center space-x-2"
        >
          <Share2 size={18} />
          <span>Share Link</span>
        </button>

        {(request.status === 'Queued' || request.status === 'Running') && (
          <button
            onClick={() => setCancelConfirm(true)}
            className="px-4 py-3 bg-white border border-red-300 hover:bg-red-50 text-red-700 font-medium rounded-md transition-colors flex items-center justify-center space-x-2"
          >
            <Trash2 size={18} />
            <span>Cancel</span>
          </button>
        )}
      </div>

      {/* Cancel Confirmation Modal */}
      {cancelConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <h2 className="text-lg font-bold text-neutral-900 mb-4">Cancel Request?</h2>
            <p className="text-neutral-600 mb-6">
              Are you sure you want to cancel this request? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setCancelConfirm(false)}
                className="flex-1 px-4 py-2 text-neutral-700 hover:text-neutral-900 font-medium border border-neutral-300 rounded-md"
              >
                Keep Request
              </button>
              <button
                onClick={handleCancel}
                disabled={canceling}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-neutral-300 text-white font-medium rounded-md transition-colors"
              >
                {canceling ? 'Canceling...' : 'Cancel Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
