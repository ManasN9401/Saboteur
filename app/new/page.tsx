import type { Metadata } from "next";
import { ChoiceFolder } from "@/components/CaseChoices";

export const metadata: Metadata = { title: "New case · Saboteur" };

export default function NewCase() {
  return <ChoiceFolder kind="new" />;
}
