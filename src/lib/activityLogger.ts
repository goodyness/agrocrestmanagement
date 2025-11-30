import { supabase } from "@/integrations/supabase/client";

export const logActivity = async (
  action: string,
  entityType: string,
  entityId?: string,
  details?: Record<string, any>
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    await supabase.from("activity_logs").insert([
      {
        user_id: user.id,
        action,
        entity_type: entityType,
        entity_id: entityId,
        details: details || null,
      },
    ]);
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
};
