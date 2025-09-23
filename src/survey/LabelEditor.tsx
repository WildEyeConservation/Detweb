import { Form, Button } from "react-bootstrap";
import { useRecordHotkeys } from "react-hotkeys-hook";
import MyTable from "../Table";
import { useState, useEffect, useCallback, useRef } from "react";
import { useContext } from "react";
import { GlobalContext } from "../Context";
import { useQueryClient } from "@tanstack/react-query";

interface Label {
  id: string;
  name: string;
  shortcutKey: string;
  color: string;
}

export default function LabelEditor({
  defaultLabels = [],
  importLabels = [],
  setHandleSave,
  isEditing = false,
}: {
  defaultLabels?: Label[];
  importLabels?: Label[];
  setHandleSave: React.Dispatch<
    React.SetStateAction<
      ((annotationSetId: string, projectId: string) => Promise<void>) | null
    >
  >;
  isEditing?: boolean;
}) {
  const [keys, { start, stop, isRecording }] = useRecordHotkeys();
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [labels, setLabels] = useState<Label[]>(defaultLabels);
  const { client } = useContext(GlobalContext)!;
  const defaultLabelsRef = useRef<Label[]>(defaultLabels);
  const queryClient = useQueryClient();

  useEffect(() => {
    defaultLabelsRef.current = defaultLabels;
  }, [defaultLabels]);

  const handleSave = useCallback(
    async (annotationSetId: string, projectId: string) => {
      const filteredLabels = labels.filter(
        (l) => l.name !== "" && l.shortcutKey !== ""
      );

      if (isEditing) {
        const currentDefaultLabels: Label[] = defaultLabelsRef.current;
        const filteredLabelIdsArray: string[] = filteredLabels.map((l: Label) => l.id);
        const defaultLabelIdsArray: string[] = currentDefaultLabels.map((l: Label) => l.id);
        const filteredLabelIds = new Set<string>(filteredLabelIdsArray);
        const defaultLabelIds = new Set<string>(defaultLabelIdsArray);
        // labels to delete
        await Promise.all(
          currentDefaultLabels
            .filter((l) => !filteredLabelIds.has(l.id))
            .map(async (l) => {
              await client.models.Category.delete({ id: l.id });
            })
        );

        //labels to create
        await Promise.all(
          filteredLabels
            .filter((l) => !defaultLabelIds.has(l.id))
            .map(async (l) => {
              await client.models.Category.create({
                projectId: projectId,
                name: l.name,
                shortcutKey: l.shortcutKey,
                color: l.color,
                annotationSetId: annotationSetId,
              });
            })
        );

        //labels to update
        await Promise.all(
          filteredLabels
            .filter((l) => defaultLabelIds.has(l.id))
            .map(async (l) => {
              await client.models.Category.update({
                id: l.id,
                name: l.name,
                shortcutKey: l.shortcutKey,
                color: l.color,
              });
            })
        );
      } else {
        await Promise.all(
          filteredLabels.map(async (l) => {
            await client.models.Category.create({
              name: l.name,
              shortcutKey: l.shortcutKey,
              color: l.color,
              annotationSetId: annotationSetId,
              projectId: projectId,
            });
          })
        );
      }

      await client.models.Project.update({
        id: projectId,
        status: "active",
      });

      await client.mutations.updateProjectMemberships({
        projectId: projectId,
      });

      // Ensure any persisted/react-query caches for categories are refreshed
      await queryClient.invalidateQueries({ queryKey: ["Category"] });
    },
    [client, labels, isEditing]
  );

  useEffect(() => {
    setHandleSave(() => handleSave);
  }, [handleSave]);

  useEffect(() => {
    if (importLabels.length > 0) {
      setLabels(importLabels);
    }
  }, [importLabels]);

  return (
    <Form.Group>
      <Form.Label className="mb-0">Labels</Form.Label>
      <span
        className="text-muted d-block mb-1"
        style={{ fontSize: 12, lineHeight: 1.2 }}
      >
        Set up the labels based on the species you expect to encounter.
      </span>
      <MyTable
        tableHeadings={[
          { content: "Name", style: { width: "25%" } },
          { content: "Shortcut Key", style: { width: "25%" } },
          { content: "Color", style: { width: "25%" } },
          { content: "Remove Label", style: { width: "25%" } },
        ]}
        tableData={labels.map((label) => ({
          id: label.id,
          rowData: [
            <Form.Control
              type="text"
              placeholder="Enter label name"
              value={label.name}
              onChange={(e) =>
                setLabels(
                  labels.map((l) =>
                    l.id === label.id ? { ...l, name: e.target.value } : l
                  )
                )
              }
            />,
            <Form.Control
              type="text"
              placeholder="Record shortcut key"
              value={
                isRecording && activeRowId === label.id
                  ? Array.from(keys).join("+")
                  : label.shortcutKey
              }
              onFocus={start}
              onBlur={() => {
                stop();
                const newShortcutKey = Array.from(keys).join("+");
                if (labels.some((l) => l.id !== label.id && l.shortcutKey === newShortcutKey)) {
                  alert("This shortcut key is already in use by another label.");
                  return;
                }
                setLabels(
                  labels.map((l) =>
                    l.id === label.id
                      ? {
                          ...l,
                          shortcutKey: newShortcutKey,
                        }
                      : l
                  )
                );
              }}
              onFocusCapture={() => setActiveRowId(label.id)}
              onBlurCapture={() => {
                if (activeRowId === label.id) {
                  setActiveRowId(null);
                }
              }}
              onChange={() => {}}
            />,
            <Form.Control
              type="color"
              id="exampleColorInput"
              size="sm"
              value={label.color}
              title="Label color"
              onChange={(event) => {
                setLabels(
                  labels.map((l) =>
                    l.id === label.id ? { ...l, color: event.target.value } : l
                  )
                );
              }}
            />,
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setLabels(labels.filter((l) => l.id !== label.id));
              }}
            >
              Remove
            </Button>,
          ],
        }))}
      />
      <Button
        variant="info"
        size="sm"
        onClick={() => {
          if (labels.some((l) => l.name === "" || l.shortcutKey === "")) {
            alert("Please complete the current label before adding another");
            return;
          }
          setLabels([
            ...labels,
            {
              id: crypto.randomUUID(),
              name: "",
              shortcutKey: "",
              color: "#000000",
            },
          ]);
        }}
      >
        +
      </Button>
    </Form.Group>
  );
}
