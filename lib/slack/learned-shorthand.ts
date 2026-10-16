import { isDeepStrictEqual } from 'node:util';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { learnedShorthands, shorthandObservations, type ShorthandTemplate } from '@/db/schema';
import {
  ATTENDANCE_TIME_ZONE,
  copenhagenDate,
  validateExtraction,
  type Extraction,
} from './extraction';
import { extractShorthand } from './shorthand';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type PhraseKey = { teamId: string; channelId: string; phrase: string };

// Recurring announcements are short; longer texts are left to AI and never retained here.
const MAX_PHRASE_LENGTH = 100;

const word = (alternatives: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives})(?![\\p{L}\\p{N}])`, 'u');

// The same wording can mean different days or clocks depending on when it is sent, or can
// turn a familiar phrase around. Such phrases are never learned and always reach AI.
const UNLEARNABLE = [
  // Weekdays, months and holidays.
  word(
    'mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?|(?:man|tirs|ons|tors|fre|lør|søn)(?:dag\\p{L}*)?'
  ),
  word(
    'jan(?:uary|uar)?|feb(?:ruary|ruar)?|mar(?:ch|ts)?|apr(?:il)?|may|maj|jun[ei]?|jul[yi]?|aug(?:ust)?|sep(?:t|tember)?|o[ck]t(?:ober)?|nov(?:ember)?|dec(?:ember)?'
  ),
  word('christmas|xmas|easter|påske\\p{L}*'),
  // Weeks and periods relative to the calendar.
  word(
    'weeks?|weekends?|weekend\\p{L}+|uge\\p{L}*|next|næste|last|sidste|coming|kommende|following|følgende'
  ),
  // Numeric dates, years, ordinals and week numbers.
  /\d{1,2}\s*[./-]\s*\d{1,2}|\d{3,}|\d+\s*(?:st|nd|rd|th)(?![\p{L}])|(?<![\p{L}])(?:the|den|d\.)\s*\d|(?<![\p{L}])w\d/u,
  // The moment of sending.
  word('now|nu|rest|resten|asap|straks|soon|snart'),
  // Negation.
  word(
    "not|no|nope|never|cannot|ikke|ingen|intet|aldrig|\\p{L}+n['’]t|dont|doesnt|didnt|isnt|arent|wasnt|werent|wont|cant|aint"
  ),
];

const localClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: ATTENDANCE_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function shiftDate(day: string, days: number) {
  return new Date(Date.parse(`${day}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}

function dayOffset(from: string, to: string) {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);
}

