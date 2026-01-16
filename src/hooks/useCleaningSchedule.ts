import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CleaningSchedule {
  id: string;
  start_date: string;
  interval_days: number;
  tasks: string[];
  is_active: boolean;
  branch_id: string | null;
}

interface CleaningInfo {
  nextCleaningDate: Date | null;
  daysUntilCleaning: number;
  isCleaningDay: boolean;
  isReminderDay: boolean;
  tasks: string[];
  schedule: CleaningSchedule | null;
  isCleaningCompleted: boolean;
}

export const useCleaningSchedule = (branchId?: string | null) => {
  const [cleaningInfo, setCleaningInfo] = useState<CleaningInfo>({
    nextCleaningDate: null,
    daysUntilCleaning: -1,
    isCleaningDay: false,
    isReminderDay: false,
    tasks: [],
    schedule: null,
    isCleaningCompleted: false,
  });
  const [loading, setLoading] = useState(true);

  const calculateNextCleaningDate = (startDate: Date, intervalDays: number): Date => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    
    if (start >= today) {
      return start;
    }
    
    const daysSinceStart = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const cyclesPassed = Math.floor(daysSinceStart / intervalDays);
    const nextCycle = (cyclesPassed + 1) * intervalDays;
    
    const nextDate = new Date(start);
    nextDate.setDate(nextDate.getDate() + nextCycle);
    
    // If today is a cleaning day
    if (daysSinceStart % intervalDays === 0) {
      return today;
    }
    
    return nextDate;
  };

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    
    let query = supabase
      .from("cleaning_schedules")
      .select("*")
      .eq("is_active", true);
    
    // Filter by branch if provided
    if (branchId) {
      query = query.eq("branch_id", branchId);
    }
    
    const { data: scheduleData } = await query.limit(1).single();

    if (scheduleData) {
      const schedule = scheduleData as unknown as CleaningSchedule;
      const startDate = new Date(schedule.start_date);
      const nextCleaningDate = calculateNextCleaningDate(startDate, schedule.interval_days);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const diffTime = nextCleaningDate.getTime() - today.getTime();
      const daysUntilCleaning = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      // Check if today's cleaning is already completed for this branch
      const todayStr = today.toISOString().split('T')[0];
      let completedQuery = supabase
        .from("cleaning_records")
        .select("id")
        .eq("cleaning_date", todayStr);
      
      if (branchId) {
        completedQuery = completedQuery.eq("branch_id", branchId);
      }
      
      const { data: completedToday } = await completedQuery.limit(1);

      setCleaningInfo({
        nextCleaningDate,
        daysUntilCleaning,
        isCleaningDay: daysUntilCleaning === 0,
        isReminderDay: daysUntilCleaning === 1,
        tasks: schedule.tasks || [],
        schedule,
        isCleaningCompleted: (completedToday && completedToday.length > 0) || false,
      });
    } else {
      // No schedule found for this branch
      setCleaningInfo({
        nextCleaningDate: null,
        daysUntilCleaning: -1,
        isCleaningDay: false,
        isReminderDay: false,
        tasks: [],
        schedule: null,
        isCleaningCompleted: false,
      });
    }
    
    setLoading(false);
  }, [branchId]);

  const markCleaningComplete = async (notes?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const today = new Date().toISOString().split('T')[0];
    
    const { error } = await supabase.from("cleaning_records").insert({
      cleaning_date: today,
      completed_by: user.id,
      notes,
      branch_id: branchId || null,
    });

    if (!error) {
      setCleaningInfo(prev => ({ ...prev, isCleaningCompleted: true }));
      return true;
    }
    return false;
  };

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  return { ...cleaningInfo, loading, refetch: fetchSchedule, markCleaningComplete };
};
