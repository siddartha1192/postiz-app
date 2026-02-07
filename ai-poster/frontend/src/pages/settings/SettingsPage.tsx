import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  User,
  Users,
  Settings2,
  Save,
  Trash2,
  Plus,
  Shield,
  Key,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Zap,
  Copy,
  Link2,
  Webhook,
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Tabs } from '@/components/ui/Tabs';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/hooks/useAuth';
import { fetchApi } from '@/lib/api';
import { Platform } from '@ai-poster/shared';
import {
  PLATFORM_ICON_COLORS,
  PLATFORM_DISPLAY_NAMES,
} from '@/lib/constants';
import toast from 'react-hot-toast';

const settingsTabs = [
  { id: 'profile', label: 'Profile', icon: <User className="h-4 w-4" /> },
  { id: 'team', label: 'Team', icon: <Users className="h-4 w-4" /> },
  { id: 'defaults', label: 'Defaults', icon: <Settings2 className="h-4 w-4" /> },
  { id: 'credentials', label: 'Credentials', icon: <Key className="h-4 w-4" /> },
];

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
  avatar?: string;
}

interface CredentialField {
  key: string;
  label: string;
  type: string;
  placeholder: string;
}

interface PlatformCredentialData {
  credentials: Record<string, string>;
  label: string;
  isActive: boolean;
}

const PLATFORM_CREDENTIAL_FIELDS: Record<string, CredentialField[]> = {
  TWITTER: [
    { key: 'clientId', label: 'Client ID', type: 'text', placeholder: 'Your Twitter API Client ID' },
    { key: 'clientSecret', label: 'Client Secret', type: 'password', placeholder: 'Your Twitter API Client Secret' },
  ],
  LINKEDIN: [
    { key: 'clientId', label: 'Client ID', type: 'text', placeholder: 'Your LinkedIn Client ID' },
    { key: 'clientSecret', label: 'Client Secret', type: 'password', placeholder: 'Your LinkedIn Client Secret' },
  ],
  LINKEDIN_PAGE: [
    { key: 'clientId', label: 'Client ID', type: 'text', placeholder: 'Your LinkedIn Client ID' },
    { key: 'clientSecret', label: 'Client Secret', type: 'password', placeholder: 'Your LinkedIn Client Secret' },
  ],
  FACEBOOK: [
    { key: 'clientId', label: 'Client ID', type: 'text', placeholder: 'Your Facebook App ID' },
    { key: 'clientSecret', label: 'Client Secret', type: 'password', placeholder: 'Your Facebook App Secret' },
  ],
  INSTAGRAM: [
    { key: 'clientId', label: 'Client ID', type: 'text', placeholder: 'Your Instagram App ID' },
    { key: 'clientSecret', label: 'Client Secret', type: 'password', placeholder: 'Your Instagram App Secret' },
  ],
  YOUTUBE: [
    { key: 'clientId', label: 'Client ID', type: 'text', placeholder: 'Your YouTube/Google Client ID' },
    { key: 'clientSecret', label: 'Client Secret', type: 'password', placeholder: 'Your YouTube/Google Client Secret' },
  ],
  TIKTOK: [
    { key: 'clientId', label: 'Client ID', type: 'text', placeholder: 'Your TikTok Client Key' },
    { key: 'clientSecret', label: 'Client Secret', type: 'password', placeholder: 'Your TikTok Client Secret' },
  ],
  REDDIT: [
    { key: 'clientId', label: 'Client ID', type: 'text', placeholder: 'Your Reddit App ID' },
    { key: 'clientSecret', label: 'Client Secret', type: 'password', placeholder: 'Your Reddit App Secret' },
  ],
  PINTEREST: [
    { key: 'clientId', label: 'Client ID', type: 'text', placeholder: 'Your Pinterest App ID' },
    { key: 'clientSecret', label: 'Client Secret', type: 'password', placeholder: 'Your Pinterest App Secret' },
  ],
  THREADS: [
    { key: 'clientId', label: 'Client ID', type: 'text', placeholder: 'Your Threads/Meta App ID' },
    { key: 'clientSecret', label: 'Client Secret', type: 'password', placeholder: 'Your Threads/Meta App Secret' },
  ],
  DISCORD: [
    { key: 'botToken', label: 'Bot Token', type: 'password', placeholder: 'Your Discord Bot Token' },
    { key: 'applicationId', label: 'Application ID', type: 'text', placeholder: 'Your Discord Application ID' },
  ],
  SLACK: [
    { key: 'botToken', label: 'Bot Token', type: 'password', placeholder: 'Your Slack Bot Token (xoxb-...)' },
    { key: 'signingSecret', label: 'Signing Secret', type: 'password', placeholder: 'Your Slack Signing Secret' },
  ],
  MASTODON: [
    { key: 'instanceUrl', label: 'Instance URL', type: 'text', placeholder: 'https://mastodon.social' },
    { key: 'accessToken', label: 'Access Token', type: 'password', placeholder: 'Your Mastodon Access Token' },
  ],
  BLUESKY: [
    { key: 'handle', label: 'Handle', type: 'text', placeholder: 'your-handle.bsky.social' },
    { key: 'appPassword', label: 'App Password', type: 'password', placeholder: 'Your Bluesky App Password' },
  ],
  DRIBBBLE: [
    { key: 'clientId', label: 'Client ID', type: 'text', placeholder: 'Your Dribbble Client ID' },
    { key: 'clientSecret', label: 'Client Secret', type: 'password', placeholder: 'Your Dribbble Client Secret' },
  ],
};

