import EquipmentSection from "./EquipmentSection";
import BiosecuritySection from "./BiosecuritySection";
import TasksBoardSection from "./TasksBoardSection";

const OperationsTab = () => {
  return (
    <div className="space-y-6">
      <TasksBoardSection />
      <EquipmentSection />
      <BiosecuritySection />
    </div>
  );
};

export default OperationsTab;
