import { Header } from "@/components/Main page/Header";
import { StreetCameraCard } from "@/components/Main page/StreetCameraCard";
import { RobotCard } from "@/components/Main page/RobotCard";
import { OfficeCard } from "@/components/Main page/OfficeCard";
import { HallwayCard } from "@/components/Main page/HallwayCard";
import { KitchenCard } from "@/components/Main page/KitchenCard";
import { BathroomCard } from "@/components/Main page/BathroomCard";
import { EventLogPreview } from "@/components/Main page/EventLogPreview";
import { PageTransition } from "@/components/PageTransition";

export default function Home() {
  return (
    <PageTransition className="mx-auto w-full p-5 pb-20">
      <div className="max-w-md md:max-w-none mx-auto space-y-5 md:space-y-6">
        <Header />

        {/* Street Camera and Robot Card - Same Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <StreetCameraCard />
          <RobotCard />
        </div>

        {/* Room Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <OfficeCard />
          <HallwayCard />
          <KitchenCard />
          <BathroomCard />
        </div>

        {/* Event Log Preview */}
        <EventLogPreview />
      </div>
    </PageTransition>
  );
}
