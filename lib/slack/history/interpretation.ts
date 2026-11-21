import type { Extraction } from '../extraction';

type Interval = Extraction['intervals'][number];

// A date-only home interval lasts to midnight. A partial-day declaration must
// supply its own end, even if the extractor returns a confident full day.
const partialDay =
  /\b(?:until|before|later|afterwards?|first|then|morning|half.day|for now|start(?:ing)? (?:out |off )?(?:at |from )?home|coming in|come in|head(?:ing)? in|indtil|først|senere|bagefter|derefter|formiddag(?:en)?|halv(?:e|del)? dag|starter hjemme|kommer ind)\b|\btil\s+(?:kl\.?|middag|frokost|jeg|vi|\d)/iu;

const home = String.raw`\b(?:wfh|(?:from |at )home|hjemme(?:fra|arbejde)?)\b`;
const office = String.raw`\b(?:office|kontoret)\b`;
const until = String.raw`\s+(?:until|til|indtil)\s+(?:kl\.?\s*)?`;
const transition = String.raw`\s*[,;.-]?\s*(?:(?:and |og )?(?:then|derefter|så)\s+)?`;
const negation = /\b(?:not|never|ikke|aldrig|maybe|måske)\b|n['’]t\b/iu;

function clockPattern(time: string) {
  const [hour, minute] = time.split(':').map(Number);
  const minutes = minute ? `[:.]${String(minute).padStart(2, '0')}` : '(?:[:.]00)?';
  const suffix = hour < 12 ? 'am' : 'pm';
  // A 12-hour clock must match the stated meridiem. Do not match a prefix
  // of a longer time or treat 10 pm as a source for 10:00.
  return `(?:0?${hour % 12 || 12}${minutes}\\s*${suffix}\\b|0?${hour}${minutes}(?!\\s*(?:am|pm)\\b))(?!\\d|[:.]\\d)`;
}

function statedBoundary(source: string, interval: Interval, intervals: Interval[]) {
  if (negation.test(source)) return false;
  const officeRows = intervals.filter((r) => r.status === 'IN_OFFICE');
  if (officeRows.length > 1) return false;
  const officeRow = officeRows[0];
  if (officeRow && officeRow.fromDate !== interval.fromDate) return false;

  if (interval.startTime && interval.endTime) {
    if (officeRow) return false;
    return new RegExp(
      home +
        String.raw`\s+(?:from|fra)\s+(?:kl\.?\s*)?` +
        clockPattern(interval.startTime) +
        String.raw`\s+(?:to|until|til|indtil)\s+(?:kl\.?\s*)?` +
        clockPattern(interval.endTime),
      'iu'
    ).test(source);
  }
  if (interval.endTime) {
    const homeUntil = home + until + clockPattern(interval.endTime);
    if (!officeRow) return new RegExp(homeUntil, 'iu').test(source);
    // The clock ending home work alone cannot establish an office return.
    if (officeRow.startTime !== interval.endTime || officeRow.endTime) return false;
    const untilThenOffice = new RegExp(
      homeUntil + transition + String.raw`(?:back |in |at |the |på |til )*` + office,
      'iu'
    );
    // An exact office arrival can also bound an explicitly declared start at home.
    // Match the whole declaration so another person's arrival or a later qualification
    // cannot supply the missing boundary.
    const startsHome =
      String.raw`^\s*(?:(?:i(?:'m| am| will)?|jeg)\s+)?(?:start(?:ing)?|starter)\s+` + home;
    const officeAt = String.raw`(?:(?:at|in)\s+(?:the\s+)?office\s+(?:at|@)|på\s+kontoret\s+kl\.?)\s*`;
    const startsHomeThenOffice = new RegExp(
      startsHome +
        transition +
        officeAt +
        clockPattern(interval.endTime) +
        String.raw`\s*[.!]?\s*$`,
      'iu'
    );
    return untilThenOffice.test(source) || startsHomeThenOffice.test(source);
  }
  if (!interval.startTime) return false;
  const start = clockPattern(interval.startTime);
  const homeFrom = new RegExp(home + String.raw`\s+(?:from|fra)\s+(?:kl\.?\s*)?` + start, 'iu');
  const officeUntilHome = new RegExp(
    office + until + start + transition + String.raw`(?:working |arbejder )?` + home,
    'iu'
  );
  if (!officeRow) return homeFrom.test(source) || officeUntilHome.test(source);
  return (
    officeRow.endTime === interval.startTime && !officeRow.startTime && officeUntilHome.test(source)
  );
}

export function historicalReviewReason(source: string, intervals: Interval[]) {
  if (intervals.some((r) => r.status === 'AWAY') && intervals.some((r) => r.status === 'IN_OFFICE'))
    return 'absence_and_office_presence_requires_review';

  if (
    intervals.some(
      (r) =>
        r.status === 'FROM_HOME' &&
        (r.startTime || r.endTime || partialDay.test(source)) &&
        !statedBoundary(source, r, intervals)
    )
  )
    return 'partial_day_home_boundary_requires_review';
  return null;
}
