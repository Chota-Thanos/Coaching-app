'use client';

import {
  Search,
  ChevronRight,
  FolderTree,
  FileText,
  Plus,
  Minus,
  Play,
  ShoppingBasket,
  ChevronUp,
  Trash2,
  Timer,
  LayoutGrid,
  Star,
  Send,
  Check,
  CheckCircle2,
  XCircle,
  Bookmark,
  HelpCircle,
  Award,
  ArrowLeft,
  RefreshCw,
  ClipboardCheck,
} from 'lucide-react';
import type { DemoRow, DemoState } from './demo-script';
import { demoSubjects, focusId } from './demo-script';
import { renderMathAndMarkdown } from '../../current-affairs/admin/katex-renderer';

/**
 * Renders one frame of the scripted demo as a faithful mock of the real
 * assessment UI. Nothing here calls the API — it is a deliberate replica, so
 * the walkthrough is immune to empty accounts, missing taxonomy and network
 * failures, and works for signed-out visitors.
 *
 * Focusable controls carry `data-demo-focus`; the player looks them up to
 * position its pointer. See `focusId` for the id vocabulary.
 */
export function DemoStage({ state }: { state: DemoState }) {
  switch (state.screen) {
    case 'builder':
      return <BuilderScreen state={state} />;
    case 'myTests':
      return <MyTestsScreen state={state} />;
    case 'attempt':
      return <AttemptScreen state={state} />;
    case 'result':
      return <ResultScreen state={state} />;
    case 'revision':
      return <RevisionScreen state={state} />;
    case 'outro':
      return <OutroScreen />;
  }
}

// ─── Shared chrome ───────────────────────────────────────────────────────────

function MockAppBar({ title, trailing }: { title: string; trailing?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3">
      <ArrowLeft className="h-4 w-4 shrink-0 text-ink" />
      <span className="min-w-0 flex-1 truncate text-sm font-extrabold text-ink">{title}</span>
      {trailing}
    </div>
  );
}

