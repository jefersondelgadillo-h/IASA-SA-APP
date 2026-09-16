import { useState } from "react";
import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login.jsx";
import Schedule from "./pages/Schedule.jsx";
import Admin from "./pages/Admin.jsx";
import Laminadores from "./pages/Laminadores.jsx";
import LaminadorDetail from "./pages/LaminadorDetail.jsx";
import ChecklistForm from "./pages/ChecklistForm.jsx";
import ChecklistDetail from "./pages/ChecklistDetail.jsx";
import RodilloMeasurementForm from "./pages/RodilloMeasurementForm.jsx";
import RodilloReportDetail from "./pages/RodilloReportDetail.jsx";
import { getTechnician, clearTechnician } from "./lib/session.js";

function TechnicianArea() {
  const [technician, setTechnicianState] = useState(getTechnician());

  if (!technician) {
    return <Login onLogin={setTechnicianState} />;
  }

  return (
    <Schedule
      technician={technician}
      onChangeUser={() => {
        clearTechnician();
        setTechnicianState(null);
      }}
    />
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/admin" element={<Admin />} />
      <Route path="/laminadores" element={<Laminadores />} />
      <Route path="/laminadores/:id" element={<LaminadorDetail />} />
      <Route path="/laminadores/:id/checklist" element={<ChecklistForm />} />
      <Route path="/laminadores/:id/checklist/:reportId" element={<ChecklistDetail />} />
      <Route path="/laminadores/:id/rodillos/nuevo" element={<RodilloMeasurementForm />} />
      <Route path="/laminadores/:id/rodillos/:reportId" element={<RodilloReportDetail />} />
      <Route path="/*" element={<TechnicianArea />} />
    </Routes>
  );
}
