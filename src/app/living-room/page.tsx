import { CameraCard } from "@/components/LIvingRoom/CameraCard";
import { ClimateIndicators } from "@/components/LIvingRoom/ClimateIndicators";
import { AutomationThresholds } from "@/components/LIvingRoom/AutomationThresholds";
import { ManualControls } from "@/components/LIvingRoom/ManualControls";
import { PageTransition } from "@/components/PageTransition";
import { TopBar } from "@/components/TopBar";

export default function RoomPage() {
  return (
    <PageTransition className="pb-20">
      <TopBar title="Гостиная" showSettings />
      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5 max-w-md md:max-w-none mx-auto">
        <CameraCard />
        <AutomationThresholds />
        <ClimateIndicators />
        <ManualControls />
      </div>
    </PageTransition>
  );
}
