import { Suspense } from "react";
import { ForgotForm } from "@/components/app/auth-form";

export const metadata = { title: "ลืมรหัสผ่าน" };

export default function Page() {
  return (
    <Suspense>
      <ForgotForm />
    </Suspense>
  );
}
