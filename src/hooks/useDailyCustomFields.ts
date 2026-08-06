import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export type CustomFieldType = 'number' | 'boolean' | 'text' | 'minutes';

export interface CustomField {
  id: string;
  field_key: string;
  label: string;
  field_type: CustomFieldType;
  unit: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface CustomValue {
  field_id: string;
  value_number: number | null;
  value_text: string | null;
  value_bool: boolean | null;
}

export function useDailyCustomFields(date: string) {
  const { user } = useAuth();
  const [fields, setFields] = useState<CustomField[]>([]);
  const [values, setValues] = useState<Record<string, CustomValue>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: fieldRows } = await supabase
        .from('daily_custom_fields' as any)
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      const fs = (fieldRows as any[] | null) || [];
      setFields(fs as CustomField[]);

      if (fs.length > 0) {
        const ids = fs.map((f) => f.id);
        const { data: valueRows } = await supabase
          .from('daily_custom_values' as any)
          .select('*')
          .eq('user_id', user.id)
          .eq('date', date)
          .in('field_id', ids);

        const map: Record<string, CustomValue> = {};
        ((valueRows as any[] | null) || []).forEach((v: any) => {
          map[v.field_id] = {
            field_id: v.field_id,
            value_number: v.value_number,
            value_text: v.value_text,
            value_bool: v.value_bool,
          };
        });
        setValues(map);
      } else {
        setValues({});
      }
    } catch (e) {
      console.error('Load custom fields failed', e);
    } finally {
      setLoading(false);
    }
  }, [user, date]);

  useEffect(() => {
    void load();
  }, [load]);

  const addField = useCallback(
    async (input: { label: string; field_type: CustomFieldType; unit?: string }) => {
      if (!user) return;
      const key = input.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40) + '_' + Date.now().toString(36);
      const { error } = await supabase.from('daily_custom_fields' as any).insert({
        user_id: user.id,
        field_key: key,
        label: input.label,
        field_type: input.field_type,
        unit: input.unit || null,
        sort_order: fields.length,
        is_active: true,
      });
      if (error) throw error;
      await load();
    },
    [user, fields.length, load]
  );

  const removeField = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('daily_custom_fields' as any).delete().eq('id', id);
      if (error) throw error;
      await load();
    },
    [load]
  );

  const setValue = useCallback(
    async (field: CustomField, partial: Partial<CustomValue>) => {
      if (!user) return;
      const existing = values[field.id];
      const merged: CustomValue = {
        field_id: field.id,
        value_number: partial.value_number ?? existing?.value_number ?? null,
        value_text: partial.value_text ?? existing?.value_text ?? null,
        value_bool: partial.value_bool ?? existing?.value_bool ?? null,
      };
      setValues((prev) => ({ ...prev, [field.id]: merged }));
      const { error } = await supabase.from('daily_custom_values' as any).upsert(
        {
          user_id: user.id,
          field_id: field.id,
          date,
          value_number: merged.value_number,
          value_text: merged.value_text,
          value_bool: merged.value_bool,
        },
        { onConflict: 'user_id,field_id,date' }
      );
      if (error) console.error('Save custom value failed', error);
    },
    [user, date, values]
  );

  return { fields, values, loading, addField, removeField, setValue, reload: load };
}
