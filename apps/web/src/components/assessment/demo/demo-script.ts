/**
 * Scripted assessment demo — data only.
 *
 * Mirror of `upsc_test_series/lib/features/assessment/demo/demo_script.dart`.
 * Keep the two in sync when editing copy or step order: the mobile and web
 * walkthroughs are meant to tell the same story, step for step.
 *
 * The demo replays the whole build-a-test journey on a mock of the assessment
 * UI rather than spotlighting controls on the real screens, so it shows
 * something meaningful even to a signed-out visitor or an empty account.
 */

export type DemoScreen =
  | 'builder'
  | 'myTests'
  | 'attempt'
  | 'result'
  | 'revision'
  | 'outro';

export interface DemoRow {
  name: string;
  /** Rolled-up question total across the whole subtree, as the real browser shows. */
  count: number;
  hasChildren?: boolean;
}

export interface DemoCartItem {
  name: string;
  count: number;
}

export interface DemoQuestion {
  stem: string;
  /** Option bodies in A–D order. */
  options: string[];
  correctKey: string;
  explanation: string;
}

export interface DemoBookmark {
  topic: string;
  stem: string;
}

export interface DemoState {
  screen: DemoScreen;
  // Builder
  contentTab: number;
  subjectTab: number;
  /** Crumbs *below* the subject tab. */
  breadcrumb: string[];
  rows: DemoRow[];
  qtyRow: string | null;
  qty: number;
  cart: DemoCartItem[];
  cartExpanded: boolean;
  testName: string;
  toast: string | null;
  // Attempt
  qIndex: number;
  qTotal: number;
  answered: number;
  flagged: number;
  timer: string;
  selectedKey: string | null;
  marked: boolean;
  question: DemoQuestion;
  // Result
  correct: number;
  wrong: number;
  skipped: number;
  reviewQuestion: DemoQuestion;
  bookmarked: boolean;
  // Revision
  bookmarks: DemoBookmark[];
}

export interface DemoStep {
  title: string;
  caption: string;
  /** Value of the `data-demo-focus` attribute the pointer should track. */
  focus?: string;
  state: DemoState;
  /** Auto-advance dwell time, ms. */
  duration: number;
}

// ─── Focus ids (shared with the stage) ───────────────────────────────────────

export const focusId = {
  contentTabs: 'contentTabs',
  subjectTab: (name: string) => `subjectTab:${name}`,
  row: (name: string) => `row:${name}`,
  qtyPlus: (name: string) => `qtyPlus:${name}`,
  addBtn: (name: string) => `add:${name}`,
  cartBar: 'cartBar',
  nameField: 'nameField',
  saveNew: 'saveNew',
  startTest: 'startTest',
  option: (key: string) => `option:${key}`,
  reviewBtn: 'reviewBtn',
  nextBtn: 'nextBtn',
  gridBtn: 'gridBtn',
  markRevision: 'markRevision',
  startRevision: 'startRevision',
} as const;

// ─── Fixture content ─────────────────────────────────────────────────────────

export const demoSubjects = [
  'Polity',
  'Economy',
  'History',
  'Geography',
  'Environment',
  'S & T',
];

const polityRows: DemoRow[] = [
  { name: 'Constitutional Framework', count: 412, hasChildren: true },
  { name: 'Union & State Executive', count: 268, hasChildren: true },
  { name: 'Judiciary', count: 205, hasChildren: true },
  { name: 'Local Government', count: 96, hasChildren: true },
];

const economyRows: DemoRow[] = [
  { name: 'Indian Economy — Basics', count: 340, hasChildren: true },
  { name: 'Banking & Finance', count: 286, hasChildren: true },
  { name: 'Budget & Taxation', count: 194, hasChildren: true },
  { name: 'External Sector', count: 122, hasChildren: true },
];

const bankingRows: DemoRow[] = [
  { name: 'RBI & Monetary Policy', count: 120 },
  { name: 'Commercial Banking', count: 86 },
  { name: 'NBFCs & Payment Systems', count: 44 },
  { name: 'Financial Inclusion', count: 36 },
];

const attemptQuestion: DemoQuestion = {
  stem:
    'With reference to the Monetary Policy Committee (MPC), consider the following statements:\n' +
    '1. It is constituted under the RBI Act, 1934.\n' +
    '2. Three of its six members are nominated by the Central Government.\n' +
    '3. The Governor of the RBI has a casting vote in case of a tie.\n\n' +
    'Which of the statements given above are correct?',
  options: ['1 and 2 only', '1, 2 and 3', '2 and 3 only', '1 and 3 only'],
  correctKey: 'B',
  explanation:
    'The MPC was constituted under Section 45ZB of the RBI Act, 1934 (inserted by the ' +
    'Finance Act, 2016). Of its six members, three are nominated by the Central Government, ' +
    'and the Governor casts a second, deciding vote when the committee is tied. All three ' +
    'statements are correct.',
};

