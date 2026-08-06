import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useDailyCustomFields, type CustomFieldType } from '@/hooks/useDailyCustomFields';

interface Props {
  date: string;
  readOnly?: boolean;
}

export function CustomFieldsManager({ date, readOnly }: Props) {
  const { fields, values, loading, addField, removeField, setValue } = useDailyCustomFields(date);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [type, setType] = useState<CustomFieldType>('number');
  const [unit, setUnit] = useState('');

  const handleAdd = async () => {
    if (!label.trim()) return;
    try {
      await addField({ label: label.trim(), field_type: type, unit: unit.trim() || undefined });
      setLabel('');
      setUnit('');
      setType('number');
      setDialogOpen(false);
      toast.success('Custom field added');
    } catch (e: any) {
      const msg = e?.message?.includes('does not exist')
        ? 'Database not migrated yet. See APPLY_MIGRATION.md'
        : 'Failed to add field';
      toast.error(msg);
    }
  };

  const handleRemove = async (id: string, fieldLabel: string) => {
    if (!confirm(`Remove "${fieldLabel}" from your daily input?`)) return;
    try {
      await removeField(id);
      toast.success('Field removed');
    } catch {
      toast.error('Failed to remove field');
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Custom Fields
        </CardTitle>
        {!readOnly && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add custom field</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-2">
                  <Label>Label</Label>
                  <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Water glasses" />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={type} onValueChange={(v) => setType(v as CustomFieldType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="minutes">Minutes</SelectItem>
                      <SelectItem value="boolean">Yes / No</SelectItem>
                      <SelectItem value="text">Text note</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(type === 'number' || type === 'minutes') && (
                  <div className="space-y-2">
                    <Label>Unit (optional)</Label>
                    <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="glasses, km, etc." />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button onClick={handleAdd} disabled={!label.trim()}>Add</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : fields.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No custom fields yet. Add one to track anything that matters to you.
          </p>
        ) : (
          fields.map((f) => {
            const v = values[f.id];
            return (
              <div key={f.id} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <Label className="text-xs text-muted-foreground">{f.label}{f.unit ? ` (${f.unit})` : ''}</Label>
                  {f.field_type === 'boolean' ? (
                    <div className="pt-1">
                      <Switch
                        disabled={readOnly}
                        checked={!!v?.value_bool}
                        onCheckedChange={(checked) => setValue(f, { value_bool: checked })}
                      />
                    </div>
                  ) : f.field_type === 'text' ? (
                    <Input
                      disabled={readOnly}
                      value={v?.value_text || ''}
                      onChange={(e) => setValue(f, { value_text: e.target.value })}
                    />
                  ) : (
                    <Input
                      disabled={readOnly}
                      type="number"
                      inputMode="numeric"
                      value={v?.value_number ?? ''}
                      onChange={(e) => setValue(f, { value_number: e.target.value === '' ? null : Number(e.target.value) })}
                    />
                  )}
                </div>
                {!readOnly && (
                  <Button size="icon" variant="ghost" onClick={() => handleRemove(f.id, f.label)} aria-label="Remove">
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