// Platforms that require webhook configuration
const WEBHOOK_PLATFORMS: Record<string, { path: string; verifyTokenEnv: string; defaultVerifyToken: string }> = {
  FACEBOOK: {
    path: '/api/integrations/webhooks/facebook',
    verifyTokenEnv: 'FACEBOOK_WEBHOOK_VERIFY_TOKEN',
    defaultVerifyToken: 'postiz_webhook_verify',
  },
};

// Helper to get the base URL from window.location
function getBaseUrl(): string {
  return `${window.location.protocol}//${window.location.host}`;
}

function CopyableUrl({ label, url, icon }: { label: string; url: string; icon?: React.ReactNode }) {
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(url).then(
      () => toast.success(`${label} copied to clipboard`),
      () => toast.error('Failed to copy'),
    );
  };

  return (
    <div className="flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50/50 p-3">
      <div className="mt-0.5 text-blue-500">
        {icon || <Link2 className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-blue-700">{label}</p>
        <p className="mt-0.5 break-all font-mono text-xs text-blue-600">
          {url}
        </p>
      </div>
      <button
        onClick={handleCopy}
        className="mt-0.5 rounded p-1 text-blue-400 hover:bg-blue-100 hover:text-blue-600"
        title="Copy to clipboard"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

const ALL_PLATFORMS = Object.values(Platform);

function getPlatformAbbreviation(platform: Platform): string {
  const name = PLATFORM_DISPLAY_NAMES[platform] || platform;
  const words = name.replace(/[()]/g, '').split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function SettingsPage() {
  const { user, organization } = useAuth();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'profile';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Profile state
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [timezone, setTimezone] = useState(user?.timezone || 'UTC');
  const [saving, setSaving] = useState(false);

  // Team state
  const [teamMembers] = useState<TeamMember[]>([]);
  const [inviteModal, setInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');

  // Defaults state
  const [defaultTimezone, setDefaultTimezone] = useState('UTC');
  const [defaultLanguage, setDefaultLanguage] = useState('en');
  const [autoApprove, setAutoApprove] = useState(false);

  // Credentials state
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);
  const [credentialValues, setCredentialValues] = useState<
    Record<string, PlatformCredentialData>
  >({});
  const [savingCredential, setSavingCredential] = useState<string | null>(null);
  const [deletingCredential, setDeletingCredential] = useState<string | null>(null);
  const [testingCredential, setTestingCredential] = useState<string | null>(null);

  const fetchCredentials = useCallback(async () => {
    try {
      const data = await fetchApi<
        Record<string, { credentials: Record<string, string>; label: string; isActive: boolean }>
      >('/platform-credentials');
      if (data) {
        const mapped: Record<string, PlatformCredentialData> = {};
        for (const [platform, value] of Object.entries(data)) {
          mapped[platform] = {
            credentials: value.credentials || {},
            label: value.label || '',
            isActive: value.isActive ?? true,
          };
        }
        setCredentialValues((prev) => {
          const merged = { ...prev };
          for (const [platform, value] of Object.entries(mapped)) {
            merged[platform] = value;
          }
          return merged;
        });
      }
    } catch {
      // Silently fail on initial load - credentials may not exist yet
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'credentials') {
      fetchCredentials();
    }
  }, [activeTab, fetchCredentials]);

  const getCredentialData = (platform: string): PlatformCredentialData => {
    return credentialValues[platform] || { credentials: {}, label: '', isActive: true };
  };

  const updateCredentialField = (platform: string, fieldKey: string, value: string) => {
    setCredentialValues((prev) => {
      const current = prev[platform] || { credentials: {}, label: '', isActive: true };
      return {
        ...prev,
        [platform]: {
          ...current,
          credentials: {
            ...current.credentials,
            [fieldKey]: value,
          },
        },
      };
    });
  };

  const updateCredentialLabel = (platform: string, label: string) => {
    setCredentialValues((prev) => {
      const current = prev[platform] || { credentials: {}, label: '', isActive: true };
      return {
        ...prev,
        [platform]: { ...current, label },
      };
    });
  };

  const updateCredentialActive = (platform: string, isActive: boolean) => {
    setCredentialValues((prev) => {
      const current = prev[platform] || { credentials: {}, label: '', isActive: true };
      return {
        ...prev,
        [platform]: { ...current, isActive },
      };
    });
  };

  const isConfigured = (platform: string): boolean => {
    const data = credentialValues[platform];
    if (!data) return false;
    const fields = PLATFORM_CREDENTIAL_FIELDS[platform] || [];
    return fields.every((f) => !!data.credentials[f.key]);
  };

  const handleSaveCredential = async (platform: string) => {
    setSavingCredential(platform);
    try {
      const data = getCredentialData(platform);
      await fetchApi(`/platform-credentials/${platform}`, {
        method: 'PUT',
        body: JSON.stringify({
          credentials: data.credentials,
          label: data.label,
          isActive: data.isActive,
        }),
      });
      toast.success(`${PLATFORM_DISPLAY_NAMES[platform as Platform] || platform} credentials saved`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save credentials');
    } finally {
      setSavingCredential(null);
    }
  };

  const handleDeleteCredential = async (platform: string) => {
    setDeletingCredential(platform);
    try {
      await fetchApi(`/platform-credentials/${platform}`, {
        method: 'DELETE',
      });
      setCredentialValues((prev) => {
        const next = { ...prev };
        delete next[platform];
        return next;
      });
      toast.success(`${PLATFORM_DISPLAY_NAMES[platform as Platform] || platform} credentials removed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete credentials');
    } finally {
      setDeletingCredential(null);
    }
  };

  const handleTestCredential = async (platform: string) => {
    setTestingCredential(platform);
    try {
      await fetchApi(`/platform-credentials/${platform}/test`, {
        method: 'POST',
      });
      toast.success(`${PLATFORM_DISPLAY_NAMES[platform as Platform] || platform} connection successful`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Connection test failed');
    } finally {
      setTestingCredential(null);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await fetchApi('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name, timezone }),
      });
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleInvite = async () => {
    try {
      await fetchApi('/team/invite', {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      toast.success('Invitation sent');
      setInviteModal(false);
      setInviteEmail('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invite');
    }
  };

  const handleSaveDefaults = async () => {
    setSaving(true);
    try {
      await fetchApi('/settings/defaults', {
        method: 'PUT',
        body: JSON.stringify({
          timezone: defaultTimezone,
          language: defaultLanguage,
          autoApprove,
        }),
      });
      toast.success('Defaults saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save defaults');
    } finally {
      setSaving(false);
    }
  };

  const timezoneOptions = [
    { value: 'UTC', label: 'UTC' },
    { value: 'America/New_York', label: 'Eastern Time (US)' },
    { value: 'America/Chicago', label: 'Central Time (US)' },
    { value: 'America/Denver', label: 'Mountain Time (US)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (US)' },
    { value: 'Europe/London', label: 'London' },
    { value: 'Europe/Paris', label: 'Central European Time' },
    { value: 'Asia/Tokyo', label: 'Tokyo' },
    { value: 'Asia/Shanghai', label: 'Shanghai' },
    { value: 'Australia/Sydney', label: 'Sydney' },
  ];

  return (
    <div className="page-container max-w-3xl space-y-6">
      <div>
        <h2 className="section-title">Settings</h2>
        <p className="subtle-text mt-1">
          Manage your profile, team, and preferences.
        </p>
      </div>

      <Tabs items={settingsTabs} activeId={activeTab} onChange={setActiveTab} />

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <Card>
          <CardHeader>Profile Information</CardHeader>
          <CardBody className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar src={user?.avatar} name={user?.name || 'User'} size="lg" />
              <div>
                <p className="font-medium text-text-primary">{user?.name}</p>
                <p className="text-sm text-text-muted">{user?.email}</p>
              </div>
            </div>

            <Input
              label="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              label="Email"
              type="email"
              value={email}
              disabled
              hint="Email cannot be changed"
            />
            <Select
              label="Timezone"
              options={timezoneOptions}
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            />

            <div className="flex justify-end">
              <Button
                icon={<Save className="h-4 w-4" />}
                onClick={handleSaveProfile}
                loading={saving}
              >
                Save Changes
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Team Tab */}
      {activeTab === 'team' && (
        <div className="space-y-5">
          <Card>
            <CardHeader
              action={
                <Button
                  size="sm"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() => setInviteModal(true)}
                >
                  Invite Member
                </Button>
              }
            >
              Team Members
            </CardHeader>
            <CardBody>
              {/* Current user always shown */}
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-gray-50 p-3">
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={user?.avatar}
                      name={user?.name || 'User'}
                      size="sm"
                    />
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {user?.name} <span className="text-text-muted">(you)</span>
                      </p>
                      <p className="text-xs text-text-muted">{user?.email}</p>
                    </div>
                  </div>
                  <Badge variant="approved">
                    <Shield className="mr-1 h-3 w-3" />
                    Admin
                  </Badge>
                </div>

                {teamMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded-lg border border-gray-50 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={member.avatar}
                        name={member.name}
                        size="sm"
                      />
                      <div>
                        <p className="text-sm font-medium text-text-primary">
                          {member.name}
                        </p>
                        <p className="text-xs text-text-muted">{member.email}</p>
                      </div>
                    </div>
                    <Badge variant={member.role === 'ADMIN' ? 'approved' : 'default'}>
                      {member.role}
                    </Badge>
                  </div>
                ))}

                {teamMembers.length === 0 && (
                  <p className="py-4 text-center text-sm text-text-muted">
                    No additional team members. Invite someone to get started.
                  </p>
                )}
              </div>
            </CardBody>
          </Card>

          {/* Invite Modal */}
          <Modal
            open={inviteModal}
            onClose={() => setInviteModal(false)}
            title="Invite Team Member"
            footer={
              <>
                <Button variant="outline" onClick={() => setInviteModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleInvite} disabled={!inviteEmail}>
                  Send Invitation
                </Button>
              </>
            }
          >
            <div className="space-y-4">
              <Input
                label="Email Address"
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <Select
                label="Role"
                options={[
                  { value: 'MEMBER', label: 'Member' },
                  { value: 'ADMIN', label: 'Admin' },
                ]}
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
              />
            </div>
          </Modal>
        </div>
      )}

      {/* Defaults Tab */}
      {activeTab === 'defaults' && (
        <Card>
          <CardHeader>Default Settings</CardHeader>
          <CardBody className="space-y-5">
            <Select
              label="Default Timezone"
              options={timezoneOptions}
              value={defaultTimezone}
              onChange={(e) => setDefaultTimezone(e.target.value)}
            />
            <Select
              label="Default Language"
              options={[
                { value: 'en', label: 'English' },
                { value: 'es', label: 'Spanish' },
                { value: 'fr', label: 'French' },
                { value: 'de', label: 'German' },
                { value: 'pt', label: 'Portuguese' },
                { value: 'ja', label: 'Japanese' },
                { value: 'ko', label: 'Korean' },
                { value: 'zh', label: 'Chinese' },
              ]}
              value={defaultLanguage}
              onChange={(e) => setDefaultLanguage(e.target.value)}
            />

            <div className="flex items-center justify-between rounded-lg border border-gray-100 p-4">
              <div>
                <p className="text-sm font-medium text-text-primary">
                  Auto-approve AI posts
                </p>
                <p className="mt-0.5 text-xs text-text-muted">
                  Automatically approve AI-generated posts without manual review
                </p>
              </div>
              <button
                onClick={() => setAutoApprove(!autoApprove)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  autoApprove ? 'bg-brand-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoApprove ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex justify-end">
              <Button
                icon={<Save className="h-4 w-4" />}
                onClick={handleSaveDefaults}
                loading={saving}
              >
                Save Defaults
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Credentials Tab */}
      {activeTab === 'credentials' && (
        <div className="space-y-5">
          <Card>
            <CardHeader>Platform Credentials</CardHeader>
            <CardBody className="space-y-4">
              <p className="text-sm text-text-muted">
                Configure your own OAuth or API credentials for each social media
                platform. This allows you to use your own developer apps for
                publishing and analytics.
              </p>
              <a
                href="/integrations/guide"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View setup guides for all platforms
              </a>
            </CardBody>
          </Card>

          <div className="space-y-3">
            {ALL_PLATFORMS.map((platform) => {
              const fields = PLATFORM_CREDENTIAL_FIELDS[platform] || [];
              const isExpanded = expandedPlatform === platform;
              const configured = isConfigured(platform);
              const data = getCredentialData(platform);
              const color = PLATFORM_ICON_COLORS[platform] || '#6B7280';
              const displayName = PLATFORM_DISPLAY_NAMES[platform] || platform;
              const abbr = getPlatformAbbreviation(platform);

              return (
                <Card key={platform}>
                  <div
                    className="flex cursor-pointer items-center justify-between px-5 py-4"
                    onClick={() =>
                      setExpandedPlatform(isExpanded ? null : platform)
                    }
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold text-white"
                        style={{ backgroundColor: color }}
                      >
                        {abbr}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text-primary">
                          {displayName}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {configured ? (
                        <Badge variant="approved">Configured</Badge>
                      ) : (
                        <Badge variant="default">Not configured</Badge>
                      )}
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-text-muted" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-text-muted" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <CardBody className="space-y-4 border-t border-gray-50">
                      {/* Show OAuth Redirect URL and Webhook URL */}
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                          URLs to configure in your {displayName} developer app
                        </p>
                        <CopyableUrl
                          label="OAuth Redirect URI"
                          url={`${getBaseUrl()}/api/integrations/callback/${platform}`}
                        />
                        {WEBHOOK_PLATFORMS[platform] && (
                          <>
                            <CopyableUrl
                              label="Webhook URL"
                              url={`${getBaseUrl()}${WEBHOOK_PLATFORMS[platform].path}`}
                              icon={<Webhook className="h-4 w-4" />}
                            />
                            <CopyableUrl
                              label="Webhook Verify Token"
                              url={WEBHOOK_PLATFORMS[platform].defaultVerifyToken}
                              icon={<Key className="h-4 w-4" />}
                            />
                          </>
                        )}
                      </div>

                      <hr className="border-gray-100" />

                      {fields.map((field) => (
                        <Input
                          key={field.key}
                          label={field.label}
                          type={field.type}
                          placeholder={field.placeholder}
                          value={data.credentials[field.key] || ''}
                          onChange={(e) =>
                            updateCredentialField(platform, field.key, e.target.value)
                          }
                        />
                      ))}

                      <Input
                        label="Label (optional)"
                        type="text"
                        placeholder="A friendly name for this credential set"
                        value={data.label}
                        onChange={(e) => updateCredentialLabel(platform, e.target.value)}
                      />

                      <div className="flex items-center justify-between rounded-lg border border-gray-100 p-4">
                        <div>
                          <p className="text-sm font-medium text-text-primary">
                            Active
                          </p>
                          <p className="mt-0.5 text-xs text-text-muted">
                            Enable or disable these credentials
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            updateCredentialActive(platform, !data.isActive)
                          }
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            data.isActive ? 'bg-brand-600' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              data.isActive ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          icon={<Zap className="h-4 w-4" />}
                          onClick={() => handleTestCredential(platform)}
                          loading={testingCredential === platform}
                        >
                          Test Connection
                        </Button>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="danger"
                            size="sm"
                            icon={<Trash2 className="h-4 w-4" />}
                            onClick={() => handleDeleteCredential(platform)}
                            loading={deletingCredential === platform}
                          >
                            Delete
                          </Button>
                          <Button
                            size="sm"
                            icon={<Save className="h-4 w-4" />}
                            onClick={() => handleSaveCredential(platform)}
                            loading={savingCredential === platform}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    </CardBody>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
