import { AssessmentDemo } from '../../../components/assessment/demo/assessment-demo';

export const metadata = {
  title: 'How the assessment section works',
  description:
    'A step-by-step walkthrough: pick questions from a category, save them as a revision test, attempt it, and turn your mistakes into the next test.',
};

// No Suspense boundary here on purpose: AssessmentDemo never suspends (it reads
// no search params and fetches nothing), and wrapping it left React's streamed
// fallback copy behind in a hidden div — mounting the player twice, with two
// auto-advance timers running against each other.
export default function AssessmentDemoPage() {
  return <AssessmentDemo />;
}
