export function timeStringToDate(timeString: string) {
  const [hours, minutes] = timeString.split(':').map(Number);
  const now = new Date();
  now.setHours(hours, minutes, 0, 0); // set ms to 0
  return now;
}
