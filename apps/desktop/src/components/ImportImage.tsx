import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, FilePickerModal } from "@aria/ui";
import { api, errorText, type ImageRecord } from "@aria/core";
import { useApp } from "../store";

/** Uses desktop file paths, never browser fakepath or base64 IPC payloads. */
export function ImportImageButton({ onImported, projectId }: {
  onImported?: (image: ImageRecord) => void;
  projectId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [roots, setRoots] = useState<{ name: string; path: string }[]>([]);
  const activeProject = useApp((s) => s.settings.active_project_id);
  const toast = useApp((s) => s.toast);
  const client = useQueryClient();

  useEffect(() => {
    if (!open) return;
    let alive = true;
    void api.pickerRoots().then((result) => {
      if (alive) setRoots([...result.shortcuts, ...result.roots]);
    }).catch((error) => { if (alive) toast(errorText(error), "err"); });
    return () => { alive = false; };
  }, [open, toast]);

  const importFile = async (path: string) => {
    if (busy) return;
    setOpen(false);
    setBusy(true);
    try {
      const record = await api.imageImport(path, projectId ?? activeProject);
      const image = { ...record, width: Number(record.width), height: Number(record.height), size_bytes: Number(record.size_bytes), favorite: Boolean(record.favorite) };
      void client.invalidateQueries({ queryKey: ["gallery"] });
      void client.invalidateQueries({ queryKey: ["analytics"] });
      toast("عکس به کتابخانه اضافه شد؛ فایل اصلی روی کامپیوتر شما تغییر نکرد", "ok");
      onImported?.(image);
    } catch (error) { toast(errorText(error), "err"); }
    finally { setBusy(false); }
  };

  return <>
    <Button icon="upload" loading={busy} disabled={busy} onClick={() => setOpen(true)}>افزودن عکس از کامپیوتر</Button>
    <FilePickerModal
      open={open}
      title="انتخاب عکس از کامپیوتر"
      subtitle="یک کپی در کتابخانه ذخیره می‌شود؛ فایل اصلی تغییر نمی‌کند. حداکثر حجم: ۱۰۰ مگابایت."
      mode="file"
      roots={roots.length ? roots : [{ name: "پوشه شخصی", path: "" }]}
      onClose={() => setOpen(false)}
      onPick={(path) => void importFile(path)}
      loader={async (path) => {
        const listing = await api.pickerList(path);
        return { ...listing, files: listing.files.filter((entry) => entry.is_image) };
      }}
    />
  </>;
}