const reviewQuestion: DemoQuestion = {
  stem:
    'Consider the following statements about Non-Banking Financial Companies (NBFCs):\n' +
    '1. They cannot accept demand deposits.\n' +
    '2. They are not part of the payment and settlement system.\n\n' +
    'Which of the statements given above is/are correct?',
  options: ['1 only', '2 only', 'Both 1 and 2', 'Neither 1 nor 2'],
  correctKey: 'C',
  explanation:
    'NBFCs cannot accept demand deposits and are not part of the payment and settlement ' +
    'system, so they cannot issue cheques drawn on themselves. Both statements are correct.',
};

const bookmarkList: DemoBookmark[] = [
  { topic: 'NBFCs & Payment Systems', stem: 'Statements about Non-Banking Financial Companies…' },
  { topic: 'RBI & Monetary Policy', stem: 'The Marginal Standing Facility (MSF)…' },
  { topic: 'Commercial Banking', stem: 'Priority Sector Lending targets for…' },
  { topic: 'Budget & Taxation', stem: 'Fiscal Responsibility and Budget…' },
];

// ─── The script ──────────────────────────────────────────────────────────────

const base: DemoState = {
  screen: 'builder',
  contentTab: 0,
  subjectTab: 0,
  breadcrumb: [],
  rows: polityRows,
  qtyRow: null,
  qty: 10,
  cart: [],
  cartExpanded: false,
  testName: '',
  toast: null,
  qIndex: 0,
  qTotal: 35,
  answered: 0,
  flagged: 0,
  timer: '42:00',
  selectedKey: null,
  marked: false,
  question: attemptQuestion,
  correct: 0,
  wrong: 0,
  skipped: 0,
  reviewQuestion,
  bookmarked: false,
  bookmarks: [],
};

const from = (prev: DemoState, patch: Partial<DemoState>): DemoState => ({
  ...prev,
  ...patch,
});

