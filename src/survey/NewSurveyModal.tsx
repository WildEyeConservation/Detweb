import { Button, Form, Modal } from "react-bootstrap";
import { useState } from "react";
import { GlobalContext, UserContext } from "../Context";
import { useContext, useEffect } from "react";
import Select from "react-select";
import LabeledToggleSwitch from "../LabeledToggleSwitch";
import MyTable from "../Table";
import { useUsers } from "../apiInterface";
import { fetchAllPaginatedResults } from "../utils";
import { FilesUploadForm, formatFileSize } from "../FilesUploadComponent";
import { useQueryClient } from "@tanstack/react-query";
import { useUpdateProgress } from "../useUpdateProgress";
import { Schema } from "../../amplify/data/resource";
import {
  SendMessageBatchCommand,
  SendMessageCommand,
} from "@aws-sdk/client-sqs";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import pLimit from "p-limit";
import ImageMaskEditor from "../ImageMaskEditor";

export default function NewSurveyModal({
  show,
  onClose,
  projects,
  setDisabledSurveys,
}: {
  show: boolean;
  onClose: () => void;
  projects: string[];
  setDisabledSurveys: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const { myOrganizationHook, user, getSqsClient } = useContext(UserContext)!;
  const { client, backend } = useContext(GlobalContext)!;
  const { users: allUsers } = useUsers();
  const queryClient = useQueryClient();
  const limit = pLimit(10);

  const [filesReady, setFilesReady] = useState(false);
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState<{
    label: string;
    value: string;
  } | null>(null);
  const [organizations, setOrganizations] = useState<
    { label: string; value: string }[]
  >([]);
  const [globalAnnotationAccess, setGlobalAnnotationAccess] = useState<{
    label: string;
    value: string;
  } | null>(null);
  const [addPermissionExceptions, setAddPermissionExceptions] = useState(false);
  const [permissionExceptions, setPermissionExceptions] = useState<
    {
      user: {
        id: string;
        name: string;
      };
      annotationAccess: boolean;
      temp: boolean;
    }[]
  >([]);
  const [users, setUsers] = useState<
    Record<
      string,
      {
        id: string;
        name: string;
      }[]
    >
  >({});
  const [loading, setLoading] = useState(false);
  const [uploadSubmitFn, setUploadSubmitFn] = useState<
    | ((
        projectId: string,
        setStepsCompleted: (stepsCompleted: number) => void,
        setTotalSteps: (totalSteps: number) => void,
        onFinished?: () => void
      ) => Promise<{ images: Schema["Image"]["type"][]; imageSetId: string }>)
    | null
  >(null);
  const [model, setModel] = useState<{
    label: string;
    value: string;
  }>({
    label: "ScoutBot",
    value: "scoutbot",
  });
  const [masks, setMasks] = useState<number[][][]>([]);

  const canSubmit = !loading && filesReady && name && organization;

  const [setFilesUploaded, setTotalFiles] = useUpdateProgress({
    taskId: `Upload files`,
    determinateTaskName: `Uploading files`,
    indeterminateTaskName: `Preparing files`,
    stepFormatter: formatFileSize,
  });

  const [setImagesCompleted, setTotalImages] = useUpdateProgress({
    taskId: `Create ${model.label} task`,
    indeterminateTaskName: `Loading images`,
    determinateTaskName: "Processing images",
    stepFormatter: (x: number) => `${x} images`,
  });

  // Helper function to wait for heatmap completion before proceeding with point finder tasks
  const waitForHeatmapCompletion = async (
    images: Schema["Image"]["type"][]
  ): Promise<void> => {
    await Promise.all(
      images.map(async (image) => {
        const heatmapFilePath = image.originalPath!.replace(
          "images",
          "heatmaps"
        );
        let heatmapAvailable = false;
        const s3Client = new S3Client({});
        while (!heatmapAvailable) {
          try {
            await s3Client.send(
              new HeadObjectCommand({
                Bucket: backend.storage.buckets[0].bucket_name,
                Key: heatmapFilePath,
              })
            );
            heatmapAvailable = true;
          } catch (err) {
            // File not available yet, wait 2 seconds
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
      })
    );
  };

  async function handlePair(
    image1: Schema["Image"]["type"],
    image2: Schema["Image"]["type"]
  ) {
    console.log(`Processing pair ${image1.id} and ${image2.id}`);
    const { data: existingNeighbour } = await client.models.ImageNeighbour.get(
      {
        image1Id: image1.id,
        image2Id: image2.id,
      },
      { selectionSet: ["homography"] }
    );

    if (existingNeighbour?.homography) {
      console.log(
        `Homography already exists for pair ${image1.id} and ${image2.id}`
      );
      // setMessagePreppingStepsCompleted((s) => s + 1);
      return null; // Return null for filtered pairs
    }

    if (!existingNeighbour) {
      await client.models.ImageNeighbour.create({
        image1Id: image1.id,
        image2Id: image2.id,
      });
    }
    // setMessagePreppingStepsCompleted((s) => s + 1);
    // Return the message instead of sending it immediately
    return {
      Id: `${image1.id}-${image2.id}`, // Required unique ID for batch entries
      MessageBody: JSON.stringify({
        inputBucket: backend.custom.inputsBucket,
        image1Id: image1.id,
        image2Id: image2.id,
        keys: [image1.originalPath, image2.originalPath],
        action: "register",
        masks: masks.length > 0 ? masks : undefined,
      }),
    };
  }

  async function handleSave() {
    if (!name || !organization) {
      alert("Please fill in all fields");
      return;
    }

    if (projects.includes(name.toLowerCase())) {
      alert("A project with this name already exists");
      return;
    }

    setLoading(true);

    const { data: project } = await client.models.Project.create({
      name,
      organizationId: organization.value,
      createdBy: user.userId,
    });

    if (project) {
      const admins = await fetchAllPaginatedResults(
        client.models.OrganizationMembership.membershipsByOrganizationId,
        {
          organizationId: organization.value,
          filter: { isAdmin: { eq: true } },
          selectionSet: ["userId"],
        }
      );

      await Promise.all(
        admins.map(async (a) => {
          await client.models.UserProjectMembership.create({
            userId: a.userId,
            projectId: project.id,
            isAdmin: true,
          });
        })
      );

      const exceptions = permissionExceptions.filter((pe) => !pe.temp);

      await Promise.all(
        exceptions.map(async (e) => {
          if (e.annotationAccess) {
            await client.models.UserProjectMembership.create({
              userId: e.user.id,
              projectId: project.id,
              isAdmin: false,
            });
          }
        })
      );

      // users already exclude current user and admins
      const other = users[organization.value].filter(
        (u) => !exceptions.some((e) => e.user.id === u.id)
      );

      if (
        globalAnnotationAccess === null ||
        globalAnnotationAccess?.value === "Yes"
      ) {
        await Promise.all(
          other.map(async (u) => {
            await client.models.UserProjectMembership.create({
              userId: u.id,
              projectId: project.id,
              isAdmin: false,
            });
          })
        );
      }

      await client.models.ProjectTestConfig.create({
        projectId: project.id,
        testType: "interval",
        interval: 100,
        accuracy: 50,
        postTestConfirmation: false,
      });

      const { data: testPreset } = await client.models.TestPreset.create({
        name: name,
        organizationId: organization.value,
      });

      await client.models.TestPresetProject.create({
        testPresetId: testPreset.id,
        projectId: project.id,
      });

      queryClient.invalidateQueries({
        queryKey: ["UserProjectMembership"],
      });

      setLoading(false);
      onClose();

      if (uploadSubmitFn) {
        setDisabledSurveys((ds) => [...ds, project.id]);

        const { images, imageSetId } = await uploadSubmitFn(
          project.id,
          setFilesUploaded,
          setTotalFiles,
          () => {
            setDisabledSurveys((ds) => ds.filter((id) => id !== project.id));
          }
        );

        // #region compute image registrations
        // const imageCount =
        //   (
        //     await client.models.ImageSet.get(
        //       { id: imageSetId },
        //       { selectionSet: ["imageCount"] }
        //     )
        //   )?.data?.imageCount ?? 0;
        // setMetaDataLoadingTotalSteps(imageCount);

        images.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
        // setMessagePreppingTotalSteps(images.length - 1);
        // setMessagePreppingStepsCompleted(0);
        const pairPromises = [];
        for (let i = 0; i < images.length - 1; i++) {
          const image1 = images[i];
          const image2 = images[i + 1];
          if ((image2.timestamp ?? 0) - (image1.timestamp ?? 0) < 5) {
            pairPromises.push(handlePair(image1, image2));
          } else {
            console.log(
              `Skipping pair ${image1.id} and ${image2.id} because the time difference is greater than 5 seconds`
            );
            // setMessagePreppingStepsCompleted((s) => s + 1);
          }
        }

        const messages = (await Promise.all(pairPromises)).filter(
          (msg): msg is NonNullable<typeof msg> => msg !== null
        );

        // setRegistrationTotalSteps(messages.length);
        // setRegistrationStepsCompleted(0);
        // Send messages in batches of 10
        const sqsClient = await getSqsClient();
        for (let i = 0; i < messages.length; i += 10) {
          const batch = messages.slice(i, i + 10);
          await limit(() =>
            sqsClient.send(
              new SendMessageBatchCommand({
                QueueUrl: backend.custom.lightglueTaskQueueUrl,
                Entries: batch,
              })
            )
          );
          // setRegistrationStepsCompleted((s) => s + batch.length);
        }

        // #endregion

        if (model.value === "manual") {
          return;
        }

        const { data: locationSet } = await client.models.LocationSet.create({
          name: project.name + `_${model.value}`,
          projectId: project.id,
        });

        if (locationSet) {
          let i = 0;

          // kick off scoutbot or elephant detection tasks
          switch (model.value) {
            case "scoutbot":
              const chunkSize = 4;
              for (let i = 0; i < images.length; i += chunkSize) {
                const chunk = images.slice(i, i + chunkSize);
                const sqsClient = await getSqsClient();
                await sqsClient.send(
                  new SendMessageCommand({
                    QueueUrl: backend.custom.scoutbotTaskQueueUrl,
                    MessageBody: JSON.stringify({
                      images: chunk.map((image) => ({
                        imageId: image.id,
                        key: "images/" + image.originalPath,
                      })),
                      projectId: project.id,
                      bucket: backend.storage.buckets[1].bucket_name,
                      setId: locationSet.id,
                    }),
                  })
                );
                setImagesCompleted((s: number) => s + chunk.length);
                i++;
              }
              break;
            case "elephant-detection-nadir":
              // heatmap generation
              const heatmapTasks = images.map(async (image) => {
                const { data: imageFiles } =
                  await client.models.ImageFile.imagesByimageId({
                    imageId: image.id,
                  });
                const path = imageFiles.find(
                  (imageFile) => imageFile.type == "image/jpeg"
                )?.path;
                if (path) {
                  await client.mutations.processImages({
                    s3key: path,
                    model: "heatmap",
                  });
                } else {
                  console.log(
                    `No image file found for image ${image.id}. Skipping`
                  );
                }
              });
              await Promise.all(heatmapTasks);

              // Wait until all heatmaps are processed before proceeding
              // This polls the S3 bucket until the heatmaps are available
              // A better approach would be to kick of the point finder task from the processImages function
              await waitForHeatmapCompletion(images);

              // point finder
              const pointFinderTasks = images.map(async (image) => {
                const key = image.originalPath!.replace("images", "heatmaps");
                const sqsClient = await getSqsClient();
                await sqsClient.send(
                  new SendMessageCommand({
                    QueueUrl: backend.custom.pointFinderTaskQueueUrl,
                    MessageBody: JSON.stringify({
                      imageId: image.id,
                      projectId: project.id,
                      key: "heatmaps/" + key + ".h5",
                      width: 1024,
                      height: 1024,
                      threshold: 1 - Math.pow(10, -5),
                      bucket: backend.storage.buckets[0].bucket_name,
                      setId: locationSet.id,
                    }),
                  })
                );
                setImagesCompleted((s: number) => s + 1);
                i++;
              });
              await Promise.all(pointFinderTasks);
              break;
          }

          setTotalImages(i);
        }
      }
    } else {
      alert("Failed to create survey");
    }
  }

  useEffect(() => {
    if (allUsers && myOrganizationHook.data) {
      const adminOrganizations = myOrganizationHook.data.filter(
        (o) => o.isAdmin
      );

      Promise.all(
        adminOrganizations.map(
          async (o) =>
            (
              await client.models.Organization.get(
                {
                  id: o.organizationId,
                },
                {
                  selectionSet: ["name", "id", "memberships.*"],
                }
              )
            ).data
        )
      ).then((organizations) => {
        setOrganizations(
          organizations
            .filter((o) => o !== null)
            .map((o) => ({
              label: o.name,
              value: o.id,
            }))
        );

        if (organizations.length === 1) {
          setOrganization({
            label: organizations[0].name,
            value: organizations[0].id,
          });
        }

        setUsers(
          organizations
            .filter((o) => o !== null)
            .reduce(
              (acc, o) => ({
                ...acc,
                [o.id]: o.memberships
                  .filter((m) => !m.isAdmin)
                  .map((m) => ({
                    id: m.userId,
                    name: allUsers.find((u) => u.id === m.userId)?.name || "",
                  })),
              }),
              {}
            )
        );
      });
    }
  }, [myOrganizationHook.data, allUsers]);

  useEffect(() => {
    if (!show) {
      setName("");
      setGlobalAnnotationAccess(null);
      setAddPermissionExceptions(false);
      setPermissionExceptions([]);
      setUploadSubmitFn(null);
      setMasks([]);
    }
  }, [show]);

  return (
    <Modal show={show} onHide={onClose} size="xl">
      <Modal.Header closeButton>
        <Modal.Title>New Survey</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form className="d-flex flex-column gap-2">
          <Form.Group>
            <Form.Label>Name</Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter a unique identifying name for the survey."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Organization</Form.Label>
            <Select
              className="text-black"
              value={organization}
              options={organizations}
              onChange={(e) => setOrganization(e)}
              styles={{
                valueContainer: (base) => ({
                  ...base,
                  overflowY: "auto",
                }),
              }}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label className="mb-0">Permissions</Form.Label>
            <span
              className="text-muted d-block mb-1"
              style={{ fontSize: 12, lineHeight: 1.2 }}
            >
              Select the user permissions for non-admin users for this survey
              excluding yourself.
            </span>
            <div className="mb-2">
              <Form.Label style={{ fontSize: 14 }}>
                Annotation Access:
              </Form.Label>
              <Select
                className="text-black"
                value={globalAnnotationAccess}
                placeholder="Default (Yes)"
                options={[
                  { value: "Yes", label: "Yes" },
                  { value: "No", label: "No" },
                ]}
                onChange={(e) => setGlobalAnnotationAccess(e)}
                styles={{
                  valueContainer: (base) => ({
                    ...base,
                    overflowY: "auto",
                  }),
                }}
              />
            </div>
            <Form.Switch
              style={{ fontSize: 14 }}
              id="addPermissionExceptions"
              label="Add Permission Exceptions"
              checked={addPermissionExceptions}
              onChange={(e) => {
                if (!organization) {
                  alert("Please select an organization first");
                  return;
                }
                setAddPermissionExceptions(e.target.checked);
                if (!e.target.checked) {
                  setPermissionExceptions([]);
                }
              }}
            />
            {addPermissionExceptions && (
              <>
                <MyTable
                  tableHeadings={[
                    { content: "Username", style: { width: "33%" } },
                    { content: "Annotation Access", style: { width: "33%" } },
                    { content: "Remove Exception", style: { width: "33%" } },
                  ]}
                  tableData={permissionExceptions.map((exception) => ({
                    id: exception.user.id,
                    rowData: [
                      <Select
                        className="text-black"
                        value={{
                          label: exception.user.name,
                          value: exception.user.id,
                        }}
                        options={users[organization?.value || ""]
                          ?.filter(
                            (u) =>
                              !permissionExceptions.some(
                                (pe) => pe.user.id === u.id
                              )
                          )
                          .map((u) => ({
                            label: u.name,
                            value: u.id,
                          }))}
                        onChange={(selected) => {
                          setPermissionExceptions(
                            permissionExceptions.map((pe) =>
                              pe.user.id === exception.user.id
                                ? {
                                    ...pe,
                                    user: {
                                      ...pe.user,
                                      id: selected?.value || pe.user.id,
                                      name: selected?.label || pe.user.name,
                                    },
                                    temp: false,
                                  }
                                : pe
                            )
                          );
                        }}
                      />,
                      <LabeledToggleSwitch
                        className="mb-0"
                        leftLabel="No"
                        rightLabel="Yes"
                        checked={exception.annotationAccess}
                        onChange={(checked) => {
                          setPermissionExceptions(
                            permissionExceptions.map((pe) =>
                              pe.user.id === exception.user.id
                                ? { ...pe, annotationAccess: checked }
                                : pe
                            )
                          );
                        }}
                      />,
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          setPermissionExceptions(
                            permissionExceptions.filter(
                              (e) => e.user.id !== exception.user.id
                            )
                          );
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
                    if (permissionExceptions.some((e) => e.temp)) {
                      alert(
                        "Please complete the current permission exception before adding another"
                      );
                      return;
                    }
                    setPermissionExceptions([
                      ...permissionExceptions,
                      {
                        user: {
                          id: crypto.randomUUID(),
                          name: "Select a user",
                        },
                        annotationAccess: false,
                        temp: true,
                      },
                    ]);
                  }}
                >
                  +
                </Button>
              </>
            )}
          </Form.Group>
          <Form.Group>
            <Form.Label className="mb-0">Model</Form.Label>
            <Form.Text
              className="d-block text-muted mt-0 mb-1"
              style={{ fontSize: 12 }}
            >
              Select the model you wish to use to guide annotation.
            </Form.Text>
            <Select
              className="text-black"
              value={model}
              options={[
                {
                  label: "ScoutBot",
                  value: "scoutbot",
                },
                {
                  label: "Elephant Detection (nadir)",
                  value: "elephant-detection-nadir",
                },
                {
                  label: "Manual (model may be launched later)",
                  value: "manual",
                },
              ]}
              onChange={(e) => setModel(e)}
              placeholder="Select a model"
            />
          </Form.Group>
          <Form.Group>
            <Form.Label className="mb-0">Files to Upload</Form.Label>
            <p className="text-muted mb-1" style={{ fontSize: 12 }}>
              Upload the survey files by selecting the entire folder you wish to
              upload.
            </p>
            <FilesUploadForm
              setOnSubmit={setUploadSubmitFn}
              setReadyToSubmit={setFilesReady}
            />
          </Form.Group>
          <ImageMaskEditor masks={masks} setMasks={setMasks} />
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!canSubmit}
        >
          {loading ? "Creating..." : "Create"}
        </Button>
        <Button variant="dark" onClick={onClose}>
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
