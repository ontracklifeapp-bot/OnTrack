// Phone: Google sign-in needs separate iOS/Android client IDs (expo-auth-session),
// which aren't set up yet — so the button is hidden on the phone app for now.
export const googleSignInAvailable = false;

export async function signInWithGoogle(): Promise<void> {
  throw new Error("Google sign-in is only available on the website for now.");
}
