// Auto-generated types matching Supabase schema
// Regenerate with: npx supabase gen types typescript --project-id qdhengvarelfdtmycnti

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string;
          name: string;
          budget: number;
          budget_spent: number;
          status: 'bootstrapping' | 'growing' | 'scaling' | 'crisis' | 'paused';
          ceo_goal: string | null;
          office_layout_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          budget?: number;
          budget_spent?: number;
          status?: string;
          ceo_goal?: string | null;
          office_layout_id?: string;
        };
        Update: Partial<Database['public']['Tables']['companies']['Insert']>;
      };
      agents: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          role: 'CEO' | 'PM' | 'DevOps' | 'Frontend' | 'Backend' | 'QA' | 'Designer';
          status: 'idle' | 'working' | 'meeting' | 'break' | 'blocked' | 'offline';
          color: string;
          tile_col: number;
          tile_row: number;
          monthly_cost: number;
          reports_to: string | null;
          assigned_task: string | null;
          progress: number;
          sprite_index: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          role: string;
          status?: string;
          color?: string;
          tile_col?: number;
          tile_row?: number;
          monthly_cost?: number;
          reports_to?: string | null;
          assigned_task?: string | null;
          progress?: number;
          sprite_index?: number;
        };
        Update: Partial<Database['public']['Tables']['agents']['Insert']>;
      };
      goals: {
        Row: {
          id: string;
          company_id: string;
          parent_goal_id: string | null;
          title: string;
          description: string | null;
          assigned_to: string | null;
          status: 'pending' | 'in-progress' | 'completed' | 'blocked';
          progress: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          parent_goal_id?: string | null;
          title: string;
          description?: string | null;
          assigned_to?: string | null;
          status?: string;
          progress?: number;
        };
        Update: Partial<Database['public']['Tables']['goals']['Insert']>;
      };
      delegations: {
        Row: {
          id: string;
          company_id: string;
          goal_id: string | null;
          to_agent_id: string;
          to_role: string;
          task: string;
          progress: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          goal_id?: string | null;
          to_agent_id: string;
          to_role: string;
          task: string;
          progress?: number;
        };
        Update: Partial<Database['public']['Tables']['delegations']['Insert']>;
      };
      activity_log: {
        Row: {
          id: string;
          company_id: string;
          agent_id: string | null;
          type: string;
          message: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          agent_id?: string | null;
          type: string;
          message: string;
        };
        Update: Partial<Database['public']['Tables']['activity_log']['Insert']>;
      };
    };
  };
}

// Convenience aliases
export type CompanyRow = Database['public']['Tables']['companies']['Row'];
export type AgentRow = Database['public']['Tables']['agents']['Row'];
export type GoalRow = Database['public']['Tables']['goals']['Row'];
export type DelegationRow = Database['public']['Tables']['delegations']['Row'];
export type ActivityRow = Database['public']['Tables']['activity_log']['Row'];
