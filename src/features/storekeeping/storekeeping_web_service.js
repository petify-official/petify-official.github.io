import { supabase } from "../../lib/supabase.js";
import { createStorekeepingService } from "./storekeeping_service.js";

function storekeepingWebServices() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return createStorekeepingService(supabase);
}

export const storekeepingGetProfile = (userId) => storekeepingWebServices().getProfile(userId);
export const storekeepingRequestAccess = () => storekeepingWebServices().requestAccess();
export const storekeepingReviewAccess = (request) => storekeepingWebServices().reviewAccess(request);
export const storekeepingLoadConfiguration = () => storekeepingWebServices().loadConfiguration();
export const storekeepingLoadOperations = (range) => storekeepingWebServices().loadOperations(range);
export const storekeepingGetDashboardMetrics = (range) => storekeepingWebServices().getDashboardMetrics(range);
export const storekeepingLoadSales = (query) => storekeepingWebServices().loadSales(query);
export const storekeepingLoadAllSales = (query) => storekeepingWebServices().loadAllSales(query);
export const storekeepingSaveFarm = (farm) => storekeepingWebServices().saveFarm(farm);
export const storekeepingSaveArea = (area) => storekeepingWebServices().saveArea(area);
export const storekeepingSaveValue = (value) => storekeepingWebServices().saveValue(value);
export const storekeepingSaveActivity = (activity) => storekeepingWebServices().saveActivity(activity);
export const storekeepingSaveSchedule = (schedule) => storekeepingWebServices().saveSchedule(schedule);
export const storekeepingSetScheduleStatus = (schedule) => storekeepingWebServices().setScheduleStatus(schedule);
export const storekeepingCreateChecklistEntry = (entry) => storekeepingWebServices().createChecklistEntry(entry);
export const storekeepingSaveSale = (sale) => storekeepingWebServices().saveSale(sale);
