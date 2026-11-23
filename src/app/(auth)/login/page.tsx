import { Suspense } from "react";
import { LoginForm } from "@/components/app/auth-form";

export const metadata = { title: "เข้าสู่ระบบ" };

export default function Page() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
