import { GuestStayView } from "@/views/guest/GuestViews";

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <GuestStayView token={token} />;
}
