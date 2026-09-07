import { useState } from "react";
import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login.jsx";
import Schedule from "./pages/Schedule.jsx";
import Admin from "./pages/Admin.jsx";
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
      <Route path="/*" element={<TechnicianArea />} />
    </Routes>
  );
}
