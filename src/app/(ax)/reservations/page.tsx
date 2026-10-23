import type { Metadata } from "next";
import { ReservationsView } from "@/views/ReservationsView";

export const metadata: Metadata = { title: "예약·객실" };

export default function Page() {
  return <ReservationsView />;
}
