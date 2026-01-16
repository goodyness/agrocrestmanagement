import { supabase } from "@/integrations/supabase/client";

export const logActivity = async (
  action: string,
  entityType: string,
  entityId?: string,
  details?: Record<string, any>,
  branchId?: string | null
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
        branch_id: branchId || null,
      },
    ]);
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
};
