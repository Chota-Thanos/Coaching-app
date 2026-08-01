import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import {
  GeneratedContentPublishError,
  PUBLISH_AI_CONFIRMATION,
  __resetProvenanceForTests,
  assertPublishable,
  findGeneratedContent,
  recordGenerated,
} from './provenance.js';

/**
 * The rule under test: content this server generated goes to drafts unless the
 * user explicitly asked for it to be published, in which case the caller must
 * pass the exact confirmation value.
 *
 * It is enforced here, in code, precisely because a rule living in a
 * client-side instructions file disappears the moment a different client
 * connects.
 */

// Long enough to be fingerprinted; mirrors a real generated article body.
const GENERATED_BODY =
  'The Monetary Policy Committee was constituted under Section 45ZB of the RBI Act, 1934, ' +
  'inserted by the Finance Act, 2016. It has six members, three of whom are nominated by ' +
  'the Central Government, and the Governor holds a casting vote when the committee ties.';

const HUMAN_BODY =
  'This passage was typed by a member of staff in a Word document and has never been near ' +
  'the generation tools. It is long enough to be fingerprinted, so it proves the check is ' +
  'matching on content rather than simply blocking everything after a generation runs.';

const generationResponse = {
  articles: [{ title: 'MPC explained', sections: [{ content: GENERATED_BODY }] }],
};

beforeEach(() => __resetProvenanceForTests());

test('generated prose is held back from publishing by default', () => {
  recordGenerated(generationResponse);

  assert.throws(
    () => assertPublishable('auto', [{ title: 'MPC explained', body: GENERATED_BODY }]),
    GeneratedContentPublishError,
  );
});

test('the same batch is allowed through as drafts', () => {
  recordGenerated(generationResponse);

  assert.doesNotThrow(() =>
    assertPublishable('review', [{ title: 'MPC explained', body: GENERATED_BODY }]),
  );
});

test('a human-written document still publishes normally after a generation ran', () => {
  recordGenerated(generationResponse);

  // The check must match on content, not on "did this session ever generate" —
  // otherwise posting a Word file would break for the rest of the session.
  assert.doesNotThrow(() =>
    assertPublishable('auto', [{ title: 'Staff write-up', body: HUMAN_BODY }]),
  );
});

test('nothing is blocked before any generation has happened', () => {
  assert.doesNotThrow(() =>
    assertPublishable('auto', [{ title: 'MPC explained', body: GENERATED_BODY }]),
  );
});

test('reformatting does not sneak generated text past the check', () => {
  recordGenerated(generationResponse);

  const reformatted = `**${GENERATED_BODY.toUpperCase()}**`.replace(/ /g, '\n  ');
  assert.throws(() => assertPublishable('auto', [{ body: reformatted }]), GeneratedContentPublishError);
});

test('generated question stems are caught too, not just article bodies', () => {
  recordGenerated({ questions: [{ question_statement: GENERATED_BODY }] });

  assert.throws(
    () => assertPublishable('auto', { questions: [{ question_statement: GENERATED_BODY }] }),
    GeneratedContentPublishError,
  );
});

test('generated text nested anywhere in the payload is found', () => {
  recordGenerated(generationResponse);

  const deeplyNested = { batch: { items: [{ articles: [{ body: GENERATED_BODY }] }] } };
  assert.equal(findGeneratedContent(deeplyNested).length, 1);
});

test('short strings are not fingerprinted, so unrelated batches never collide', () => {
  recordGenerated({ articles: [{ title: 'Economy' }] });

  assert.doesNotThrow(() => assertPublishable('auto', [{ title: 'Economy' }]));
});

test('prose under a style guide\'s custom field names is still caught', () => {
  // Style guides carry their own output_schema, so generated prose arrives
  // under arbitrary keys. A field-name allow-list missed this entirely and let
  // the publish through — the check must be shape-agnostic.
  recordGenerated({
    title: 'MPC explained',
    latest_updates: [{ description: GENERATED_BODY }],
    about_monetary_policy_committee: { overview: GENERATED_BODY },
  });

  assert.throws(
    () => assertPublishable('auto', [{ body: GENERATED_BODY }]),
    GeneratedContentPublishError,
  );
});

test('long URLs and tokens are not fingerprinted', () => {
  const url = 'https://www.rbi.org.in/scripts/BS_PressReleaseDisplay.aspx?prid=' + '9'.repeat(90);
  const token = 'a'.repeat(200);
  recordGenerated({ sources: [url], blob: token });

  // A human article citing the same source must not be blocked by it.
  assert.doesNotThrow(() =>
    assertPublishable('auto', [{ title: 'Staff piece', source_url: url, body: HUMAN_BODY }]),
  );
  assert.doesNotThrow(() => assertPublishable('auto', [{ body: token }]));
});

test('the user can publish AI content by explicitly confirming it', () => {
  recordGenerated(generationResponse);

  assert.doesNotThrow(() =>
    assertPublishable('auto', [{ body: GENERATED_BODY }], PUBLISH_AI_CONFIRMATION),
  );
});

test('a wrong or guessed confirmation value does not unlock publishing', () => {
  recordGenerated(generationResponse);

  for (const attempt of ['true', 'yes', 'PUBLISH', 'publish_ai_content', '']) {
    assert.throws(
      () => assertPublishable('auto', [{ body: GENERATED_BODY }], attempt),
      GeneratedContentPublishError,
      `"${attempt}" should not have unlocked publishing`,
    );
  }
});

test('the refusal explains both routes without inviting the model to self-authorise', () => {
  recordGenerated(generationResponse);

  try {
    assertPublishable('auto', [{ body: GENERATED_BODY }]);
    assert.fail('expected the publish to be held back');
  } catch (error) {
    assert.ok(error instanceof GeneratedContentPublishError);
    assert.match(error.message, /publish_mode: "review"/);
    assert.match(error.message, new RegExp(PUBLISH_AI_CONFIRMATION));
    assert.match(error.message, /not use the confirmation on your own initiative/i);
    assert.equal(error.matches.length, 1);
  }
});
