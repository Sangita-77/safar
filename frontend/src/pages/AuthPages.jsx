import { Link } from "react-router-dom";
import { SignIn, SignUp } from "@clerk/react";

function AuthLayout({ children }) {
  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden lg:flex">
        <img src="/img/hero.jpg" alt="City traffic" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />
        <div className="relative mt-auto p-12 text-white">
          <p className="font-display text-5xl font-extrabold leading-tight">Your city,<br />on demand.</p>
          <p className="mt-4 max-w-md text-white/80">Cabs, bikes, e-rickshaws, parcels and hourly rentals — one app.</p>
        </div>
      </aside>
      <section className="flex flex-col items-center justify-center gap-6 px-4 py-10 pt-[calc(2.5rem+env(safe-area-inset-top))]">
        <Link to="/" data-testid="auth-brand" className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand font-display text-xl font-extrabold">S</span>
          <span className="font-display text-2xl font-extrabold">Safar</span>
        </Link>
        {children}
      </section>
    </div>
  );
}

export function SignInPage() {
  return <AuthLayout><SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" withSignUp /></AuthLayout>;
}

export function SignUpPage() {
  return <AuthLayout><SignUp routing="path" path="/sign-up" signInUrl="/sign-in" /></AuthLayout>;
}
