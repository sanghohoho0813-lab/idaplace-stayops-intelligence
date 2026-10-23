import { StaffTaskDetailView } from "@/views/staff/StaffViews";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StaffTaskDetailView id={id} />;
}
