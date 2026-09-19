import type { Extraction } from './extraction';

type Interval = Extraction['intervals'][number];

// These workplace conventions feed both deterministic extraction and the AI prompt.
const simpleRules: {
  phrases: string[];
  status: Interval['status'];
  meaning: string;
  preserveText?: boolean;
}[] = [
  { phrases: ['wfh'], status: 'FROM_HOME', meaning: 'working from home' },
  {
    phrases: ['wfkk'],
    status: 'AT_CLIENT',
    meaning: 'working at KommuneKredit; KK means KommuneKredit',
    preserveText: true,
  },
  { phrases: ['sick', 'still sick'], status: 'SICK', meaning: 'sick' },
  { phrases: ['child sick'], status: 'CHILD_SICK', meaning: 'child sick' },
  {
    phrases: ['kmd ballerup'],
    status: 'AT_CLIENT',
    meaning: 'working at KMD Ballerup',
    preserveText: true,
  },
];
const lunchTime = '11:00';
export const SHORTHAND_INSTRUCTIONS = `Known Wørk channel conventions, also used by the deterministic parser:
${simpleRules.map((rule) => `${rule.phrases.join(' / ')} means ${rule.meaning} (${rule.status}).`).join('\n')}
Lunch means ${lunchTime} Copenhagen time. "In at lunch" means arrival around ${lunchTime}, with an approximate end on IN_LATE. "Before lunch" means before ${lunchTime}; "after lunch" means after ${lunchTime}. For those relative lunch bounds use the nominal ${lunchTime} with the corresponding approximation flag and preserve the original relative wording in a verbatim comment. Do not create IN_OFFICE at an approximate boundary. Starting at/from home means FROM_HOME initially; an office arrival ends that interval. Explicit clock times override the lunch default. An exact arrival at or before 09:00 is IN_OFFICE from that time, while a later exact arrival has an IN_LATE interval followed by IN_OFFICE. WFH rest of (the) day starts at the ORIGINAL message's local time.
Apply these meanings inside longer messages too, preserving all explicit transitions and availability qualifications. WFH with child sick states home working and a sick child, not complete unavailability: use FROM_HOME and preserve the sick-child wording as a comment. Never output overlapping statuses. Bare clock-only messages have no confirmed office-arrival convention: return review with uncertain_status. Do not expand client names in comments: comments must still be verbatim sender excerpts.`;

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/:[a-z0-9_+-]+:/g, ' ')
    .replace(/\p{Extended_Pictographic}|\uFE0F|\u200D/gu, ' ')
    .replace(/\(edited\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!]+$/, '')
    .trim();
}

/** Only consume complete supported messages. Any extra clause belongs to the AI. */
export function extractShorthand(text: string, day: string, localTime: string): Extraction | null {
  const normalized = normalize(text);
  const interval = (status: Interval['status'], fields: Partial<Interval> = {}): Interval => ({
    status,
    fromDate: day,
    toDate: day,
    startTime: null,
    endTime: null,
    startApproximate: false,
    endApproximate: false,
    comment: null,
    ...fields,
  });
  const apply = (...intervals: Interval[]): Extraction => ({
    decision: 'apply',
    reason: 'clear',
    intervals,
  });
  const simple = simpleRules.find((rule) => rule.phrases.includes(normalized));
  if (simple)
    return apply(interval(simple.status, { comment: simple.preserveText ? text.trim() : null }));
  if (/^wfh rest of (?:the )?day$/.test(normalized)) {
    return apply(interval('FROM_HOME', { startTime: localTime }));
  }
  const arrival = normalized.match(/^in (?:(?:at|the office at) )?(\d{1,2})(?:[.:](\d{2}))?$/);
  if (arrival) {
    const hour = Number(arrival[1]);
    const minute = Number(arrival[2] ?? 0);
    if (hour > 23 || minute > 59) return null;
    const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    if (time === '00:00') return apply(interval('IN_OFFICE'));
    // Arrivals before the normal 09:00 Copenhagen start are ordinary office
    // arrivals rather than late arrivals.
    if (hour < 9 || (hour === 9 && minute === 0)) {
      return apply(interval('IN_OFFICE', { startTime: time }));
    }
    return apply(
      interval('IN_LATE', { endTime: time }),
      interval('IN_OFFICE', { startTime: time })
    );
  }
  const transition = normalized.match(
    /^(?:wfh|starting (?:at|from) home)\s*[,\-]?\s+in (?:at |@)?(\d{1,2})(?:[.:](\d{2}))?$/
  );
  if (transition) {
    const hour = Number(transition[1]);
    const minute = Number(transition[2] ?? 0);
    if (hour > 23 || minute > 59 || (hour === 0 && minute === 0)) return null;
    const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    return apply(
      interval('FROM_HOME', { endTime: time }),
      interval('IN_OFFICE', { startTime: time })
    );
  }
  if (/^in (?:before|after) lunch$/.test(normalized)) {
    return apply(
      interval('IN_LATE', { endTime: lunchTime, endApproximate: true, comment: text.trim() })
    );
  }
  if (normalized === 'in at lunch') {
    return apply(interval('IN_LATE', { endTime: lunchTime, endApproximate: true }));
  }
  const homeArrival = normalized.match(
    /^(?:starting (?:at|from) home|wfh(?: now)?)\s*[,\-]?\s+(?:in|(?:at the |in the |in )office) (at|before|after) lunch$/
  );
  if (homeArrival) {
    return apply(
      interval('FROM_HOME', {
        endTime: lunchTime,
        endApproximate: true,
        comment: text.trim(),
      })
    );
  }
  return null;
}
