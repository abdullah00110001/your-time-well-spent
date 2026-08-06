import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  BookOpen, 
  Plus, 
  Edit2, 
  Trash2, 
  Copy, 
  Loader2,
  Heart,
  AlertCircle,
  Lightbulb,
  Bell,
  Sparkles,
  Moon,
  Sun
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeedbackTemplate {
  id: string;
  name: string;
  message: string;
  feedback_type: string;
  mode: string;
  created_at: string;
}

const feedbackTypes = [
  { value: 'encouragement', label: 'Encouragement', icon: Heart, color: 'text-pink-500' },
  { value: 'concern', label: 'Concern', icon: AlertCircle, color: 'text-orange-500' },
  { value: 'suggestion', label: 'Suggestion', icon: Lightbulb, color: 'text-yellow-500' },
  { value: 'reminder', label: 'Reminder', icon: Bell, color: 'text-blue-500' },
  { value: 'celebration', label: 'Celebration', icon: Sparkles, color: 'text-green-500' },
];

const modes = [
  { value: 'all', label: 'All Users', icon: null },
  { value: 'islamic', label: 'Islamic Mode', icon: Moon },
  { value: 'regular', label: 'Regular Mode', icon: Sun },
];

interface Props {
  onSelectTemplate?: (template: FeedbackTemplate) => void;
  selectionMode?: boolean;
}

export default function FeedbackTemplatesLibrary({ onSelectTemplate, selectionMode = false }: Props) {
  const [templates, setTemplates] = useState<FeedbackTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<FeedbackTemplate | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    message: '',
    feedback_type: 'encouragement',
    mode: 'all'
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from('feedback_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching templates:', error);
      toast.error('Failed to load templates');
    } else {
      setTemplates(data || []);
    }
    setLoading(false);
  };

  const openEditor = (template?: FeedbackTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        message: template.message,
        feedback_type: template.feedback_type,
        mode: template.mode
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        name: '',
        message: '',
        feedback_type: 'encouragement',
        mode: 'all'
      });
    }
    setShowEditor(true);
  };

  const saveTemplate = async () => {
    if (!formData.name.trim() || !formData.message.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setSaving(true);

    try {
      if (editingTemplate) {
        const { error } = await supabase
          .from('feedback_templates')
          .update({
            name: formData.name,
            message: formData.message,
            feedback_type: formData.feedback_type,
            mode: formData.mode
          })
          .eq('id', editingTemplate.id);

        if (error) throw error;
        toast.success('Template updated');
      } else {
        const { error } = await supabase
          .from('feedback_templates')
          .insert({
            name: formData.name,
            message: formData.message,
            feedback_type: formData.feedback_type,
            mode: formData.mode
          });

        if (error) throw error;
        toast.success('Template created');
      }

      setShowEditor(false);
      fetchTemplates();
    } catch (error: any) {
      console.error('Error saving template:', error);
      toast.error(`Failed to save template: ${error?.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    const { error } = await supabase
      .from('feedback_templates')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete template');
    } else {
      toast.success('Template deleted');
      setTemplates(prev => prev.filter(t => t.id !== id));
    }
  };

  const copyToClipboard = (message: string) => {
    navigator.clipboard.writeText(message);
    toast.success('Copied to clipboard');
  };

  const getTypeIcon = (type: string) => {
    const found = feedbackTypes.find(t => t.value === type);
    return found?.icon || Heart;
  };

  const getTypeColor = (type: string) => {
    const found = feedbackTypes.find(t => t.value === type);
    return found?.color || 'text-muted-foreground';
  };

  const getModeIcon = (mode: string) => {
    if (mode === 'islamic') return Moon;
    if (mode === 'regular') return Sun;
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-subtitle flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Feedback Templates
            </CardTitle>
            <CardDescription className="text-caption">
              Reusable message templates for quick feedback
            </CardDescription>
          </div>
          {!selectionMode && (
            <Button onClick={() => openEditor()} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              New Template
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0">
        {templates.length === 0 ? (
          <div className="text-center py-8">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-body font-medium">No templates yet</p>
            <p className="text-caption text-muted-foreground mb-4">
              Create templates for common feedback messages
            </p>
            {!selectionMode && (
              <Button onClick={() => openEditor()} variant="outline" size="sm">
                Create First Template
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {templates.map((template) => {
              const TypeIcon = getTypeIcon(template.feedback_type);
              const ModeIcon = getModeIcon(template.mode);
              
              return (
                <div
                  key={template.id}
                  className={cn(
                    "p-4 rounded-xl border bg-card transition-all",
                    selectionMode && "cursor-pointer hover:border-primary hover:shadow-md",
                    !selectionMode && "hover:shadow-sm"
                  )}
                  onClick={() => selectionMode && onSelectTemplate?.(template)}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <TypeIcon className={cn("h-4 w-4", getTypeColor(template.feedback_type))} />
                      <span className="font-medium text-body truncate">{template.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {ModeIcon && <ModeIcon className="h-3 w-3 text-muted-foreground" />}
                      <Badge variant="outline" className="text-xs capitalize">
                        {template.feedback_type}
                      </Badge>
                    </div>
                  </div>
                  
                  <p className="text-caption text-muted-foreground line-clamp-2 mb-3">
                    {template.message}
                  </p>

                  {!selectionMode && (
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 px-2"
                        onClick={() => copyToClipboard(template.message)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 px-2"
                        onClick={() => openEditor(template)}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 px-2 text-destructive hover:text-destructive"
                        onClick={() => deleteTemplate(template.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Editor Dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'New Template'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                placeholder="e.g., Welcome Back"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select 
                  value={formData.feedback_type} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, feedback_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {feedbackTypes.map(type => {
                      const Icon = type.icon;
                      return (
                        <SelectItem key={type.value} value={type.value}>
                          <span className="flex items-center gap-2">
                            <Icon className={cn('h-4 w-4', type.color)} />
                            {type.label}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Target Mode</Label>
                <Select 
                  value={formData.mode} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, mode: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {modes.map(mode => (
                      <SelectItem key={mode.value} value={mode.value}>
                        <span className="flex items-center gap-2">
                          {mode.icon && <mode.icon className="h-4 w-4" />}
                          {mode.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                placeholder="Write your template message..."
                value={formData.message}
                onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditor(false)}>
              Cancel
            </Button>
            <Button onClick={saveTemplate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingTemplate ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
