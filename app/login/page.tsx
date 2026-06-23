import { signIn } from "@/auth";

export default function LoginPage() {
  return (
    <main className="login-container">
      <h1>WP Draft Tool</h1>
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/" });
        }}
      >
        <button type="submit">Googleでログイン</button>
      </form>
    </main>
  );
}
