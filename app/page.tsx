import UsageMeter from "@/components/UsageMeter";
import InspoGallery from "./InspoGallery";

export default function Page() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <UsageMeter />
      </div>

      <InspoGallery />
    </div>
  );
}
