import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, Megaphone, Pencil, Plus, Power } from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  body: string | null;
  image_url: string | null;
  link_url: string | null;
  button_text: string | null;
  is_active: boolean;
  show_mode: string;
  max_views: number | null;
  created_at: string;
}

const empty = {
  title: "",
  body: "",
  image_url: "",
  link_url: "",
  button_text: "",
  is_active: true,
  show_mode: "limited",
  max_views: 1,
};

export default function AdminAnnouncements() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<typeof empty>(empty);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setItems((data || []) as Announcement[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setEditing(null);
    setForm(empty);
  };

  const startEdit = (a: Announcement) => {
    setEditing(a.id);
    setForm({
      title: a.title,
      body: a.body || "",
      image_url: a.image_url || "",
      link_url: a.link_url || "",
      button_text: a.button_text || "",
      is_active: a.is_active,
      show_mode: a.show_mode,
      max_views: a.max_views ?? 1,
    });
  };

  const save = async () => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    const payload = {
      title: form.title.trim(),
      body: form.body || null,
      image_url: form.image_url || null,
      link_url: form.link_url || null,
      button_text: form.button_text || null,
      is_active: form.is_active,
      show_mode: form.show_mode,
      max_views: form.show_mode === "limited" ? Number(form.max_views) || 1 : null,
    };
    if (editing) {
      const { error } = await supabase.from("announcements").update(payload).eq("id", editing);
      if (error) return toast.error(error.message);
      toast.success("Updated");
    } else {
      const { error } = await supabase.from("announcements").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Created");
    }
    resetForm();
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this announcement?")) return;
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  const toggle = async (a: Announcement) => {
    const { error } = await supabase
      .from("announcements")
      .update({ is_active: !a.is_active })
      .eq("id", a.id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Megaphone className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Announcements</h1>
        </div>

        <Card className="p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            {editing ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editing ? "Edit Announcement" : "New Announcement"}
          </h2>

          <div className="space-y-2">
            <Label>Title *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label>Body / Description</Label>
            <Textarea
              rows={4}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Image URL</Label>
              <Input
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>Link URL (button)</Label>
              <Input
                value={form.link_url}
                onChange={(e) => setForm({ ...form, link_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>Button Text</Label>
              <Input
                value={form.button_text}
                onChange={(e) => setForm({ ...form, button_text: e.target.value })}
                placeholder="Learn More"
              />
            </div>
            <div className="space-y-2">
              <Label>Show Mode</Label>
              <Select
                value={form.show_mode}
                onValueChange={(v) => setForm({ ...form, show_mode: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="once">Once only</SelectItem>
                  <SelectItem value="limited">Custom (X times)</SelectItem>
                  <SelectItem value="always">Always (every open)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.show_mode === "limited" && (
              <div className="space-y-2">
                <Label>Max views per user</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.max_views}
                  onChange={(e) => setForm({ ...form, max_views: Number(e.target.value) })}
                />
              </div>
            )}
            <div className="flex items-center gap-3 pt-6">
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
              <Label>Active</Label>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={save}>{editing ? "Update" : "Create"}</Button>
            {editing && (
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            )}
          </div>
        </Card>

        <div className="space-y-3">
          <h2 className="font-semibold">All Announcements ({items.length})</h2>
          {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {!loading && items.length === 0 && (
            <p className="text-sm text-muted-foreground">No announcements yet.</p>
          )}
          {items.map((a) => (
            <Card key={a.id} className="p-4">
              <div className="flex items-start gap-3">
                {a.image_url && (
                  <img src={a.image_url} alt="" className="h-16 w-16 rounded object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{a.title}</h3>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full ${
                        a.is_active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {a.is_active ? "Active" : "Inactive"}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {a.show_mode === "limited"
                        ? `${a.max_views}x`
                        : a.show_mode}
                    </span>
                  </div>
                  {a.body && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{a.body}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={a.is_active ? "Deactivate announcement" : "Activate announcement"}
                    onClick={() => toggle(a)}
                  >
                    <Power className={`h-4 w-4 ${a.is_active ? "text-primary" : "text-muted-foreground"}`} />
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => startEdit(a)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => remove(a.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}