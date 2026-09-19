// Add this helper at the top of your file:
export const formatDate = (date?: Date) => {
  if (!date) return '';
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${d}-${m}-${y}`;
};

export function formatDateRange(
  fromDate: string | null | undefined,
  toDate: string | null | undefined
): string | null {
  if (!fromDate || !toDate || fromDate === toDate) {
    return null;
  }

  const startParts = fromDate.split('-');
  const endParts = toDate.split('-');

  if (startParts.length === 3 && endParts.length === 3) {
    const startYear = startParts[0];
    const startMonth = startParts[1].padStart(2, '0');
    const startDay = startParts[2].padStart(2, '0');

    const endYear = endParts[0];
    const endMonth = endParts[1].padStart(2, '0');
    const endDay = endParts[2].padStart(2, '0');

    if (startYear === endYear) {
      return `${startDay}.${startMonth}-${endDay}.${endMonth}`;
    }

    return `${startDay}.${startMonth}.${startYear}-${endDay}.${endMonth}.${endYear}`;
  }

  return `${fromDate}-${toDate}`;
}
