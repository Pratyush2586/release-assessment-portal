import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Release, ReportType, Environment } from '../types';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, Upload, X } from 'lucide-react';

interface FormData {
  reportType: ReportType | '';
  currentReleaseId: string;
  targetReleaseId: string;
  title: string;
  environment: Environment;
  description: string;
  emailNotification: boolean;
  inappNotification: boolean;
}

interface FormErrors {
  reportType?: string;
  currentReleaseId?: string;
  targetReleaseId?: string;
  title?: string;
  description?: string;
  attachments?: string;
}

export const NewAssessment: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [attachments, setAttachments] = useState<File[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(
    null
  );

  const [formData, setFormData] = useState<FormData>({
    reportType: '',
    currentReleaseId: '',
    targetReleaseId: '',
    title: '',
    environment: 'Not Applicable',
    description: '',
    emailNotification: true,
    inappNotification: true,
  });

  useEffect(() => {
    const fetchReleases = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('releases')
          .select('*')
          .eq('is_active', true)
          .order('version', { ascending: false });

        if (error) throw error;
        setReleases(data || []);
      } catch (err) {
        setToast({
          message: err instanceof Error ? err.message : 'Failed to load releases',
          type: 'error',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchReleases();
  }, []);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.reportType) {
      newErrors.reportType = 'Please select a report type';
    }
    if (!formData.currentReleaseId) {
      newErrors.currentReleaseId = 'Please select your current release';
    }
    if (!formData.targetReleaseId) {
      newErrors.targetReleaseId = 'Please select a target release';
    }
    if (formData.currentReleaseId && formData.targetReleaseId) {
      const currentRelease = releases.find((r) => r.id === formData.currentReleaseId);
      const targetRelease = releases.find((r) => r.id === formData.targetReleaseId);

      if (currentRelease && targetRelease) {
        if (currentRelease.version >= targetRelease.version) {
          newErrors.targetReleaseId = 'Target release must be newer than current release';
        }
      }
    }
    if (formData.title && formData.title.length > 100) {
      newErrors.title = 'Title cannot exceed 100 characters';
    }
    if (formData.description && formData.description.length > 1000) {
      newErrors.description = 'Description cannot exceed 1000 characters';
    }

    const totalSize = attachments.reduce((sum, file) => sum + file.size, 0);
    if (attachments.length > 5) {
      newErrors.attachments = 'Maximum 5 files allowed';
    }
    if (totalSize > 50 * 1024 * 1024) {
      newErrors.attachments = 'Total file size cannot exceed 50MB';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter((file) => {
      const validTypes = ['application/pdf', 'text/plain', 'text/markdown', 'application/json', 'application/xml', 'text/xml'];
      return validTypes.includes(file.type) && file.size <= 10 * 1024 * 1024;
    });

    if (validFiles.length < files.length) {
      setErrors((prev) => ({
        ...prev,
        attachments: 'Some files were rejected. Only PDF, TXT, MD, JSON, XML files up to 10MB are allowed.',
      }));
    } else {
      setErrors((prev) => {
        const { attachments, ...rest } = prev;
        return rest;
      });
    }

    setAttachments((prev) => [...prev, ...validFiles]);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    if (!user) return;

    try {
      setSubmitting(true);

      const { data, error } = await supabase
        .from('assessment_requests')
        .insert([
          {
            user_id: user.id,
            report_type: formData.reportType,
            current_release_id: formData.currentReleaseId,
            target_release_id: formData.targetReleaseId,
            title: formData.title || null,
            environment: formData.environment,
            description: formData.description || null,
            email_notification: formData.emailNotification,
            inapp_notification: formData.inappNotification,
          },
        ])
        .select('id')
        .single();

      if (error) throw error;

      if (data && attachments.length > 0) {
        for (const file of attachments) {
          const filePath = `${user.id}/${data.id}/${file.name}`;
          await supabase.storage.from('attachments').upload(filePath, file);

          await supabase.from('attachments').insert([
            {
              request_id: data.id,
              filename: file.name,
              file_path: filePath,
              file_size: file.size,
              file_type: file.type,
            },
          ]);
        }
      }

      setToast({
        message: `Assessment request submitted successfully. Request #${data.id.slice(0, 8).toUpperCase()}`,
        type: 'success',
      });

      setTimeout(() => {
        navigate(`/request/${data.id}`);
      }, 1500);
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to submit request',
        type: 'error',
      });
    } finally {
      setSubmitting(false);
      setShowConfirm(false);
    }
  };

  const currentRelease = releases.find((r) => r.id === formData.currentReleaseId);
  const targetRelease = releases.find((r) => r.id === formData.targetReleaseId);
  const availableTargets = releases.filter(
    (r) => !formData.currentReleaseId || !currentRelease || r.version > currentRelease.version
  );

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-900 mb-2">New Impact Assessment</h1>
        <p className="text-neutral-600">Create a new assessment request to compare releases</p>
      </div>

      {toast && (
        <div
          className={`mb-6 p-4 rounded-md flex items-center space-x-3 ${
            toast.type === 'error'
              ? 'bg-red-50 border border-red-200'
              : 'bg-green-50 border border-green-200'
          }`}
        >
          <AlertCircle
            size={20}
            className={toast.type === 'error' ? 'text-red-600' : 'text-green-600'}
          />
          <p className={toast.type === 'error' ? 'text-red-700' : 'text-green-700'}>
            {toast.message}
          </p>
        </div>
      )}

      {Object.keys(errors).length > 0 && !showConfirm && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm font-medium text-red-900">
            Please fix {Object.keys(errors).length} error{Object.keys(errors).length > 1 ? 's' : ''} below
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8 bg-white p-8 rounded-lg border border-neutral-200">
        {/* Report Type Section */}
        <div>
          <label className="block text-sm font-semibold text-neutral-900 mb-4">
            What type of impact assessment do you need?
          </label>
          {errors.reportType && (
            <p className="text-sm text-red-600 mb-3">{errors.reportType}</p>
          )}
          <div className="space-y-3">
            {[
              {
                value: 'API' as ReportType,
                label: 'API Impact',
                description: 'Analyze changes to REST API endpoints, parameters, and responses',
              },
              {
                value: 'Database' as ReportType,
                label: 'Database Impact',
                description: 'Review database schema changes, table modifications, and migrations',
              },
              {
                value: 'API + Database' as ReportType,
                label: 'API + Database',
                description: 'Combined assessment of both API and database changes',
              },
            ].map((option) => (
              <label key={option.value} className="flex items-start space-x-3 p-3 border rounded-md hover:bg-neutral-50 cursor-pointer">
                <input
                  type="radio"
                  name="reportType"
                  value={option.value}
                  checked={formData.reportType === option.value}
                  onChange={(e) => setFormData((prev) => ({ ...prev, reportType: e.target.value as ReportType }))}
                  className="mt-1"
                />
                <div>
                  <p className="font-medium text-neutral-900">{option.label}</p>
                  <p className="text-sm text-neutral-600">{option.description}</p>
                </div>
              </label>
            ))}
          </div>
          <p className="text-sm text-neutral-600 mt-3">
            You can download separate or combined reports after completion.
          </p>
        </div>

        {/* Release Selection */}
        <div className="space-y-6">
          <div>
            <label htmlFor="current-release" className="block text-sm font-semibold text-neutral-900 mb-2">
              Current Release <span className="text-red-500">*</span>
            </label>
            {errors.currentReleaseId && (
              <p className="text-sm text-red-600 mb-2">{errors.currentReleaseId}</p>
            )}
            <select
              id="current-release"
              value={formData.currentReleaseId}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  currentReleaseId: e.target.value,
                  targetReleaseId: '',
                }))
              }
              className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select current release</option>
              {releases.map((release) => (
                <option key={release.id} value={release.id}>
                  {release.version}
                </option>
              ))}
            </select>
            <p className="text-sm text-neutral-600 mt-2">The release currently deployed</p>
          </div>

          <div>
            <label htmlFor="target-release" className="block text-sm font-semibold text-neutral-900 mb-2">
              Target Release <span className="text-red-500">*</span>
            </label>
            {errors.targetReleaseId && (
              <p className="text-sm text-red-600 mb-2">{errors.targetReleaseId}</p>
            )}
            <select
              id="target-release"
              value={formData.targetReleaseId}
              onChange={(e) => setFormData((prev) => ({ ...prev, targetReleaseId: e.target.value }))}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!formData.currentReleaseId}
            >
              <option value="">Select target release</option>
              {availableTargets.map((release) => (
                <option key={release.id} value={release.id}>
                  {release.version}
                </option>
              ))}
            </select>
            <p className="text-sm text-neutral-600 mt-2">
              {!formData.currentReleaseId
                ? 'Select a current release first'
                : availableTargets.length === 0
                  ? 'No newer releases available'
                  : 'The release you are planning to upgrade to'}
            </p>
          </div>
        </div>

        {/* Assessment Details */}
        <div className="space-y-6 border-t border-neutral-200 pt-8">
          <h3 className="text-sm font-semibold text-neutral-900">Assessment Details</h3>

          <div>
            <label htmlFor="title" className="block text-sm font-medium text-neutral-900 mb-2">
              Request Title <span className="text-neutral-500 text-xs">(optional)</span>
            </label>
            {errors.title && <p className="text-sm text-red-600 mb-2">{errors.title}</p>}
            <input
              id="title"
              type="text"
              placeholder="e.g., Q1 Production Upgrade Assessment"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value.slice(0, 100) }))}
              maxLength={100}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-neutral-600 mt-2">
              {formData.title.length}/100 characters
            </p>
          </div>

          <div>
            <label htmlFor="environment" className="block text-sm font-medium text-neutral-900 mb-2">
              Environment <span className="text-neutral-500 text-xs">(optional)</span>
            </label>
            <select
              id="environment"
              value={formData.environment}
              onChange={(e) => setFormData((prev) => ({ ...prev, environment: e.target.value as Environment }))}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Development">Development</option>
              <option value="Test">Test</option>
              <option value="Staging">Staging</option>
              <option value="Production">Production</option>
              <option value="Not Applicable">Not Applicable</option>
            </select>
            <p className="text-sm text-neutral-600 mt-2">Target environment for this upgrade</p>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-neutral-900 mb-2">
              Description <span className="text-neutral-500 text-xs">(optional)</span>
            </label>
            {errors.description && <p className="text-sm text-red-600 mb-2">{errors.description}</p>}
            <textarea
              id="description"
              placeholder="Add any context or special requirements for this assessment..."
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value.slice(0, 1000) }))}
              maxLength={1000}
              rows={4}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
            />
            <p className="text-xs text-neutral-600 mt-2">
              {formData.description.length}/1000 characters
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-900 mb-3">
              Attachments <span className="text-neutral-500 text-xs">(optional)</span>
            </label>
            {errors.attachments && <p className="text-sm text-red-600 mb-3">{errors.attachments}</p>}

            <div className="border-2 border-dashed border-neutral-300 rounded-lg p-6 text-center hover:border-neutral-400 transition-colors">
              <Upload className="mx-auto text-neutral-400 mb-2" size={24} />
              <label className="cursor-pointer">
                <span className="text-sm font-medium text-blue-600 hover:text-blue-700">
                  Click to upload
                </span>
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".pdf,.txt,.md,.json,.xml"
                />
              </label>
              <p className="text-xs text-neutral-600 mt-2">
                PDF, TXT, MD, JSON, or XML files up to 10MB each
              </p>
            </div>

            {attachments.length > 0 && (
              <div className="mt-4 space-y-2">
                {attachments.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-neutral-50 rounded border border-neutral-200">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-neutral-900">{file.name}</p>
                      <p className="text-xs text-neutral-600">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="p-1 text-neutral-600 hover:text-red-600"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Notifications */}
        <div className="border-t border-neutral-200 pt-8">
          <h3 className="text-sm font-semibold text-neutral-900 mb-4">Notification Preferences</h3>
          <p className="text-sm text-neutral-600 mb-4">
            How would you like to be notified when the report is ready?
          </p>
          <div className="space-y-3">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.emailNotification}
                onChange={(e) => setFormData((prev) => ({ ...prev, emailNotification: e.target.checked }))}
                className="w-4 h-4 rounded border-neutral-300"
              />
              <span className="text-sm text-neutral-900">Email notification</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.inappNotification}
                onChange={(e) => setFormData((prev) => ({ ...prev, inappNotification: e.target.checked }))}
                className="w-4 h-4 rounded border-neutral-300"
              />
              <span className="text-sm text-neutral-900">In-app notification</span>
            </label>
          </div>
        </div>

        {/* Form Actions */}
        <div className="border-t border-neutral-200 pt-8 flex gap-3 justify-end">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 text-neutral-700 hover:text-neutral-900 font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || submitting}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-300 text-white font-medium rounded-md transition-colors"
          >
            Review Request
          </button>
        </div>
      </form>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-neutral-900 mb-4">Review Assessment Request</h2>

            <div className="space-y-4 mb-6 bg-neutral-50 p-4 rounded-md">
              <div>
                <p className="text-xs font-semibold text-neutral-600 uppercase">Report Type</p>
                <p className="text-neutral-900">{formData.reportType}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-neutral-600 uppercase">Releases</p>
                <p className="text-neutral-900">
                  {currentRelease?.version} → {targetRelease?.version}
                </p>
              </div>
              {formData.environment !== 'Not Applicable' && (
                <div>
                  <p className="text-xs font-semibold text-neutral-600 uppercase">Environment</p>
                  <p className="text-neutral-900">{formData.environment}</p>
                </div>
              )}
              {formData.title && (
                <div>
                  <p className="text-xs font-semibold text-neutral-600 uppercase">Title</p>
                  <p className="text-neutral-900">{formData.title}</p>
                </div>
              )}
              {attachments.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-neutral-600 uppercase">Attachments</p>
                  <p className="text-neutral-900">{attachments.length} file{attachments.length > 1 ? 's' : ''}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2 text-neutral-700 hover:text-neutral-900 font-medium border border-neutral-300 rounded-md"
              >
                Edit
              </button>
              <button
                onClick={handleConfirm}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-300 text-white font-medium rounded-md transition-colors"
              >
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
