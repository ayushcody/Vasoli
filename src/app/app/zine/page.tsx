import { redirect } from "next/navigation";

import { getCurrentZinePath } from "@/lib/navigation";

export default function ZineIndexPage() {
  redirect(getCurrentZinePath());
}