function foldComment(comment: string) {
  return comment.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** The sender's own wording for a case-folded excerpt, or null when it is not in the text. */
function findExcerpt(text: string, folded: string) {
  const pattern = folded
    .split(' ')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'))
    .join('\\s+');
  return text.match(new RegExp(pattern, 'iu'))?.[0] ?? null;
}

/**
 * The whole message as a learnable phrase, or null when it cannot be learned: too long, a
 * question, already handled by the fixed shorthand parser, or worded in a way whose meaning
 * depends on the sending day or moment.
 */
export function learningPhrase(text: string, messageInstant: Date): string | null {
  const phrase = text
    .toLowerCase()
    .replace(/\(edited\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!]+$/, '')
    .trim();
  if (!phrase || phrase.length > MAX_PHRASE_LENGTH || phrase.includes('?')) return null;
  if (UNLEARNABLE.some((pattern) => pattern.test(phrase))) return null;
  if (extractShorthand(text, copenhagenDate(messageInstant), localClock.format(messageInstant)))
    return null;
  return phrase;
}

/**
 * A reusable form of an applied extraction: dates become offsets from the message's
 * Copenhagen date so a later message resolves them from its own timestamp. Returns null when
 * a clock equals the sending time, since it was probably read from the moment of sending.
 */
export function templateFromExtraction(
  extraction: Extraction,
  messageInstant: Date
): ShorthandTemplate | null {
  if (extraction.decision !== 'apply' || !extraction.intervals.length) return null;
  const day = copenhagenDate(messageInstant);
  const clock = localClock.format(messageInstant);
  if (extraction.intervals.some((i) => i.startTime === clock || i.endTime === clock)) return null;
  return {
    intervals: extraction.intervals.map(({ fromDate, toDate, comment, ...interval }) => ({
      ...interval,
      fromOffset: dayOffset(day, fromDate),
      toOffset: dayOffset(day, toDate),
      comment: comment === null ? null : foldComment(comment),
    })),
  };
}

/**
 * The validated extraction a learned template gives for a new message, or null when it does
 * not fit that message, so AI reads it instead.
 */
export function extractionFromTemplate(
  template: ShorthandTemplate,
  text: string,
  messageInstant: Date
): Extraction | null {
  const day = copenhagenDate(messageInstant);
  const intervals = [];
  for (const { fromOffset, toOffset, comment, ...interval } of template.intervals) {
    const excerpt = comment === null ? null : findExcerpt(text, comment);
    if (comment !== null && !excerpt) return null;
    intervals.push({
      ...interval,
      fromDate: shiftDate(day, fromOffset),
      toDate: shiftDate(day, toOffset),
      comment: excerpt,
    });
  }
  try {
    return validateExtraction(
      { decision: 'apply', reason: 'clear', intervals },
      messageInstant,
      text
    );
  } catch {
    return null;
  }
}

/** Positive whole number of consistent AI readings needed to learn a phrase; null disables learning. */
export function learningThreshold(env: NodeJS.ProcessEnv = process.env): number | null {
  const value = env.SLACK_SHORTHAND_LEARNING_THRESHOLD?.trim();
  if (!value || !/^\d+$/.test(value)) return null;
  const threshold = Number(value);
  return threshold >= 1 ? threshold : null;
}

/** How an active learned shorthand reads a message, if learning is enabled and one matches it. */
export async function readLearnedShorthand(
  channel: { teamId: string; channelId: string },
  text: string,
  messageInstant: Date
) {
  const phrase = learningThreshold() === null ? null : learningPhrase(text, messageInstant);
  if (!phrase) return { phrase, learnedShorthandId: null, template: null, extraction: null };
  const [rule] = await db
    .select({ id: learnedShorthands.id, template: learnedShorthands.template })
    .from(learnedShorthands)
    .where(
      and(
        isPhrase(learnedShorthands, { ...channel, phrase }),
        eq(learnedShorthands.state, 'active')
      )
    )
    .limit(1);
  const extraction = rule ? extractionFromTemplate(rule.template, text, messageInstant) : null;
  return extraction
    ? { phrase, learnedShorthandId: rule.id, template: rule.template, extraction }
    : { phrase, learnedShorthandId: null, template: null, extraction };
}

function isPhrase(table: typeof learnedShorthands | typeof shorthandObservations, key: PhraseKey) {
  return and(
    eq(table.teamId, key.teamId),
    eq(table.channelId, key.channelId),
    eq(table.phrase, key.phrase)
  );
}

// Serializes evidence, promotion and blocking for one phrase across concurrent workers.
async function lockPhrase(tx: Transaction, key: PhraseKey) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`${key.teamId}:${key.channelId}:${key.phrase}`}, 0))`
  );
}

/** Distinct readings of a phrase, with the AI readings behind each and how many were corrected. */
async function phraseReadings(tx: Transaction, key: PhraseKey) {
  return tx
    .select({
      template: shorthandObservations.template,
      occurrences: sql<number>`(count(*) filter (where ${shorthandObservations.source} = 'model'))::integer`,
      corrected: sql<number>`count(${shorthandObservations.correctedAt})::integer`,
    })
    .from(shorthandObservations)
    .where(isPhrase(shorthandObservations, key))
    .groupBy(shorthandObservations.template);
}

async function blockPhrase(
  tx: Transaction,
  key: PhraseKey,
  reading: { template: ShorthandTemplate; occurrences: number },
  reason: 'conflict' | 'correction',
  correctionId: number | null,
  now: Date
) {
  const blocked = {
    state: 'blocked' as const,
    blockedAt: now,
    blockedReason: reason,
    blockedByCorrectionId: correctionId,
  };
  // An active rule keeps its template and support so the blocked mapping can be investigated.
  await tx
    .insert(learnedShorthands)
    .values({
      teamId: key.teamId,
      channelId: key.channelId,
      phrase: key.phrase,
      template: reading.template,
      occurrences: reading.occurrences,
      ...blocked,
    })
    .onConflictDoUpdate({
      target: [learnedShorthands.teamId, learnedShorthands.channelId, learnedShorthands.phrase],
      set: blocked,
      setWhere: eq(learnedShorthands.state, 'active'),
    });
  console.info('slack_shorthand_blocked', { reason, correctionId });
}

/**
 * Record how the current revision of a message was read, then learn its phrase once enough
 * AI readings agree. Conflicting readings block the phrase for good.
 */
export async function recordShorthandObservation(
  tx: Transaction,
  observation: PhraseKey & {
    messageKey: string;
    revision: string;
    template: ShorthandTemplate;
    learnedShorthandId: number | null;
  },
  threshold: number | null,
  now: Date = new Date()
) {
  await lockPhrase(tx, observation);
  const values = {
    ...observation,
    source: observation.learnedShorthandId ? ('learned' as const) : ('model' as const),
    correctedAt: null,
    correctionId: null,
    observedAt: now,
  };
  await tx
    .insert(shorthandObservations)
    .values(values)
    .onConflictDoUpdate({ target: shorthandObservations.messageKey, set: values });
  const [rule] = await tx
    .select({ state: learnedShorthands.state })
    .from(learnedShorthands)
    .where(isPhrase(learnedShorthands, observation));
  if (rule?.state === 'blocked') return;
  const readings = await phraseReadings(tx, observation);
  const corrected = readings.find((reading) => reading.corrected > 0);
  if (corrected) return blockPhrase(tx, observation, corrected, 'correction', null, now);
  if (readings.length > 1) {
    const [mostFrequent] = readings.sort((a, b) => b.occurrences - a.occurrences);
    return blockPhrase(tx, observation, mostFrequent, 'conflict', null, now);
  }
  const [reading] = readings;
  if (rule || threshold === null || !reading || reading.occurrences < threshold) return;
  const [learned] = await tx
    .insert(learnedShorthands)
    .values({
      teamId: observation.teamId,
      channelId: observation.channelId,
      phrase: observation.phrase,
      template: reading.template,
      state: 'active',
      occurrences: reading.occurrences,
      promotedAt: now,
    })
    .onConflictDoNothing()
    .returning({ id: learnedShorthands.id });
  if (learned)
    console.info('slack_shorthand_learned', { id: learned.id, occurrences: reading.occurrences });
}

/** A newer revision without a learnable reading no longer supports its earlier phrase. */
export async function forgetShorthandObservation(tx: Transaction, messageKey: string) {
  await tx.delete(shorthandObservations).where(eq(shorthandObservations.messageKey, messageKey));
}

/**
 * A person corrected the status a message revision produced. Its reading was wrong, so the
 * phrase is blocked: an active learned shorthand stops matching and it is never learned again.
 */
export async function blockCorrectedShorthand(
  tx: Transaction,
  correction: { messageKey: string; revision: string | null; correctionId: number },
  now: Date = new Date()
) {
  if (!correction.revision) return;
  const [observation] = await tx
    .select()
    .from(shorthandObservations)
    .where(
      and(
        eq(shorthandObservations.messageKey, correction.messageKey),
        eq(shorthandObservations.revision, correction.revision)
      )
    );
  if (!observation) return;
  await lockPhrase(tx, observation);
  await tx
    .update(shorthandObservations)
    .set({ correctedAt: now, correctionId: correction.correctionId })
    .where(
      and(
        eq(shorthandObservations.messageKey, correction.messageKey),
        isNull(shorthandObservations.correctedAt)
      )
    );
  const readings = await phraseReadings(tx, observation);
  const occurrences =
    readings.find((reading) => isDeepStrictEqual(reading.template, observation.template))
      ?.occurrences ?? 0;
  await blockPhrase(
    tx,
    observation,
    { template: observation.template, occurrences },
    'correction',
    correction.correctionId,
    now
  );
}
