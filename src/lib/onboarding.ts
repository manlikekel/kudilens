/** Set once the user has finished or skipped the setup in /welcome (this device). */
export const ONBOARDED_KEY = "kudi-onboarded";

export function onboarded() {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === "1";
  } catch {
    return true;
  }
}
