import { Outlet } from "react-router-dom";
import { Navigation } from "./Navigation";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";

export const Layout = () => {
  return (
    <>
      <Navigation />
      <Outlet />
      <Toaster />
      <Sonner />
    </>
  );
};
