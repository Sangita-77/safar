import axios from "axios";
import { useMemo } from "react";
import { useAuth } from "@clerk/react";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function useApi() {
  const { getToken } = useAuth();
  return useMemo(() => {
    const inst = axios.create({ baseURL: API });
    inst.interceptors.request.use(async (cfg) => {
      const t = await getToken();
      if (t) cfg.headers.Authorization = `Bearer ${t}`;
      return cfg;
    });
    return inst;
  }, [getToken]);
}

export const inr = (n) => "₹" + Math.round(Number(n || 0)).toLocaleString("en-IN");

export function errMsg(e) {
  if (!e?.response) return "You're offline or the server is unreachable. Please retry.";
  const d = e.response.data?.detail;
  if (Array.isArray(d)) return d.map((x) => x.msg).join(", ");
  return d || "Something went wrong";
}

export const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";

export const SERVICES = [
  { id: "car", title: "Cab", sub: "Mini, Sedan, SUV", img: "/img/car.jpg", to: "/book/ride?pick=car" },
  { id: "bike", title: "Bike", sub: "Beat the traffic", img: "/img/bike.jpg", to: "/book/ride?pick=bike" },
  { id: "erickshaw", title: "E-Rickshaw", sub: "Green & cheap", img: "/img/erickshaw.jpg", to: "/book/ride?pick=erickshaw" },
  { id: "parcel", title: "Parcel", sub: "Send anything", img: "/img/parcel.jpg", to: "/book/parcel" },
  { id: "rental", title: "Rentals", sub: "By the hour", img: "/img/rental.jpg", to: "/book/rental" },
];

export const VEHICLE_IMG = { car: "/img/car.jpg", bike: "/img/bike.jpg", erickshaw: "/img/erickshaw.jpg", van: "/img/parcel.jpg" };

export const STATUS = {
  searching: { label: "Finding your driver", tone: "bg-amber-100 text-amber-900" },
  accepted: { label: "Driver on the way", tone: "bg-sky-100 text-sky-900" },
  arrived: { label: "Driver has arrived", tone: "bg-indigo-100 text-indigo-900" },
  ongoing: { label: "On trip", tone: "bg-emerald-100 text-emerald-900" },
  completed: { label: "Completed", tone: "bg-stone-200 text-stone-800" },
  cancelled: { label: "Cancelled", tone: "bg-red-100 text-red-800" },
};
