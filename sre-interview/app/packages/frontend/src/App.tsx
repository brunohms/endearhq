import { useEffect } from "react";
import { Link, NavLink, Navigate, Route, Routes, useLocation } from "react-router";
import { logger } from "./logger.js";
import { Customers } from "./routes/Customers.js";
import { Orders } from "./routes/Orders.js";

export function App() {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === "/") return;
    logger.info({ path: location.pathname }, "route viewed");
  }, [location.pathname]);

  return (
    <main>
      <h1>Orders and customers</h1>

      <nav>
        <NavLink to="/customers">Customers</NavLink>
        <NavLink to="/orders">Orders</NavLink>
      </nav>

      <Routes>
        <Route path="/" element={<Navigate to="/customers" replace />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </main>
  );
}

function NotFound() {
  const location = useLocation();

  useEffect(() => {
    logger.warn({ path: location.pathname }, "route not found");
  }, [location.pathname]);

  return (
    <p className="empty">
      Nothing at <span className="mono">{location.pathname}</span>.{" "}
      <Link to="/customers">Back to customers</Link>.
    </p>
  );
}
