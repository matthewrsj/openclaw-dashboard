import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { execCli } from "@/services/tauri-commands";
import { useChannelStore } from "@/stores/channels";
import { useUIStore } from "@/stores/ui";

export interface ChannelConfigModalProps {
  open: boolean;
  onClose: () => void;
  channelType: string;
  channelLabel: string;
}

/** A single field definition for a known channel type. */
interface FieldDef {
  key: string;
  label: string;
  placeholder?: string;
  sensitive?: boolean;
}

/** Field definitions for known channel types. */
const CHANNEL_FIELDS: Record<string, FieldDef[]> = {
  telegram: [
    {
      key: "bot_token",
      label: "Bot Token",
      placeholder: "123456:ABC-DEF...",
      sensitive: true,
    },
  ],
  discord: [
    {
      key: "bot_token",
      label: "Bot Token",
      placeholder: "Bot token from the Discord developer portal",
      sensitive: true,
    },
  ],
  slack: [
    {
      key: "bot_token",
      label: "Bot Token",
      placeholder: "xoxb-...",
      sensitive: true,
    },
    {
      key: "app_token",
      label: "App Token",
      placeholder: "xapp-...",
      sensitive: true,
    },
  ],
  whatsapp: [
    {
      key: "phone_number_id",
      label: "Phone Number ID",
      placeholder: "WhatsApp Business phone number ID",
      sensitive: false,
    },
    {
      key: "access_token",
      label: "Access Token",
      placeholder: "Meta API access token",
      sensitive: true,
    },
  ],
  signal: [
    {
      key: "phone_number",
      label: "Phone Number",
      placeholder: "+15551234567",
      sensitive: false,
    },
  ],
};

/** A generic key-value pair for unknown channel types. */
interface GenericEntry {
  key: string;
  value: string;
}

function KnownChannelForm({
  fields,
  values,
  errors,
  onChange,
}: {
  fields: FieldDef[];
  values: Record<string, string>;
  errors: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div className="space-y-4">
      {fields.map((field) => (
        <Input
          key={field.key}
          id={`channel-field-${field.key}`}
          label={field.label}
          type={field.sensitive ? "password" : "text"}
          placeholder={field.placeholder}
          value={values[field.key] ?? ""}
          error={errors[field.key]}
          onChange={(e) => onChange(field.key, e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      ))}
    </div>
  );
}

function GenericChannelForm({
  entries,
  onChange,
  onAdd,
  onRemove,
}: {
  entries: GenericEntry[];
  onChange: (index: number, field: "key" | "value", value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="space-y-3">
      {entries.map((entry, index) => (
        <div key={index} className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              id={`generic-key-${index}`}
              label={index === 0 ? "Key" : undefined}
              placeholder="config_key"
              value={entry.key}
              onChange={(e) => onChange(index, "key", e.target.value)}
              spellCheck={false}
            />
          </div>
          <div className="flex-1">
            <Input
              id={`generic-value-${index}`}
              label={index === 0 ? "Value" : undefined}
              placeholder="value"
              value={entry.value}
              onChange={(e) => onChange(index, "value", e.target.value)}
              spellCheck={false}
            />
          </div>
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="mb-px h-8 px-2 text-text-tertiary hover:text-status-error transition-colors"
            title="Remove row"
            aria-label="Remove row"
          >
            x
          </button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={onAdd}>
        + Add field
      </Button>
    </div>
  );
}

export function ChannelConfigModal({
  open,
  onClose,
  channelType,
  channelLabel,
}: ChannelConfigModalProps) {
  const fetchChannels = useChannelStore((s) => s.fetchChannels);
  const addToast = useUIStore((s) => s.addToast);

  const knownFields = CHANNEL_FIELDS[channelType] ?? null;

  // State for known-type fields: fieldKey -> value
  const [knownValues, setKnownValues] = useState<Record<string, string>>(() =>
    knownFields
      ? Object.fromEntries(knownFields.map((f) => [f.key, ""]))
      : {},
  );

  // State for generic key-value entries
  const [genericEntries, setGenericEntries] = useState<GenericEntry[]>([
    { key: "", value: "" },
  ]);

  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function handleKnownChange(key: string, value: string) {
    setKnownValues((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function handleGenericChange(
    index: number,
    field: "key" | "value",
    value: string,
  ) {
    setGenericEntries((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function handleGenericAdd() {
    setGenericEntries((prev) => [...prev, { key: "", value: "" }]);
  }

  function handleGenericRemove(index: number) {
    setGenericEntries((prev) => prev.filter((_, i) => i !== index));
  }

  function validate(): boolean {
    if (knownFields) {
      const errors: Record<string, string> = {};
      for (const field of knownFields) {
        if (!knownValues[field.key]?.trim()) {
          errors[field.key] = "This field is required";
        }
      }
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return false;
      }
    } else {
      const hasValidEntry = genericEntries.some(
        (e) => e.key.trim() && e.value.trim(),
      );
      if (!hasValidEntry) {
        addToast({ type: "error", message: "Enter at least one key-value pair" });
        return false;
      }
    }
    return true;
  }

  async function handleSave() {
    if (!validate()) return;

    setSaving(true);
    try {
      const entries: Array<[string, string]> = knownFields
        ? knownFields.map((f) => [f.key, knownValues[f.key]])
        : genericEntries
            .filter((e) => e.key.trim() && e.value.trim())
            .map((e) => [e.key.trim(), e.value.trim()]);

      for (const [fieldKey, fieldValue] of entries) {
        const configKey = `channels.${channelType}.${fieldKey}`;
        const result = await execCli(["config", "set", configKey, fieldValue]);
        if (result && result.exitCode !== 0) {
          throw new Error(
            result.stderr || `Failed to set ${configKey} (exit ${result.exitCode})`,
          );
        }
      }

      addToast({ type: "success", message: `${channelLabel} configured successfully` });
      await fetchChannels();
      onClose();
    } catch (err) {
      addToast({
        type: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    if (!saving) onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`Configure ${channelLabel}`}
      size="sm"
      preventClose={saving}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          Enter the credentials for {channelLabel}. Values are saved to your
          local OpenClaw configuration.
        </p>
        {knownFields ? (
          <KnownChannelForm
            fields={knownFields}
            values={knownValues}
            errors={fieldErrors}
            onChange={handleKnownChange}
          />
        ) : (
          <GenericChannelForm
            entries={genericEntries}
            onChange={handleGenericChange}
            onAdd={handleGenericAdd}
            onRemove={handleGenericRemove}
          />
        )}
      </div>
    </Modal>
  );
}
