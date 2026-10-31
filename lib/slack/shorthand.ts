import type { Extraction } from './extraction';

type Interval = Extraction['intervals'][number];

export function nextDate(value: string): string {
  return new Date(new Date(`${value}T12:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10);
}

export const KMD_OFFICES = [
  { city: 'Ballerup', office: 'KMD Ballerup', aliases: ['ballerup'] },
  { city: 'Odense', office: 'KMD Odense', aliases: ['odense'] },
  { city: 'Aalborg', office: 'KMD Aalborg', aliases: ['aalborg', 'ålborg'] },
  { city: 'Aarhus', office: 'KMD Aarhus', aliases: ['aarhus', 'århus'] },
  { city: 'Warszawa', office: 'KMD Warszawa', aliases: ['warszawa', 'warsaw'] },
] as const;

const kmdCityAliasPattern = KMD_OFFICES.flatMap((entry) => entry.aliases).join('|');
const kmdOfficeDescription = KMD_OFFICES.map((entry) => {
  const extraAliases = entry.aliases.filter((alias) => alias !== entry.city.toLowerCase());
  return extraAliases.length
    ? `${entry.city} (${extraAliases.map((alias) => alias[0].toUpperCase() + alias.slice(1)).join('/')}, ${entry.office})`
    : `${entry.city} (${entry.office})`;
}).join(', ');

// These workplace conventions feed both deterministic extraction and the AI prompt.
const simpleRules: {
  phrases: string[];
  status: Interval['status'];
  meaning: string;
  preserveText?: boolean;
}[] = [
  {
    phrases: [
      'wfh',
      'working from home',
      'work from home',
      'working from home today',
      'work from home today',
      'wfh today',
      'hjemme',
      'hjemmefra',
      'hjemmearbejde',
      'arbejder hjemme',
      'arbejder hjemmefra',
      'hjemme i dag',
      'hjemmefra i dag',
      'hjemmearbejde i dag',
      'arbejder hjemme i dag',
      'arbejder hjemmefra i dag',
    ],
    status: 'FROM_HOME',
    meaning: 'working from home',
  },
  {
    phrases: [
      'remote',
      'working remotely',
      'working remote',
      'work remotely',
      'work remote',
      'arbejder remote',
    ],
    status: 'REMOTE',
    meaning: 'working remotely outside the office and not from home',
  },
  {
    phrases: ['wfkk'],
    status: 'AT_CLIENT',
    meaning: 'working at KommuneKredit; KK means KommuneKredit',
    preserveText: true,
  },
  { phrases: ['sick', 'still sick'], status: 'SICK', meaning: 'sick' },
  { phrases: ['child sick'], status: 'CHILD_SICK', meaning: 'child sick' },
  {
    phrases: KMD_OFFICES.flatMap((entry) =>
      entry.aliases.flatMap((alias) => [`kmd ${alias}`, alias])
    ),
    status: 'AT_CLIENT',
    meaning: `working at a KMD office (${KMD_OFFICES.map((entry) => entry.office).join(', ')})`,
    preserveText: true,
  },
  {
    phrases: [
      'at conference',
      'conference',
      'på konference',
      'til konference',
      'konference',
      'offsite',
      'at offsite',
    ],
    status: 'AWAY',
    meaning: 'at conference or offsite event',
    preserveText: true,
  },
];
const lunchTime = '11:00';
export const SHORTHAND_INSTRUCTIONS = `Known Wørk channel conventions (the deterministic parser handles a subset of complete messages):
${simpleRules.map((rule) => `${rule.phrases.join(' / ')} means ${rule.meaning} (${rule.status}).`).join('\n')}
KMD has offices in ${kmdOfficeDescription}. Both explicit KMD office names (such as "KMD Ballerup", "KMD Aalborg", "WF KMD Aalborg ✈️") and city-only attendance declarations for these KMD cities (such as "Working from Aalborg today", "In Ballerup tomorrow", "In Odense tomorrow", "In Aarhus for a meeting with Daniel. See you tomorrow.", "I Århus i dag", or "Working in Warsaw today and tomorrow") mean working at the corresponding KMD office (AT_CLIENT) for the stated day or date range, with the entire original message preserved verbatim as comment so colleagues can see which KMD office they are at. Respect explicit context: "Working from home in Aalborg" or "WFH in Aarhus" remains FROM_HOME; vacation, sick leave, negation (e.g. "Not in Aalborg today"), a question about a city (e.g. "Anyone in Aarhus today?"), or a mention of someone else's location (e.g. "Daniel is in Odense today") must not mark the author as attending a KMD office. Unknown cities (such as Roskilde) do not invent a KMD office or client relationship.
"At conference" / "på konference" / "til konference" (and "offsite") means attendance exception AWAY with the entire original message preserved in comment. Phrases like "at conference today and tomorrow" (including common typos such as "tomorow") or "til konference i dag og i morgen" resolve to an AWAY interval spanning today through tomorrow, with the entire original message preserved as comment.
Lunch means ${lunchTime} Copenhagen time. "In at lunch" means arrival around ${lunchTime}, with an approximate end on IN_LATE. "Before lunch" means before ${lunchTime}; "after lunch" means after ${lunchTime}. For those relative lunch bounds use the nominal ${lunchTime} with the corresponding approximation flag and preserve the entire original message in the comment. Do not create IN_OFFICE at an approximate boundary. Starting at/from home means FROM_HOME initially; an office arrival ends that interval. Explicit clock times override the lunch default. An exact arrival at or before 09:00 is IN_OFFICE from that time, while a later exact arrival has an IN_LATE interval followed by IN_OFFICE. WFH rest of (the) day starts at the ORIGINAL message's local time.
Bare clock-only messages such as "9:30", "09:30", or "9.30" announce the author's office arrival on the message's local date. Apply the same arrival rules as "in at 09:30": IN_LATE with null startTime and endTime "09:30", followed by IN_OFFICE with startTime "09:30" and null endTime; both approximation flags false and comment null. An exact arrival at or before 09:00 only needs IN_OFFICE from that time. Use an explicitly stated date or approximation when present; a bare hour without minutes or an invalid clock still needs enough context to interpret it.
"WF" or "working from" followed by a named work location means working from that location. When it is a recognized KMD office or KMD office city (${KMD_OFFICES.map((entry) => entry.city).join(', ')} and their aliases), apply AT_CLIENT (for example, "WF KMD Aalborg ✈️" or "Working from Aalborg today" means AT_CLIENT with the full original message preserved as comment). When it is neither home nor an explicitly identified client or KMD office, apply REMOTE for the stated day or date range (the message's local date if omitted), with null times unless stated. Preserve the full original remote-work message verbatim as comment, including its location and emoji, rather than stripping its work phrase. For example, "Working from Roskilde today" means REMOTE with comment "Working from Roskilde today". Likewise, explicit remote-working statements when home working does not fit (such as "Working remotely today, not from home") mean REMOTE with the full message preserved as comment. Do not classify someone as AWAY solely because they are working remotely, and do not infer REMOTE from "not in the office" / "ikke på kontoret" alone when it is unclear whether the person is working or absent. Unlisted companies or cities do not establish a client relationship or KMD office.
Apply these meanings inside longer messages too, preserving all explicit transitions and availability qualifications. WFH with child sick states home working and a sick child, not complete unavailability: use FROM_HOME and preserve the entire original message as the comment. Never output overlapping statuses. Do not expand client names in comments: every non-null comment must be the entire original Slack message verbatim.`;

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

function isKmdLocation(location: string): boolean {
  return new RegExp(
    `^(?:(?:at|in|from|i|på|hos)\\s+)?(?:kmd\\s+)?(?:${kmdCityAliasPattern})(?:\\s+(?:office|kontor|kontoret))?$`,
    'i'
  ).test(location.trim());
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

  if (
    /^(?:wfh|working from home|work from home|hjemme|hjemmefra|hjemmearbejde|arbejder hjemme|arbejder hjemmefra)\s+(?:in|from|at|i|fra)\s+/i.test(
      normalized
    ) &&
    new RegExp(`^(?:wfh|working from home|work from home|hjemme|hjemmefra|hjemmearbejde|arbejder hjemme|arbejder hjemmefra)\\s+(?:in|from|at|i|fra)\\s+(?:kmd\\s+)?(?:${kmdCityAliasPattern})(?:\\s+(?:today|i dag))?$`, 'i').test(
      normalized
    )
  ) {
    return apply(interval('FROM_HOME', { comment: text.trim() }));
  }

  const simple = simpleRules.find((rule) => rule.phrases.includes(normalized));
  if (simple)
    return apply(interval(simple.status, { comment: simple.preserveText ? text.trim() : null }));

  const eventPhrases =
    '(?:at (?:a )?conference|conference|p[åa] konference|til konference|konference|at (?:an )?offsite|offsite|p[åa] kursus|til kursus|kursus)';
  const datePhrases =
    '(?:today (?:and|&|\\+) tomm?orr?ow|i dag (?:og|&) i morg[eo]n|tomm?orr?ow|i morg[eo]n|today|i dag)';

  const resolveDates = (matchedDate?: string) => {
    if (!matchedDate) return { fromDate: day, toDate: day };
    const isMultiDay = /(?:today (?:and|&|\+) tomm?orr?ow|i dag (?:og|&) i morg[eo]n)/i.test(
      matchedDate
    );
    const isTomorrow = /(?:tomm?orr?ow|i morg[eo]n)/i.test(matchedDate);
    return {
      fromDate: isTomorrow && !isMultiDay ? nextDate(day) : day,
      toDate: isMultiDay || isTomorrow ? nextDate(day) : day,
    };
  };

  const kmdPresenceTarget = `(?:(?:(?:in|at|from|i|på|hos)\\s+)?(?:kmd\\s+)?(?:${kmdCityAliasPattern})(?:\\s+(?:office|kontor|kontoret))?)`;
  const kmdPresenceRegex = new RegExp(
    `^(?:(${kmdPresenceTarget})(?:\\s*[,:\\-]?\\s+(${datePhrases}))?|(${datePhrases})\\s*[,:\\-]?\\s+(${kmdPresenceTarget}))$`,
    'i'
  );
  const kmdPresenceMatch = normalized.match(kmdPresenceRegex);
  if (kmdPresenceMatch) {
    const matchedDate = kmdPresenceMatch[2] ?? kmdPresenceMatch[3];
    return apply(
      interval('AT_CLIENT', {
        ...resolveDates(matchedDate),
        comment: text.trim(),
      })
    );
  }

  const conferenceRegex = new RegExp(
    `^(?:(${eventPhrases})\\s*[,:\\-]?\\s+(${datePhrases})|(${datePhrases})\\s*[,:\\-]?\\s+(${eventPhrases}))$`,
    'i'
  );
  const conferenceMatch = normalized.match(conferenceRegex);
  if (conferenceMatch) {
    const matchedEvent = conferenceMatch[1] ?? conferenceMatch[4];
    const matchedDate = conferenceMatch[2] ?? conferenceMatch[3];
    const { fromDate, toDate } = resolveDates(matchedDate);

    const excerptMatch = text.match(
      new RegExp(`(?:^|[^\\p{L}\\p{N}])(${eventPhrases})(?=[^\\p{L}\\p{N}]|$)`, 'iu')
    );
    const comment = excerptMatch ? excerptMatch[1].trim() : matchedEvent;

    return apply(
      interval('AWAY', {
        fromDate,
        toDate,
        comment,
      })
    );
  }

  const remotePhrases =
    '(?:(?:working|work) remotely|(?:working|work) remote|arbejder remote|remote|(?:working|work) outside (?:of )?the office|arbejder uden ?for kontoret)';
  const notHomePhrases = '(?:not (?:working )?(?:from|at) home|ikke hjemmefra|ikke hjemme)';
  const remoteQualificationRegex = new RegExp(
    `^(?:(${remotePhrases})(?:\\s*[,:\\-]?\\s+(${datePhrases}))?(?:\\s*[,:\\-]?\\s+(${notHomePhrases}))?|(${remotePhrases})\\s*[,:\\-]?\\s+(${notHomePhrases})\\s*[,:\\-]?\\s+(${datePhrases})|(${datePhrases})\\s*[,:\\-]?\\s+(${remotePhrases})(?:\\s*[,:\\-]?\\s+(${notHomePhrases}))?)$`,
    'i'
  );
  const remoteMatch = normalized.match(remoteQualificationRegex);
  if (remoteMatch) {
    const matchedRemote = remoteMatch[1] ?? remoteMatch[4] ?? remoteMatch[8];
    const matchedDate = remoteMatch[2] ?? remoteMatch[6] ?? remoteMatch[7];
    const matchedNotHome = remoteMatch[3] ?? remoteMatch[5] ?? remoteMatch[9];
    const hasExtraContext =
      Boolean(matchedNotHome) ||
      /(?:outside (?:of )?the office|uden ?for kontoret)/i.test(matchedRemote);
    return apply(
      interval('REMOTE', {
        ...resolveDates(matchedDate),
        comment: hasExtraContext ? text.trim() : null,
      })
    );
  }

  const workFromPrefix =
    '(?:(?:working|work)(?: remotely)? (?:from|in|at)|remote (?:from|in|at)|wf|arbejder(?: remote)? (?:fra|i|på|hos))';
  const workFromWithDateEnd = normalized.match(
    new RegExp(`^${workFromPrefix}\\s+(.+?)\\s*[,:\\-]?\\s+(${datePhrases})$`, 'i')
  );
  const workFromWithDateStart = workFromWithDateEnd
    ? null
    : normalized.match(
        new RegExp(`^(${datePhrases})\\s*[,:\\-]?\\s+${workFromPrefix}\\s+(.+)$`, 'i')
      );
  const workFromNoDate =
    workFromWithDateEnd || workFromWithDateStart
      ? null
      : normalized.match(new RegExp(`^${workFromPrefix}\\s+(.+)$`, 'i'));
  const location = (
    workFromWithDateEnd?.[1] ??
    workFromWithDateStart?.[2] ??
    workFromNoDate?.[1]
  )?.trim();
  const locationDate = workFromWithDateEnd?.[2] ?? workFromWithDateStart?.[1];
  if (location && isKmdLocation(location)) {
    return apply(
      interval('AT_CLIENT', {
        ...resolveDates(locationDate),
        comment: text.trim(),
      })
    );
  }
  if (
    location &&
    !/[,;?:()\d]/.test(location) &&
    !/^(?:home|my home|hjemme|hjem|mit hjem|(?:the )?office|kontoret|kontor|(?:the |a )?client|kunden|kunde|kk|kommunekredit|(?:a )?conference|konference|(?:an )?offsite|kursus)$/i.test(
      location
    ) &&
    !/\b(?:in|at|until|till|before|after|from|then|and|or|but|with|so|because|around|ca|kl|indtil|før|efter|så|men|med|fordi|omkring|hjemme|hjemmefra|home|office|kontoret|client|kunden|sick|syg|vacation|ferie|leave|orlov|later|senere|early|tidligt|lunch|frokost|morning|afternoon|morgen|middag|eftermiddag|week|uge|ugen|rest|resten|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag|not|ikke)\b/i.test(
      location
    )
  ) {
    return apply(
      interval('REMOTE', {
        ...resolveDates(locationDate),
        comment: text.trim(),
      })
    );
  }

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
