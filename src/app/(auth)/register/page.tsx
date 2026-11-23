import { Suspense } from "react";
import { RegisterForm } from "@/components/app/auth-form";

export const metadata = { title: "สมัครสมาชิก" };

export default function Page() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
