import { Flame, Sparkles, Snowflake, TrendingUp } from 'lucide-react';
import { cn, formatDateTime } from '../../lib/utils';
import type { ComputedLeadScore } from '../../lib/leadScoring';

export function LeadScoreBadge({
  score,
  tier,
  isAi = false,
  compact = false,
}: {
  score: number;
  tier: 'Hot' | 'Warm' | 'Cold';
  isAi?: boolean;
  compact?: boolean;
}) {
  const tone =
    tier === 'Hot'
      ? 'bg-rose-50/90 text-rose-700 ring-rose-200/80'
      : tier === 'Warm'
      ? 'bg-amber-50/90 text-amber-800 ring-amber-200/80'
      : 'bg-slate-100/90 text-slate-600 ring-slate-200/80';

  const Icon = tier === 'Hot' ? Flame : tier === 'Warm' ? TrendingUp : Snowflake;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md ring-1 ring-inset font-semibold tabular-nums whitespace-nowrap shrink-0 leading-4',
        compact ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-[11px]',
        tone
      )}
    >
      <Icon className="w-3 h-3 shrink-0" />
      <span>{score}</span>
      {!compact && <span className="font-medium text-[10.5px] opacity-85">· {tier}</span>}
      {isAi && <Sparkles className="w-3 h-3 text-blue-600 shrink-0" />}
    </span>
  );
}

export function LeadScoreBreakdownCard({
  computed,
  onRunAiScore,
  scoringBusy = false,
}: {
  computed: ComputedLeadScore;
  onRunAiScore?: () => void;
  scoringBusy?: boolean;
}) {
  const barTone =
    computed.scoreTier === 'Hot'
      ? 'bg-rose-600'
      : computed.scoreTier === 'Warm'
      ? 'bg-amber-500'
      : 'bg-slate-500';

  const scoreRingTone =
    computed.scoreTier === 'Hot'
      ? 'ring-rose-200 bg-rose-50/70 text-rose-700'
      : computed.scoreTier === 'Warm'
      ? 'ring-amber-200 bg-amber-50/70 text-amber-800'
      : 'ring-slate-200 bg-slate-100 text-slate-700';

  const tierTextTone =
    computed.scoreTier === 'Hot'
      ? 'text-rose-700'
      : computed.scoreTier === 'Warm'
      ? 'text-amber-700'
      : 'text-slate-600';

  const factors = [
    { label: 'Demographics & Stability', value: computed.scoreFactors.demographics, max: 25 },
    { label: 'Income & Loan Fit', value: computed.scoreFactors.financialCapacity, max: 30 },
    { label: 'Lead Source Intent', value: computed.scoreFactors.sourceQuality, max: 15 },
    { label: 'Calls & Follow-up Engagement', value: computed.scoreFactors.engagementHistory, max: 30 },
  ];

  const isGemini = computed.scoreModel.includes('gemini');

  return (
    <div className="bg-slate-50/70 border border-slate-200/90 rounded-xl p-4 space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-3">
          <div className={cn('w-11 h-11 rounded-xl ring-1 flex flex-col items-center justify-center shrink-0', scoreRingTone)}>
            <span className="text-base font-bold font-display tabular-nums leading-none">
              {computed.leadScore}
            </span>
            <span className="text-[9.5px] opacity-70 font-medium mt-0.5">/100</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold font-display text-slate-900">AI Lead Score</h4>
              <span className={cn('text-xs font-semibold', tierTextTone)}>
                · {computed.scoreTier} Priority
              </span>
              {isGemini && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600">
                  <Sparkles className="w-3 h-3" />
                  Gemini
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Model: <span className="font-mono text-slate-700">{computed.scoreModel}</span>
              {computed.scoredAt ? ` · ${formatDateTime(computed.scoredAt)}` : ''}
            </p>
          </div>
        </div>

        {onRunAiScore && (
          <button
            type="button"
            disabled={scoringBusy}
            onClick={onRunAiScore}
            className="crm-btn-primary px-3 py-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {scoringBusy ? 'Scoring with Gemini...' : 'Run AI Score'}
          </button>
        )}
      </div>

      <p className="text-xs text-slate-700 pt-3 border-t border-slate-200/80 leading-relaxed">
        {computed.scoreSummary}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2.5 pt-2 border-t border-slate-200/60">
        {factors.map((f) => {
          const pct = Math.min(100, Math.round((f.value / f.max) * 100));
          return (
            <div key={f.label}>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-slate-600 font-medium">{f.label}</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {f.value}/{f.max}
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-200/80 rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full transition-all duration-300', barTone)} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
