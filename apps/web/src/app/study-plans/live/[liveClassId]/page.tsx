import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LiveClassRoom } from "../../../../components/study-plans/live-class-room";

export const dynamic = "force-dynamic";

type LiveClassPageProps = {
  params: Promise<{ liveClassId: string }>;
};

export const metadata: Metadata = {
  title: "Live Class",
  robots: { index: false, follow: false }
};

export default async function StudyPlanLiveClassPage({ params }: LiveClassPageProps) {
  const { liveClassId } = await params;
  const id = Number(liveClassId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <LiveClassRoom liveClassId={id} />;
}
