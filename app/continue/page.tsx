import type { Metadata } from "next";
import { ChoiceFolder } from "@/components/CaseChoices";

export const metadata: Metadata = { title: "Continue · Saboteur" };

export default function Continue() {
  return <ChoiceFolder kind="continue" />;
}
