import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { WizardProgress } from '@/components/campaign-wizard/WizardProgress';
import { StepModeSelect } from '@/components/campaign-wizard/StepModeSelect';
import { StepBrandContext } from '@/components/campaign-wizard/StepBrandContext';
import { StepChannels } from '@/components/campaign-wizard/StepChannels';
import { StepSchedule } from '@/components/campaign-wizard/StepSchedule';
import { StepUploadAssets } from '@/components/campaign-wizard/StepUploadAssets';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useTemplates } from '@/hooks/useTemplates';
import { useIntegrations } from '@/hooks/useIntegrations';
import { PLATFORM_DISPLAY_NAMES } from '@/lib/constants';
import { fetchApi } from '@/lib/api';
import toast from 'react-hot-toast';

type CampaignMode = 'FULLY_AUTOMATED' | 'SEMI_AUTOMATED' | 'MANUAL';
type WizardStep = 1 | 2 | 3 | 4 | 5;

const STEPS = [
  { label: 'Mode' },
  { label: 'Brand Context' },
  { label: 'Channels' },
  { label: 'Schedule' },
  { label: 'Review' },
];

const STEPS_SEMI = [
  { label: 'Mode' },
  { label: 'Brand Context' },
  { label: 'Channels' },
  { label: 'Upload Assets' },
  { label: 'Review' },
];

interface UploadedAsset {
  id: string;
  type: 'image' | 'url';
  name?: string;
  url?: string;
  status: 'pending' | 'uploaded' | 'processing' | 'done' | 'error';
}

