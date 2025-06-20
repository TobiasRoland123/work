const isValidCharlieTangoEmail = (email: string): boolean => {
  if (!email) return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@charlietango\.dk$/;
  return emailRegex.test(email);
};
export default isValidCharlieTangoEmail;
// This function checks if the provided email is a valid Charlie Tango email address.
// It returns true if the email matches the pattern, otherwise false.
