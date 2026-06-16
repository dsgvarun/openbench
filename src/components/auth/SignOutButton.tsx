import { signOut } from "@/lib/auth/actions";

// Server component: posts to the signOut server action (works without client JS).
export function SignOutButton({ className = "" }: { className?: string }) {
  return (
    <form action={signOut}>
      <button type="submit" className={className || "text-sm font-semibold text-n1"}>
        Sign out
      </button>
    </form>
  );
}
