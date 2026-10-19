import type { Metadata } from "next";
import Link from "next/link";
import { DeadEnd } from "@/components/DeadEnd";

export const metadata: Metadata = { title: "Not on file · Saboteur" };

/** Any URL the app doesn't have, and anything that calls notFound() (an unknown round, say). */
export default function NotFound() {
  return (
    <DeadEnd
      code="Error 404 · No such file"
      title="This case file doesn’t exist."
      body="The link may be old, or the file was never opened on this device. Nothing of yours is lost: your rounds and progress are where you left them."
      stamp="Not on file"
      stampNote="Records dept."
      note="checked every drawer…"
    >
      <Link href="/archive" className="btn">
        Open the archive
      </Link>
    </DeadEnd>
  );
}