/** Each step's state derives from the one before it, so the run reads as one session. */
export function buildAssessmentDemoScript(): DemoStep[] {
  const sEconomy = from(base, { subjectTab: 1, rows: economyRows });
  const sBanking = from(sEconomy, {
    breadcrumb: ['Banking & Finance'],
    rows: bankingRows,
  });
  const sQty = from(sBanking, { qtyRow: 'RBI & Monetary Policy', qty: 20 });
  const sCart1 = from(sQty, {
    cart: [{ name: 'RBI & Monetary Policy', count: 20 }],
    toast: 'Added to cart',
    qtyRow: 'Commercial Banking',
    qty: 15,
  });
  const sCart2 = from(sCart1, {
    cart: [
      { name: 'RBI & Monetary Policy', count: 20 },
      { name: 'Commercial Banking', count: 15 },
    ],
    toast: null,
  });
  const sCartOpen = from(sCart2, { cartExpanded: true });
  const sNamed = from(sCartOpen, { testName: 'Revision: Banking — Set 1' });
  const sMyTests = from(sNamed, {
    screen: 'myTests',
    cartExpanded: false,
    cart: [],
  });
  const sAttempt = from(sMyTests, { screen: 'attempt', qIndex: 0, qTotal: 35, timer: '42:00' });
  const sAnswered = from(sAttempt, { selectedKey: 'B', answered: 1, timer: '41:38' });
  const sMarked = from(sAnswered, { marked: true, flagged: 1, timer: '41:22' });
  const sLast = from(sMarked, { qIndex: 34, answered: 32, flagged: 3, timer: '02:14' });
  const sResult = from(sLast, { screen: 'result', correct: 24, wrong: 8, skipped: 3 });
  const sRevision = from(sResult, {
    screen: 'revision',
    bookmarked: true,
    bookmarks: bookmarkList,
  });
  const sRevisionRunning = from(sRevision, {
    screen: 'attempt',
    qIndex: 0,
    qTotal: 12,
    answered: 0,
    flagged: 0,
    marked: false,
    selectedKey: null,
    timer: '15:00',
    question: reviewQuestion,
  });

  return [
    {
      title: 'Tests → General Studies',
      caption:
        'Every test you take starts here. Pick the paper you are building for — GS, CSAT or Mains each have their own syllabus tree.',
      focus: focusId.contentTabs,
      state: base,
      duration: 4600,
    },
    {
      title: 'Subjects are tabs',
      caption:
        'Tap a subject and its contents open directly below — no new screen, no losing your place.',
      focus: focusId.subjectTab('Economy'),
      state: base,
      duration: 4200,
    },
    {
      title: 'Counts roll up',
      caption:
        'Each row shows the total questions available across everything beneath it — 286 under Banking & Finance, not just its own leaves. Click the row to go deeper.',
      focus: focusId.row('Banking & Finance'),
      state: sEconomy,
      duration: 4800,
    },
    {
      title: 'Choose how many',
      caption:
        'The breadcrumb tracks where you are — click any crumb to jump back. Use the stepper to set how many questions you want from this topic.',
      focus: focusId.qtyPlus('RBI & Monetary Policy'),
      state: sBanking,
      duration: 4200,
    },
    {
      title: 'Add — no interruption',
      caption:
        'Click Add. There is no pop-up asking what to do with it: the questions drop into a cart and you carry on browsing.',
      focus: focusId.addBtn('RBI & Monetary Policy'),
      state: sQty,
      duration: 4200,
    },
    {
      title: 'Mix as many topics as you like',
      caption:
        'Add from any level — a whole subject, a folder, or a single leaf. The cart survives switching subjects and content types.',
      focus: focusId.addBtn('Commercial Banking'),
      state: sCart1,
      duration: 4200,
    },
    {
      title: '35 questions queued',
      caption:
        'The cart bar tracks the running total against your 100-question cap. Open it when you have picked everything.',
      focus: focusId.cartBar,
      state: sCart2,
      duration: 4200,
    },
    {
      title: 'Name it yourself',
      caption:
        'Nothing is pre-filled on purpose — a test you named is a test you will recognise in three weeks.',
      focus: focusId.nameField,
      state: sCartOpen,
      duration: 4200,
    },
    {
      title: 'Save as a new test',
      caption:
        'Or push the same questions into a test you already have — the destination is chosen once, here, not on every Add.',
      focus: focusId.saveNew,
      state: sNamed,
      duration: 4200,
    },
    {
      title: 'It lands in My Tests',
      caption:
        'Saved tests are reusable — retake them, add more questions later, or share the same set across a study group.',
      focus: focusId.startTest,
      state: sMyTests,
      duration: 4200,
    },
    {
      title: 'Answer as you go',
      caption:
        'Timer top-right, live counters across the top. Every answer is saved to the server immediately — closing the tab never loses progress.',
      focus: focusId.option('B'),
      state: sAttempt,
      duration: 4200,
    },
    {
      title: 'Unsure? Flag it',
      caption:
        'Review-flagged questions turn amber in the Grid so you can sweep back through them before the timer runs out.',
      focus: focusId.reviewBtn,
      state: sAnswered,
      duration: 4200,
    },
    {
      title: 'Jump anywhere',
      caption:
        'The Grid is the full question palette — answered, flagged, skipped and unvisited, colour-coded. Click any number to go straight there.',
      focus: focusId.gridBtn,
      state: sMarked,
      duration: 4200,
    },
    {
      title: 'Submit',
      caption:
        'On the last question Next becomes Submit. Run out of time and the paper submits itself — nothing is lost.',
      focus: focusId.nextBtn,
      state: sLast,
      duration: 4200,
    },
    {
      title: 'Every question, explained',
      caption:
        'The review shows what you picked, what was right, and why — plus time spent per question and a topic-level accuracy breakdown.',
      state: sResult,
      duration: 4800,
    },
    {
      title: 'Send the misses to Revision',
      caption:
        'Mark for Revision on any question you got wrong. This is the durable bookmark — it outlives the attempt.',
      focus: focusId.markRevision,
      state: sResult,
      duration: 4200,
    },
    {
      title: 'The Revision tab',
      caption:
        'Everything you have flagged, from every test, filterable by topic. Tick the ones you want to drill again.',
      focus: focusId.startRevision,
      state: sRevision,
      duration: 4200,
    },
    {
      title: 'A fresh revision test',
      caption:
        'Auto-named for the topic and date, built only from your own misses. Same engine, same timer, same review afterwards.',
      state: sRevisionRunning,
      duration: 4400,
    },
    {
      title: 'That is the whole loop',
      caption:
        'Browse → add → name → attempt → review → revise. Everything you saw is one tab of the app, and none of it needs a subscription to try.',
      state: from(sRevisionRunning, { screen: 'outro' }),
      duration: 6000,
    },
  ];
}
