import { browserPopupRedirectResolver, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "../firebase/firebase";

// Web: Google sign-in in a pop-up window. (The phone version is googleSignIn.ts.)
export const googleSignInAvailable = true;

export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  // initializeAuth doesn't include the pop-up helper by default, so pass it here
  await signInWithPopup(auth, provider, browserPopupRedirectResolver);
}