function ContentTabs({ active }: { active: number }) {
  const labels = ['GS', 'CSAT', 'Mains'];
  return (
    <div className="bg-surface px-4 py-2" data-demo-focus={focusId.contentTabs}>
      <div className="flex gap-1 rounded-xl bg-paper p-1">
        {labels.map((label, i) => (
          <div
            key={label}
            className={`flex h-8 flex-1 items-center justify-center rounded-lg text-[13px] transition ${
              i === active
                ? 'bg-surface font-bold text-ink shadow-sm'
                : 'font-medium text-muted'
            }`}
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Builder ─────────────────────────────────────────────────────────────────

function BuilderScreen({ state }: { state: DemoState }) {
  const crumbs = [demoSubjects[state.subjectTab] ?? '', ...state.breadcrumb];
  const cartTotal = state.cart.reduce((sum, i) => sum + i.count, 0);

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <ContentTabs active={state.contentTab} />
      <div className="flex-1 overflow-y-auto px-4 pb-32 pt-3">
        <h2 className="text-xl font-extrabold tracking-tight text-ink">Test Topics</h2>
        <p className="mt-0.5 text-xs font-medium text-muted">
          Build and practice dedicated syllabus trees.
        </p>

        <div className="mt-3 flex h-10 items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5">
          <Search className="h-4 w-4 shrink-0 text-muted" />
          <span className="truncate text-[13px] font-medium text-muted">
            Search categories or topics...
          </span>
        </div>

        {/* Subject tabs */}
        <div className="mt-3.5 flex gap-2 overflow-x-auto pb-1">
          {demoSubjects.map((subject, i) => (
            <div
              key={subject}
              data-demo-focus={focusId.subjectTab(subject)}
              className={`flex h-9 shrink-0 items-center rounded-xl border px-3.5 text-[13px] font-bold transition ${
                i === state.subjectTab
                  ? 'border-civic bg-civic/10 text-civic'
                  : 'border-line bg-surface text-ink'
              }`}
            >
              {subject}
            </div>
          ))}
        </div>

        {state.breadcrumb.length > 0 && (
          <div className="mt-3 flex items-center gap-1 overflow-x-auto whitespace-nowrap">
            {crumbs.map((crumb, i) => (
              <span key={crumb} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted" />}
                <span
                  className={`text-[11px] ${
                    i === crumbs.length - 1 ? 'font-extrabold text-ink' : 'font-semibold text-civic'
                  }`}
                >
                  {crumb}
                </span>
              </span>
            ))}
          </div>
        )}

        <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface">
          {state.rows.map((row, i) => (
            <BrowseRow
              key={row.name}
              row={row}
              qty={state.qtyRow === row.name ? state.qty : 10}
              isLast={i === state.rows.length - 1}
            />
          ))}
        </div>
      </div>

      {state.toast && (
        <div
          className={`absolute left-4 right-4 flex items-center gap-2.5 rounded-lg bg-midnight px-4 py-3 text-xs font-semibold text-white shadow-lg ${
            state.cart.length > 0 ? 'bottom-24' : 'bottom-6'
          }`}
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {state.toast}
        </div>
      )}

      {state.cart.length > 0 && !state.cartExpanded && (
        <div
          data-demo-focus={focusId.cartBar}
          className="absolute inset-x-0 bottom-0 flex items-center gap-3 border-t border-line bg-surface px-4 py-3.5 shadow-[0_-3px_14px_rgba(0,0,0,0.08)]"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-civic/10">
            <ShoppingBasket className="h-4 w-4 text-civic" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-ink">{cartTotal} questions queued</p>
            <p className="text-[11px] text-muted">{state.cart.length} categories · max 100</p>
          </div>
          <ChevronUp className="h-5 w-5 shrink-0 text-civic" />
        </div>
      )}

      {state.cartExpanded && <CartSheet state={state} />}
    </div>
  );
}

function BrowseRow({ row, qty, isLast }: { row: DemoRow; qty: number; isLast: boolean }) {
  return (
    <div
      data-demo-focus={focusId.row(row.name)}
      className={`px-3.5 py-3 ${isLast ? '' : 'border-b border-line'}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            row.hasChildren ? 'bg-civic/10 text-civic' : 'bg-emerald-600/10 text-emerald-600'
          }`}
        >
          {row.hasChildren ? <FolderTree className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold text-ink">{row.name}</p>
          <p className="mt-0.5 text-[11px] text-muted">{row.count} questions total</p>
        </div>
        {row.hasChildren && <ChevronRight className="h-5 w-5 shrink-0 text-muted" />}
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <div
          data-demo-focus={focusId.qtyPlus(row.name)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-paper px-2 py-1.5"
        >
          <Minus className="h-3 w-3 text-muted" />
          <span className="min-w-[1.25rem] text-center text-xs font-bold text-ink">{qty}</span>
          <Plus className="h-3 w-3 text-ink" />
        </div>
        <div
          data-demo-focus={focusId.addBtn(row.name)}
          className="flex h-8 flex-1 items-center justify-center rounded-lg border border-civic text-xs font-extrabold text-civic"
        >
          Add
        </div>
        <div className="flex h-8 flex-1 items-center justify-center gap-0.5 rounded-lg bg-midnight text-xs font-extrabold text-white">
          <Play className="h-3.5 w-3.5" fill="currentColor" />
          Start
        </div>
      </div>
    </div>
  );
}

function CartSheet({ state }: { state: DemoState }) {
  return (
    <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border border-line bg-surface px-4 pb-5 pt-3.5 shadow-[0_-6px_22px_rgba(0,0,0,0.12)]">
      <div className="mx-auto mb-3.5 h-1 w-9 rounded-full bg-line" />
      <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted">Test name</p>
      <div
        data-demo-focus={focusId.nameField}
        className={`mt-1.5 flex h-11 items-center gap-1 rounded-xl border bg-paper/40 px-3.5 ${
          state.testName ? 'border-civic' : 'border-line'
        }`}
      >
        <span
          className={`min-w-0 flex-1 truncate text-[13px] ${
            state.testName ? 'font-bold text-ink' : 'text-muted'
          }`}
        >
          {state.testName || 'e.g., My Custom Practice Test'}
        </span>
        {state.testName && <span className="h-4 w-[2px] shrink-0 animate-pulse bg-civic" />}
      </div>

      <p className="mt-3.5 text-[10px] font-extrabold uppercase tracking-widest text-muted">
        Selected categories
      </p>
      <div className="mt-1">
        {state.cart.map((item) => (
          <div key={item.name} className="flex items-center gap-2.5 py-1.5">
            <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-ink">
              {item.name}
            </span>
            <span className="shrink-0 text-[13px] font-bold text-civic">{item.count} Qs</span>
            <Trash2 className="h-4 w-4 shrink-0 text-berry" />
          </div>
        ))}
      </div>

      <div className="mt-3.5 flex gap-2.5">
        <div className="flex h-11 flex-1 items-center justify-center rounded-xl border border-civic text-[13px] font-extrabold text-civic">
          Add to Existing
        </div>
        <div
          data-demo-focus={focusId.saveNew}
          className="flex h-11 flex-1 items-center justify-center rounded-xl bg-civic text-[13px] font-extrabold text-white"
        >
          Save as New Test
        </div>
      </div>
    </div>
  );
}

// ─── My Tests ────────────────────────────────────────────────────────────────

function MyTestsScreen({ state }: { state: DemoState }) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ContentTabs active={state.contentTab} />
      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4">
        <h2 className="text-xl font-extrabold tracking-tight text-ink">My Tests</h2>
        <p className="mt-0.5 text-xs font-medium text-muted">
          Saved tests you can retake any time.
        </p>

        <div className="mt-4 rounded-2xl border border-line bg-surface p-4 shadow-card">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-emerald-600/10 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-emerald-600">
              New
            </span>
            <span className="ml-auto truncate text-[11px] text-muted">Sectional · GS</span>
          </div>
          <p className="mt-2.5 text-base font-extrabold text-ink">{state.testName}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <MetaChip icon={<HelpCircle className="h-3 w-3" />} label="35 questions" />
            <MetaChip icon={<Timer className="h-3 w-3" />} label="42 min" />
            <MetaChip icon={<Award className="h-3 w-3" />} label="70 marks" />
          </div>
          <div className="mt-3.5 flex gap-2.5">
            <div className="flex h-10 flex-1 items-center justify-center rounded-xl border border-line text-xs font-extrabold text-ink">
              Edit questions
            </div>
            <div
              data-demo-focus={focusId.startTest}
              className="flex h-10 flex-1 items-center justify-center gap-1 rounded-xl bg-civic text-xs font-extrabold text-white"
            >
              <Play className="h-3.5 w-3.5" fill="currentColor" />
              Start Test
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-paper px-2 py-1 text-[10px] text-muted">
      {icon}
      {label}
    </span>
  );
}

// ─── Attempt ─────────────────────────────────────────────────────────────────

function AttemptScreen({ state }: { state: DemoState }) {
  const q = state.question;
  const isLast = state.qIndex === state.qTotal - 1;
  const title =
    state.qTotal === 12 ? 'Revision: Banking & Finance' : state.testName || 'Custom Test';

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <MockAppBar
        title={title}
        trailing={
          <span className="flex shrink-0 items-center gap-1.5 rounded-lg bg-midnight px-2.5 py-1.5 text-xs font-bold text-white">
            <Timer className="h-3.5 w-3.5" />
            {state.timer}
          </span>
        }
      />

      <div className="flex items-center justify-between gap-1 bg-surface px-3 py-2">
        <StatBadge value={`${state.qIndex + 1}/${state.qTotal}`} label="Question" tone="neutral" />
        <StatBadge value={`${state.answered}`} label="Done" tone="emerald" />
        <StatBadge value={`${state.flagged}`} label="Review" tone="saffron" />
        <span
          data-demo-focus={focusId.gridBtn}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-civic/10 px-2.5 py-1.5 text-[11px] font-extrabold text-civic"
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          Grid
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5">
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
          <p className="text-[11px] font-extrabold text-muted">QUESTION {state.qIndex + 1}</p>
          <p className="mt-2.5 whitespace-pre-line text-[13px] font-medium leading-relaxed text-ink">
            {q.stem}
          </p>
          <div className="mt-4 space-y-2.5">
            {q.options.map((option, i) => {
              const key = String.fromCharCode(65 + i);
              return (
                <OptionTile
                  key={key}
                  optKey={key}
                  text={option}
                  selected={state.selectedKey === key}
                />
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-line bg-surface px-3.5 py-2.5">
        <span className="flex h-10 shrink-0 items-center rounded-xl border border-line px-3.5 text-[11px] font-extrabold text-muted">
          PREV
        </span>
        <span
          data-demo-focus={focusId.reviewBtn}
          className={`flex h-10 shrink-0 items-center gap-1 rounded-xl border px-3.5 text-[11px] font-extrabold text-ink ${
            state.marked ? 'border-saffron bg-saffron/10' : 'border-line'
          }`}
        >
          <Star
            className="h-3.5 w-3.5 text-saffron"
            fill={state.marked ? 'currentColor' : 'none'}
          />
          REVIEW
        </span>
        <span
          data-demo-focus={focusId.nextBtn}
          className={`ml-auto flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-5 text-xs font-extrabold text-white ${
            isLast ? 'bg-emerald-600' : 'bg-midnight'
          }`}
        >
          {isLast ? 'SUBMIT' : 'NEXT'}
          {isLast ? <Send className="h-3 w-3" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </span>
      </div>
    </div>
  );
}

function StatBadge({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: 'neutral' | 'emerald' | 'saffron';
}) {
  const toneClass =
    tone === 'emerald'
      ? 'bg-emerald-600/10 text-emerald-600'
      : tone === 'saffron'
        ? 'bg-saffron/10 text-saffron'
        : 'bg-paper text-ink';
  return (
    <span
      className={`flex min-w-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-extrabold ${toneClass}`}
    >
      {value}
      <span className="truncate text-[9px] font-extrabold opacity-80">{label}</span>
    </span>
  );
}

function OptionTile({
  optKey,
  text,
  selected = false,
  correct = false,
  wrong = false,
}: {
  optKey: string;
  text: string;
  selected?: boolean;
  correct?: boolean;
  wrong?: boolean;
}) {
  const active = selected || correct || wrong;
  const borderClass = correct
    ? 'border-emerald-600 bg-emerald-600/5'
    : wrong
      ? 'border-berry bg-berry/5'
      : selected
        ? 'border-civic bg-civic/5'
        : 'border-line bg-surface';
  const chipClass = correct
    ? 'bg-emerald-600 text-white'
    : wrong
      ? 'bg-berry text-white'
      : selected
        ? 'bg-civic text-white'
        : 'bg-paper text-ink';

  return (
    <div
      data-demo-focus={focusId.option(optKey)}
      className={`flex items-start gap-3 rounded-2xl px-3.5 py-3 ${borderClass} ${
        active ? 'border-2' : 'border'
      }`}
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-extrabold ${chipClass}`}
      >
        {optKey}
      </span>
      <span className="min-w-0 flex-1 text-xs font-semibold leading-snug text-ink">{text}</span>
      {correct && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />}
      {wrong && <XCircle className="h-4 w-4 shrink-0 text-berry" />}
    </div>
  );
}

// ─── Result ──────────────────────────────────────────────────────────────────

function ResultScreen({ state }: { state: DemoState }) {
  const q = state.reviewQuestion;
  const total = state.correct + state.wrong + state.skipped;
  const pct = total === 0 ? 0 : Math.round((state.correct / total) * 100);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <MockAppBar title={`Result — ${state.testName}`} />
      <div className="flex-1 overflow-y-auto p-3.5">
        <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card">
          <ScoreDial pct={pct} />
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-extrabold uppercase tracking-wider text-muted">Score</p>
            <p className="text-2xl font-extrabold text-ink">42.7 / 70</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <ResultPill value={state.correct} label="Correct" tone="emerald" />
              <ResultPill value={state.wrong} label="Wrong" tone="berry" />
              <ResultPill value={state.skipped} label="Skipped" tone="muted" />
            </div>
          </div>
        </div>

        <div className="mt-3.5 rounded-2xl border border-line bg-surface p-4 shadow-card">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-extrabold text-muted">QUESTION 7</span>
            <span className="rounded bg-berry/10 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-berry">
              Incorrect
            </span>
          </div>
          <p className="mt-2.5 whitespace-pre-line text-[12.5px] font-medium leading-relaxed text-ink">
            {q.stem}
          </p>
          <div className="mt-3.5 space-y-2.5">
            <OptionTile optKey="A" text={q.options[0] ?? ''} wrong />
            <OptionTile optKey="C" text={q.options[2] ?? ''} correct />
          </div>
          <div className="mt-3.5 rounded-xl border border-civic/20 bg-civic/5 p-3">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-civic">
              Explanation
            </p>
            <div className="article-body mt-1.5 text-xs leading-relaxed text-muted" dangerouslySetInnerHTML={renderMathAndMarkdown(q.explanation)} />
          </div>
          <div
            data-demo-focus={focusId.markRevision}
            className={`mt-3.5 flex h-11 items-center justify-center gap-2 rounded-xl border text-[12.5px] font-extrabold text-ink ${
              state.bookmarked ? 'border-saffron bg-saffron/10' : 'border-line'
            }`}
          >
            <Bookmark
              className="h-4 w-4 text-saffron"
              fill={state.bookmarked ? 'currentColor' : 'none'}
            />
            {state.bookmarked ? 'Saved to Revision' : 'Mark for Revision'}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreDial({ pct }: { pct: number }) {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative h-[74px] w-[74px] shrink-0">
      <svg viewBox="0 0 74 74" className="h-full w-full -rotate-90">
        <circle
          cx="37"
          cy="37"
          r={radius}
          fill="none"
          strokeWidth="7"
          className="stroke-line"
        />
        <circle
          cx="37"
          cy="37"
          r={radius}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          className="stroke-civic transition-[stroke-dashoffset] duration-700"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-extrabold leading-none text-ink">{pct}%</span>
        <span className="text-[8px] font-extrabold uppercase tracking-wide text-muted">
          accuracy
        </span>
      </div>
    </div>
  );
}

function ResultPill({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: 'emerald' | 'berry' | 'muted';
}) {
  const toneClass =
    tone === 'emerald'
      ? 'bg-emerald-600/10 text-emerald-600'
      : tone === 'berry'
        ? 'bg-berry/10 text-berry'
        : 'bg-muted/10 text-muted';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-extrabold ${toneClass}`}
    >
      {value}
      <span className="text-[8.5px] font-extrabold">{label}</span>
    </span>
  );
}

// ─── Revision ────────────────────────────────────────────────────────────────

function RevisionScreen({ state }: { state: DemoState }) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ContentTabs active={state.contentTab} />
      <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3.5">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-extrabold tracking-tight text-ink">Revision</h2>
          <span className="rounded-md bg-saffron/10 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-saffron">
            {state.bookmarks.length} saved
          </span>
        </div>
        <p className="mt-0.5 text-xs font-medium text-muted">
          Questions you flagged, from every test you have taken.
        </p>

        <div className="mt-3.5 overflow-hidden rounded-2xl border border-line bg-surface">
          {state.bookmarks.map((bookmark, i) => (
            <div
              key={bookmark.topic}
              className={`flex items-start gap-3 px-3.5 py-3 ${
                i === state.bookmarks.length - 1 ? '' : 'border-b border-line'
              }`}
            >
              <span className="mt-0.5 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded bg-civic">
                <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-extrabold uppercase tracking-wide text-civic">
                  {bookmark.topic}
                </p>
                <p className="mt-0.5 truncate text-[12.5px] font-bold text-ink">{bookmark.stem}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 pb-5">
        <div
          data-demo-focus={focusId.startRevision}
          className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-civic text-[13px] font-extrabold text-white"
        >
          <Play className="h-4 w-4" fill="currentColor" />
          <span className="truncate">Start Revision Test · 12 Qs</span>
        </div>
      </div>
    </div>
  );
}

// ─── Outro ───────────────────────────────────────────────────────────────────

function OutroScreen() {
  const stages: Array<[string, string, React.ReactNode]> = [
    ['Browse', 'Subjects as tabs, counts rolled up', <FolderTree key="i" className="h-4 w-4" />],
    ['Add', 'Any level, straight into the cart', <Plus key="i" className="h-4 w-4" />],
    ['Name & save', 'One destination decision, at the end', <Bookmark key="i" className="h-4 w-4" />],
    ['Attempt', 'Timer, flags, question grid', <Timer key="i" className="h-4 w-4" />],
    ['Review', 'Right answer plus why', <ClipboardCheck key="i" className="h-4 w-4" />],
    ['Revise', 'Misses become the next test', <RefreshCw key="i" className="h-4 w-4" />],
  ];

  return (
    // `midnight`, not `slate-900`: the slate scale inverts in dark mode, which
    // would turn this deliberately-dark band light.
    <div className="h-full overflow-y-auto bg-gradient-to-br from-midnight to-indigo-950 px-6 py-8">
      <h2 className="text-2xl font-extrabold tracking-tight text-white">The assessment loop</h2>
      <p className="mt-1 text-[13px] text-white/70">Six steps, one tab of the app.</p>
      <div className="mt-6 space-y-3">
        {stages.map(([title, subtitle, icon]) => (
          <div key={title} className="flex items-center gap-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
              {icon}
            </span>
            <div className="min-w-0">
              <p className="text-[13.5px] font-bold text-white">{title}</p>
              <p className="text-[11.5px] text-white/60">{subtitle}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
