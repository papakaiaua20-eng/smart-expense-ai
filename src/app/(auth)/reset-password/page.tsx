import { Suspense } from "react";
import { ResetForm } from "@/components/app/auth-form";

export const metadata = { title: "ตั้งรหัสผ่านใหม่" };

export default function Page() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
