
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "business_members": {
                  Row: {
                    "business_id": string,"created_at": string,"role": Database["public"]['Enums']["member_role"],"status": Database["public"]['Enums']["member_status"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"role": Database["public"]['Enums']["member_role"],"status"?: Database["public"]['Enums']["member_status"],"user_id": string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"role"?: Database["public"]['Enums']["member_role"],"status"?: Database["public"]['Enums']["member_status"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "business_members_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"businesses": {
                  Row: {
                    "business_type": string | null,"created_at": string,"currency": string,"id": string,"name": string,"status": Database["public"]['Enums']["business_status"],"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_type"?: string | null,"created_at"?: string,"currency"?: string,"id"?: string,"name": string,"status"?: Database["public"]['Enums']["business_status"],"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "business_type"?: string | null,"created_at"?: string,"currency"?: string,"id"?: string,"name"?: string,"status"?: Database["public"]['Enums']["business_status"],"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"categories": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"name": string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"imports": {
                  Row: {
                    "adjust_stock": boolean,"business_id": string,"created_at": string,"created_by": string | null,"file_name": string,"finished_at": string | null,"id": string,"rows_created": number,"rows_skipped": number,"rows_stock_adjusted": number,"rows_total": number,"rows_updated": number,"status": string,"update_existing": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "adjust_stock": boolean,"business_id": string,"created_at"?: string,"created_by"?: string | null,"file_name": string,"finished_at"?: string | null,"id": string,"rows_created"?: number,"rows_skipped"?: number,"rows_stock_adjusted"?: number,"rows_total"?: number,"rows_updated"?: number,"status"?: string,"update_existing": boolean
                  }
                  Update: {
                    "adjust_stock"?: boolean,"business_id"?: string,"created_at"?: string,"created_by"?: string | null,"file_name"?: string,"finished_at"?: string | null,"id"?: string,"rows_created"?: number,"rows_skipped"?: number,"rows_stock_adjusted"?: number,"rows_total"?: number,"rows_updated"?: number,"status"?: string,"update_existing"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "imports_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory_balances": {
                  Row: {
                    "average_cost": number,"business_id": string,"product_id": string,"quantity": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "average_cost"?: number,"business_id": string,"product_id": string,"quantity"?: number,"updated_at"?: string
                  }
                  Update: {
                    "average_cost"?: number,"business_id"?: string,"product_id"?: string,"quantity"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_balances_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_balances_business_id_product_id_fkey"
      columns: ["business_id","product_id"]
isOneToOne: true
      referencedRelation: "product_overview"
      referencedColumns: ["business_id","id"]
    },{
      foreignKeyName: "inventory_balances_business_id_product_id_fkey"
      columns: ["business_id","product_id"]
isOneToOne: true
      referencedRelation: "products"
      referencedColumns: ["business_id","id"]
    }
                  ]
                },"products": {
                  Row: {
                    "barcode": string | null,"business_id": string,"category_id": string | null,"created_at": string,"created_by": string | null,"id": string,"idempotency_key": string | null,"is_active": boolean,"low_stock_threshold": number,"name": string,"sale_price": number,"sku": string | null,"unit": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "barcode"?: string | null,"business_id": string,"category_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"idempotency_key"?: string | null,"is_active"?: boolean,"low_stock_threshold"?: number,"name": string,"sale_price"?: number,"sku"?: string | null,"unit"?: string,"updated_at"?: string
                  }
                  Update: {
                    "barcode"?: string | null,"business_id"?: string,"category_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"idempotency_key"?: string | null,"is_active"?: boolean,"low_stock_threshold"?: number,"name"?: string,"sale_price"?: number,"sku"?: string | null,"unit"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_business_id_category_id_fkey"
      columns: ["business_id","category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["business_id","id"]
    },{
      foreignKeyName: "products_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string | null,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string | null,"id": string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string | null,"id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"sale_items": {
                  Row: {
                    "business_id": string,"id": string,"line_cost": number,"line_total": number,"product_id": string,"product_name": string,"quantity": number,"sale_id": string,"unit": string,"unit_cost": number,"unit_price": number
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"id"?: string,"line_cost": number,"line_total": number,"product_id": string,"product_name": string,"quantity": number,"sale_id": string,"unit": string,"unit_cost": number,"unit_price": number
                  }
                  Update: {
                    "business_id"?: string,"id"?: string,"line_cost"?: number,"line_total"?: number,"product_id"?: string,"product_name"?: string,"quantity"?: number,"sale_id"?: string,"unit"?: string,"unit_cost"?: number,"unit_price"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "sale_items_business_id_product_id_fkey"
      columns: ["business_id","product_id"]
isOneToOne: false
      referencedRelation: "product_overview"
      referencedColumns: ["business_id","id"]
    },{
      foreignKeyName: "sale_items_business_id_product_id_fkey"
      columns: ["business_id","product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["business_id","id"]
    },{
      foreignKeyName: "sale_items_business_id_sale_id_fkey"
      columns: ["business_id","sale_id"]
isOneToOne: false
      referencedRelation: "sales"
      referencedColumns: ["business_id","id"]
    }
                  ]
                },"sales": {
                  Row: {
                    "business_id": string,"cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"cost_total": number,"created_at": string,"created_by": string | null,"currency": string,"discount_total": number,"id": string,"idempotency_key": string,"note": string | null,"number": number,"payment_method": string,"status": string,"subtotal": number,"total": number
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"cost_total": number,"created_at"?: string,"created_by"?: string | null,"currency": string,"discount_total"?: number,"id"?: string,"idempotency_key": string,"note"?: string | null,"number": number,"payment_method"?: string,"status"?: string,"subtotal": number,"total": number
                  }
                  Update: {
                    "business_id"?: string,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"cost_total"?: number,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"discount_total"?: number,"id"?: string,"idempotency_key"?: string,"note"?: string | null,"number"?: number,"payment_method"?: string,"status"?: string,"subtotal"?: number,"total"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "sales_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"stock_movements": {
                  Row: {
                    "average_cost_after": number,"balance_after": number,"business_id": string,"created_at": string,"created_by": string | null,"id": string,"idempotency_key": string | null,"movement_type": Database["public"]['Enums']["movement_type"],"product_id": string,"quantity_delta": number,"reason": string | null,"reference_id": string | null,"reference_type": string | null,"unit_cost": number
                  }
                  ComputedFields: never
                  Insert: {
                    "average_cost_after": number,"balance_after": number,"business_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"idempotency_key"?: string | null,"movement_type": Database["public"]['Enums']["movement_type"],"product_id": string,"quantity_delta": number,"reason"?: string | null,"reference_id"?: string | null,"reference_type"?: string | null,"unit_cost": number
                  }
                  Update: {
                    "average_cost_after"?: number,"balance_after"?: number,"business_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"idempotency_key"?: string | null,"movement_type"?: Database["public"]['Enums']["movement_type"],"product_id"?: string,"quantity_delta"?: number,"reason"?: string | null,"reference_id"?: string | null,"reference_type"?: string | null,"unit_cost"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_movements_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_business_id_product_id_fkey"
      columns: ["business_id","product_id"]
isOneToOne: false
      referencedRelation: "product_overview"
      referencedColumns: ["business_id","id"]
    },{
      foreignKeyName: "stock_movements_business_id_product_id_fkey"
      columns: ["business_id","product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["business_id","id"]
    }
                  ]
                },"subscriptions": {
                  Row: {
                    "business_id": string,"created_at": string,"current_period_end": string | null,"current_period_start": string | null,"grace_days": number,"id": string,"plan_code": string,"provider": string | null,"provider_customer_id": string | null,"provider_subscription_id": string | null,"status": Database["public"]['Enums']["subscription_status"],"trial_ends_at": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"current_period_end"?: string | null,"current_period_start"?: string | null,"grace_days"?: number,"id"?: string,"plan_code"?: string,"provider"?: string | null,"provider_customer_id"?: string | null,"provider_subscription_id"?: string | null,"status"?: Database["public"]['Enums']["subscription_status"],"trial_ends_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"current_period_end"?: string | null,"current_period_start"?: string | null,"grace_days"?: number,"id"?: string,"plan_code"?: string,"provider"?: string | null,"provider_customer_id"?: string | null,"provider_subscription_id"?: string | null,"status"?: Database["public"]['Enums']["subscription_status"],"trial_ends_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscriptions_business_id_fkey"
      columns: ["business_id"]
isOneToOne: true
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "inventory_summary": {
                  Row: {
                    "active_products": number | null,"business_id": string | null,"low_stock_products": number | null,"stock_value": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "products_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"movement_history": {
                  Row: {
                    "average_cost_after": number | null,"balance_after": number | null,"business_id": string | null,"created_at": string | null,"created_by": string | null,"id": string | null,"movement_type": Database["public"]['Enums']["movement_type"] | null,"product_id": string | null,"product_name": string | null,"quantity_delta": number | null,"reason": string | null,"unit": string | null,"unit_cost": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "stock_movements_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_business_id_product_id_fkey"
      columns: ["business_id","product_id"]
isOneToOne: false
      referencedRelation: "product_overview"
      referencedColumns: ["business_id","id"]
    },{
      foreignKeyName: "stock_movements_business_id_product_id_fkey"
      columns: ["business_id","product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["business_id","id"]
    }
                  ]
                },"product_overview": {
                  Row: {
                    "average_cost": number | null,"barcode": string | null,"business_id": string | null,"category_id": string | null,"category_name": string | null,"created_at": string | null,"id": string | null,"is_active": boolean | null,"is_low_stock": boolean | null,"low_stock_threshold": number | null,"name": string | null,"quantity": number | null,"sale_price": number | null,"sku": string | null,"stock_value": number | null,"unit": string | null,"updated_at": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "products_business_id_category_id_fkey"
      columns: ["business_id","category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["business_id","id"]
    },{
      foreignKeyName: "products_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"stock_reconciliation": {
                  Row: {
                    "balance_quantity": number | null,"business_id": string | null,"movements_quantity": number | null,"product_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "inventory_balances_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_balances_business_id_product_id_fkey"
      columns: ["business_id","product_id"]
isOneToOne: true
      referencedRelation: "product_overview"
      referencedColumns: ["business_id","id"]
    },{
      foreignKeyName: "inventory_balances_business_id_product_id_fkey"
      columns: ["business_id","product_id"]
isOneToOne: true
      referencedRelation: "products"
      referencedColumns: ["business_id","id"]
    }
                  ]
                }
          }
          Functions: {
            "adjust_stock":
{ Args: { "p_business_id": string,"p_counted_quantity": number,"p_idempotency_key"?: string,"p_product_id": string,"p_reason": string }; Returns: string
                           },
"cancel_sale":
{ Args: { "p_business_id": string,"p_reason": string,"p_sale_id": string }; Returns: undefined
                           },
"create_business":
{ Args: { "p_business_type"?: string,"p_name": string }; Returns: string
                           },
"create_category":
{ Args: { "p_business_id": string,"p_name": string }; Returns: string
                           },
"create_product":
{ Args: { "p_barcode"?: string,"p_business_id": string,"p_category_id"?: string,"p_idempotency_key"?: string,"p_initial_quantity"?: number,"p_initial_unit_cost"?: number,"p_low_stock_threshold"?: number,"p_name": string,"p_sale_price": number,"p_sku"?: string,"p_unit"?: string }; Returns: string
                           },
"create_sale":
{ Args: { "p_business_id": string,"p_discount"?: number,"p_idempotency_key": string,"p_items": Json,"p_note"?: string,"p_payment_method"?: string }; Returns: string
                           },
"delete_category":
{ Args: { "p_business_id": string,"p_category_id": string }; Returns: undefined
                           },
"import_products":
{ Args: { "p_adjust_stock"?: boolean,"p_business_id": string,"p_file_name": string,"p_import_id": string,"p_rows": Json,"p_rows_invalid"?: number,"p_rows_total"?: number,"p_update_existing"?: boolean }; Returns: Json
                           },
"record_stock_movement":
{ Args: { "p_business_id": string,"p_idempotency_key"?: string,"p_product_id": string,"p_quantity": number,"p_reason"?: string,"p_type": Database["public"]['Enums']["movement_type"],"p_unit_cost"?: number }; Returns: string
                           },
"rename_category":
{ Args: { "p_business_id": string,"p_category_id": string,"p_name": string }; Returns: undefined
                           },
"sales_summary":
{ Args: { "p_business_id": string,"p_from": string,"p_to": string }; Returns: {
              "cancelled_count": number,"cost_total": number,"discount_total": number,"gross_margin": number,"sales_count": number,"subtotal": number,"total": number
            }[]
                           },
"set_product_active":
{ Args: { "p_active": boolean,"p_business_id": string,"p_product_id": string }; Returns: undefined
                           },
"top_products":
{ Args: { "p_business_id": string,"p_from": string,"p_limit"?: number,"p_to": string }; Returns: {
              "cost": number,"product_id": string,"product_name": string,"quantity": number,"revenue": number,"unit": string
            }[]
                           },
"update_business":
{ Args: { "p_business_id": string,"p_business_type"?: string,"p_name": string,"p_timezone"?: string }; Returns: undefined
                           },
"update_my_profile":
{ Args: { "p_display_name": string }; Returns: undefined
                           },
"update_product":
{ Args: { "p_barcode"?: string,"p_business_id": string,"p_category_id"?: string,"p_low_stock_threshold"?: number,"p_name": string,"p_product_id": string,"p_sale_price": number,"p_sku"?: string,"p_unit"?: string }; Returns: undefined
                           }
          }
          Enums: {
            "business_status": "active"|"suspended","member_role": "owner"|"admin"|"staff","member_status": "active"|"revoked","movement_type": "initial"|"purchase"|"output"|"adjustment"|"sale"|"sale_reversal"|"return","subscription_status": "trialing"|"active"|"past_due"|"expired"|"cancelled"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "business_status": ["active", "suspended"],"member_role": ["owner", "admin", "staff"],"member_status": ["active", "revoked"],"movement_type": ["initial", "purchase", "output", "adjustment", "sale", "sale_reversal", "return"],"subscription_status": ["trialing", "active", "past_due", "expired", "cancelled"]
          }
        }
} as const