export function NewCampaignPage() {
  const navigate = useNavigate();
  const { templates } = useTemplates();
  const { integrations } = useIntegrations();

  const [step, setStep] = useState<WizardStep>(1);
  const [mode, setMode] = useState<CampaignMode | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [inlineContext, setInlineContext] = useState({
    brandContext: '',
    targetAudience: '',
    tone: 'PROFESSIONAL',
    goals: [] as string[],
  });
  const [selectedIntegrationIds, setSelectedIntegrationIds] = useState<string[]>([]);

  // Schedule state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [postsPerWeek, setPostsPerWeek] = useState(3);
  const [preferredTimes, setPreferredTimes] = useState<string[]>(['09:00', '12:00', '17:00']);
  const [topics, setTopics] = useState<string[]>([]);

  // Upload assets state
  const [uploadedAssets, setUploadedAssets] = useState<UploadedAsset[]>([]);
  const [additionalContext, setAdditionalContext] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const toggleIntegration = (id: string) => {
    setSelectedIntegrationIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleAddImages = (files: FileList) => {
    const newAssets: UploadedAsset[] = Array.from(files).map((file, idx) => ({
      id: `img-${Date.now()}-${idx}`,
      type: 'image' as const,
      name: file.name,
      status: 'uploaded' as const,
    }));
    setUploadedAssets((prev) => [...prev, ...newAssets]);
  };

  const handleAddUrl = (url: string) => {
    setUploadedAssets((prev) => [
      ...prev,
      { id: `url-${Date.now()}`, type: 'url', url, status: 'pending' },
    ]);
  };

  const handleRemoveAsset = (id: string) => {
    setUploadedAssets((prev) => prev.filter((a) => a.id !== id));
  };

  const handleScheduleUpdate = (data: Record<string, unknown>) => {
    if (data.startDate !== undefined) setStartDate(data.startDate as string);
    if (data.endDate !== undefined) setEndDate(data.endDate as string);
    if (data.postsPerWeek !== undefined) setPostsPerWeek(data.postsPerWeek as number);
    if (data.preferredTimes !== undefined) setPreferredTimes(data.preferredTimes as string[]);
    if (data.topics !== undefined) setTopics(data.topics as string[]);
  };

  const canProceed = (): boolean => {
    switch (step) {
      case 1:
        return mode !== null;
      case 2:
        return !!selectedTemplateId || inlineContext.brandContext.trim().length > 0;
      case 3:
        return selectedIntegrationIds.length > 0;
      case 4:
        return !!startDate && !!endDate;
      case 5:
        return true;
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        name: selectedTemplateId
          ? templates.find((t: { id: string }) => t.id === selectedTemplateId)?.name || 'Campaign'
          : 'New Campaign',
        mode,
        templateId: selectedTemplateId || undefined,
        startDate,
        endDate,
        postsPerWeek,
        preferredTimes: preferredTimes.map((t) => {
          const [h, m] = t.split(':').map(Number);
          return h * 60 + m;
        }),
        integrationIds: selectedIntegrationIds,
        topics: topics.filter(Boolean),
      };
      const result = await fetchApi<{ id: string }>('/campaigns', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      toast.success('Campaign created successfully!');
      navigate(`/campaigns/${result.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create campaign');
    } finally {
      setSubmitting(false);
    }
  };

  const currentSteps = mode === 'SEMI_AUTOMATED' ? STEPS_SEMI : STEPS;

  // Map templates to the shape StepBrandContext expects
  const mappedTemplates = (templates || []).map((t: Record<string, unknown>) => ({
    id: t.id as string,
    name: t.name as string,
    category: (t.category as string) || 'CUSTOM',
    tone: (t.tone as string) || 'PROFESSIONAL',
    brandContext: t.brandContext as string | undefined,
  }));

  return (
    <div className="page-container max-w-3xl space-y-6">
      {/* Step indicator */}
      <WizardProgress
        steps={currentSteps}
        currentStep={step - 1}
      />

      {/* Step 1: Mode Selection */}
      {step === 1 && (
        <StepModeSelect
          selected={mode}
          onSelect={setMode}
        />
      )}

      {/* Step 2: Brand Context */}
      {step === 2 && (
        <StepBrandContext
          templates={mappedTemplates}
          selectedTemplateId={selectedTemplateId}
          onSelectTemplate={setSelectedTemplateId}
          inlineContext={inlineContext}
          onUpdateInlineContext={(ctx) =>
            setInlineContext((prev) => ({ ...prev, ...ctx }))
          }
        />
      )}

      {/* Step 3: Channel Selection */}
      {step === 3 && (
        <StepChannels
          integrations={(integrations || []).map((i: Record<string, unknown>) => ({
            id: i.id as string,
            platform: i.platform as string,
            name: (i.name as string) || (i.displayName as string) || '',
            profilePicture: i.profilePicture as string | undefined,
          }))}
          selectedIds={selectedIntegrationIds}
          onToggle={toggleIntegration}
        />
      )}

      {/* Step 4: Schedule (auto/manual) or Upload Assets (semi-auto) */}
      {step === 4 && mode === 'SEMI_AUTOMATED' && (
        <StepUploadAssets
          assets={uploadedAssets}
          onAddImages={handleAddImages}
          onAddUrl={handleAddUrl}
          onRemoveAsset={handleRemoveAsset}
          additionalContext={additionalContext}
          onUpdateContext={setAdditionalContext}
        />
      )}

      {step === 4 && mode !== 'SEMI_AUTOMATED' && (
        <StepSchedule
          startDate={startDate}
          endDate={endDate}
          postsPerWeek={postsPerWeek}
          preferredTimes={preferredTimes}
          topics={topics}
          onUpdate={handleScheduleUpdate}
        />
      )}

      {/* Step 5: Review */}
      {step === 5 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Review Campaign</h2>
            <p className="mt-1 text-sm text-text-muted">
              Confirm the details before creating your campaign.
            </p>
          </div>
          <Card>
            <CardBody className="space-y-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
                  Mode
                </p>
                <div className="mt-1">
                  <Badge variant="default">
                    {mode === 'FULLY_AUTOMATED'
                      ? 'Full Auto'
                      : mode === 'SEMI_AUTOMATED'
                        ? 'Semi Auto'
                        : 'Manual'}
                  </Badge>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
                  Brand Context
                </p>
                <p className="mt-1 text-sm text-text-primary">
                  {selectedTemplateId
                    ? `Template: ${mappedTemplates.find((t) => t.id === selectedTemplateId)?.name}`
                    : inlineContext.brandContext.slice(0, 120) + (inlineContext.brandContext.length > 120 ? '...' : '')}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
                  Channels
                </p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {selectedIntegrationIds.map((id) => {
                    const integration = (integrations || []).find((i: { id: string }) => i.id === id);
                    return integration ? (
                      <span
                        key={id}
                        className="rounded-full bg-surface-tertiary px-3 py-1 text-xs text-text-secondary"
                      >
                        {(integration as Record<string, unknown>).name as string ||
                          (integration as Record<string, unknown>).displayName as string ||
                          PLATFORM_DISPLAY_NAMES[(integration as Record<string, unknown>).platform as string]}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
                  Schedule
                </p>
                <p className="mt-1 text-sm text-text-primary">
                  {startDate} to {endDate} &middot; {postsPerWeek} posts/week
                </p>
              </div>
              {mode === 'SEMI_AUTOMATED' && uploadedAssets.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
                    Uploaded Assets
                  </p>
                  <p className="mt-1 text-sm text-text-primary">
                    {uploadedAssets.length} file{uploadedAssets.length !== 1 ? 's' : ''} ready
                  </p>
                </div>
              )}
              {topics.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
                    Topics
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {topics.filter(Boolean).map((topic, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs text-brand-700"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4">
        <Button
          variant="ghost"
          icon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => {
            if (step === 1) navigate('/campaigns');
            else setStep((s) => (s - 1) as WizardStep);
          }}
        >
          {step === 1 ? 'Cancel' : 'Back'}
        </Button>
        {step < 5 ? (
          <Button
            icon={<ArrowRight className="h-4 w-4" />}
            onClick={() => setStep((s) => (s + 1) as WizardStep)}
            disabled={!canProceed()}
          >
            Continue
          </Button>
        ) : (
          <Button
            icon={<Sparkles className="h-4 w-4" />}
            onClick={handleSubmit}
            loading={submitting}
          >
            Create Campaign
          </Button>
        )}
      </div>
    </div>
  );
}
