import MyTable from "./Table";
import { useContext, useEffect, useState } from "react";
import humanizeDuration from "humanize-duration";
import { GlobalContext, UserContext } from "./Context";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import type { UserStatsType } from "./schemaTypes";
import exportFromJSON from "export-from-json";
import { QueryCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { useUsers } from "./apiInterface";
import Select from "react-select";
import { Card } from "react-bootstrap";

export default function UserStats() {
  const { getDynamoClient, myOrganizationHook, myMembershipHook } =
    useContext(UserContext)!;
  const { client, backend } = useContext(GlobalContext)!;
  const { users: allUsers } = useUsers();
  const [projects, setProjects] = useState<
    {
      id: string;
      name: string;
      annotationSets: { id: string; name: string }[];
      organization: { name: string };
    }[]
  >([]);
  const [project, setProject] = useState<{
    label: string;
    value: string;
  } | null>(null);
  const [stats, setStats] = useState<
    Record<
      string,
      { observationCount: number; annotationCount: number; activeTime: number }
    >
  >({});
  const [startDate, setStartDate] = useState<Date | null>(new Date());
  const [endDate, setEndDate] = useState<Date | null>(new Date());
  const [userStats, setUserStats] = useState<UserStatsType[]>([]);

  const [selectedSets, setSelectedSets] = useState<
    | {
        label: string;
        value: string;
      }[]
    | undefined
  >([]);

  const startString = startDate
    ? `${startDate?.getFullYear()}-${String(startDate?.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(startDate?.getDate()).padStart(2, "0")}`
    : null;
  const endString = endDate
    ? `${endDate?.getFullYear()}-${String(endDate?.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(endDate?.getDate()).padStart(2, "0")}`
    : null;

  useEffect(() => {
    async function loadProjects() {
      const userProjects = [
        ...new Set(myMembershipHook.data?.map((m) => m.projectId) || []),
      ];

      const projectPromises = userProjects.map((projectId) =>
        client.models.Project.get(
          { id: projectId },
          {
            selectionSet: [
              "id",
              "name",
              "annotationSets.id",
              "annotationSets.name",
              "organization.name",
            ],
          }
        )
      );

      const projectResults = await Promise.all(projectPromises);
      const validProjects = projectResults
        .map((result) => result.data)
        .filter(
          (project): project is NonNullable<typeof project> =>
            project !== null
        );

      setProjects(validProjects);
    }

    loadProjects();
  }, [myOrganizationHook.data]);

  useEffect(() => {
    const sub = client.models.UserStats.observeQuery().subscribe({
      next: ({ items, isSynced }) => {
        setUserStats([...items]);
      },
    });
    return () => sub.unsubscribe();
  }, []);

  useEffect(() => {
    setStats({});

    if (project) {
      userStats
        .filter((s) => s != null)
        .forEach((s) => {
          if (
            !startString ||
            (s.date >= startString && (!endString || s.date <= endString))
          ) {
            if (
              selectedSets &&
              selectedSets.length > 0 &&
              selectedSets.some((set) => set.value === s.setId)
            ) {
              setStats((prev) => {
                if (!prev[s.userId]) {
                  prev[s.userId] = {
                    observationCount: 0,
                    annotationCount: 0,
                    activeTime: 0,
                    sightingCount: 0,
                    searchTime: 0,
                    annotationTime: 0,
                    waitingTime: 0,
                  };
                }
                prev[s.userId].observationCount += s.observationCount;
                prev[s.userId].annotationCount += s.annotationCount;
                prev[s.userId].activeTime += s.activeTime;
                prev[s.userId].sightingCount += s.sightingCount;
                prev[s.userId].searchTime += s.searchTime;
                prev[s.userId].annotationTime += s.annotationTime;
                prev[s.userId].waitingTime += s.waitingTime;
                return prev;
              });
            }
          }
        });
    }
  }, [project, startDate, endDate, userStats, selectedSets]);

  const tableData = Object.keys(stats).map((userId) => ({
    id: userId,
    rowData: [
      allUsers.find((u) => u.id == userId)?.name,
      humanizeDuration(stats[userId].activeTime, {
        units: ["h", "m", "s"],
        round: true,
        largest: 2,
      }),
      stats[userId].observationCount,
      (
        stats[userId].searchTime / 1000 / stats[userId].observationCount || 0
      ).toFixed(1),
      stats[userId].annotationCount,
      stats[userId].sightingCount,
      humanizeDuration(stats[userId].searchTime, {
        units: ["h", "m", "s"],
        round: true,
        largest: 2,
      }),
      humanizeDuration(stats[userId].annotationTime, {
        units: ["h", "m", "s"],
        round: true,
        largest: 2,
      }),
      (
        stats[userId].observationCount / stats[userId].sightingCount || 0
      ).toFixed(1),
      humanizeDuration(stats[userId].waitingTime, {
        units: ["h", "m", "s"],
        round: true,
        largest: 2,
      }),
    ],
  }));

  const tableHeadings = [
    { content: "Username", style: undefined },
    { content: "Time spent", style: undefined },
    { content: `Jobs completed`, style: undefined },
    { content: "Average search time (s/job)", style: undefined },
    { content: "Total Annotations", style: undefined },
    { content: "Total Sightings", style: undefined },
    { content: "Total Search Time", style: undefined },
    { content: "Total Annotation Time", style: undefined },
    { content: "Locations/Sighting", style: undefined },
    { content: "Waiting time", style: undefined },
  ];

  async function queryObservations(annotationSetId: string): Promise<string[]> {
    const dynamoClient = await getDynamoClient();
    const locationIds: string[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;
    do {
      const command = new QueryCommand({
        TableName: backend.custom.observationTable,
        IndexName: "observationsByAnnotationSetIdAndCreatedAt",
        KeyConditionExpression:
          "annotationSetId  = :annotationSetId and createdAt BETWEEN :lowerLimit and :upperLimit",
        ExpressionAttributeValues: {
          ":annotationSetId": {
            S: annotationSetId,
          },
          ":lowerLimit": {
            S: startString + "T00:00:00Z",
          },
          ":upperLimit": {
            S: endString + "T23:59:59Z",
          },
        },
        ProjectionExpression:
          "createdAt,annotationCount, timeTaken, waitingTime, #o",
        ExpressionAttributeNames: { "#o": "owner" },
        ExclusiveStartKey: lastEvaluatedKey,
        // Increase page size for better throughput
        Limit: 1000,
      });
      try {
        const response = await dynamoClient.send(command);
        // Extract imageIds from the response
        locationIds.push(...response.Items.map((item) => unmarshall(item)));
        lastEvaluatedKey = response.LastEvaluatedKey;
      } catch (error) {
        console.error("Error querying DynamoDB:", error);
        throw error;
      }
    } while (lastEvaluatedKey);
    return locationIds;
  }

  const handleExportData = async () => {
    //Create a lookup table for user names
    const userLookup = new Map<string, string>();
    allUsers.forEach((u) => userLookup.set(u.id + "::" + u.id, u.name));
    for (const annotationSetId of selectedSets?.map((s) => s.value) || []) {
      const observations = await queryObservations(annotationSetId);
      const fileName = `DetWebObservations-${annotationSetId}`;
      const exportType = exportFromJSON.types.csv;
      exportFromJSON({
        data: observations.map((o) => ({
          ...o,
          owner: userLookup.get(o.owner),
        })),
        fileName,
        exportType,
      });
    }
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "1555px",
        marginTop: "16px",
        marginBottom: "16px",
      }}
    >
      <Card>
        <Card.Header>
          <Card.Title className="mb-0">
            <h4 className="mb-0">Annotation Statistics</h4>
          </Card.Title>
        </Card.Header>
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div className="d-flex align-items-center gap-2">
              <label htmlFor="start-date" className="mb-0">
                From:
              </label>
              <DatePicker
                id="start-date"
                selected={startDate}
                onChange={(date) => setStartDate(date)}
                selectsStart
                timeZone="UTC"
                startDate={startDate}
                endDate={endDate}
                className="form-control"
                isClearable
                placeholderText="No start date"
              />
            </div>
            <div className="d-flex align-items-center gap-2">
              <label htmlFor="end-date" className="mb-0">
                To:
              </label>
              <DatePicker
                id="end-date"
                selected={endDate}
                onChange={(date) => setEndDate(date)}
                selectsEnd
                timeZone="UTC"
                startDate={startDate}
                endDate={endDate}
                className="form-control"
                isClearable
                placeholderText="No end date"
              />
            </div>
          </div>

          <div className="mt-3">
            <label className="mb-2">Select Survey</label>
            <Select
              className="text-black"
              value={project}
              options={projects.map((p) => ({
                label: `${p.name} (${p.organization.name})`,
                value: p.id,
              }))}
              onChange={(e) => {
                setProject(e);
                setSelectedSets([]);
              }}
              styles={{
                valueContainer: (base) => ({
                  ...base,
                  overflowY: "auto",
                }),
              }}
            />
          </div>

          <div className="mt-3">
            <label className="mb-2">Select Annotation Sets</label>
            <Select
              className="text-black basic-multi-select"
              value={selectedSets}
              onChange={(e) => setSelectedSets(e)}
              isMulti
              name="Annotation sets"
              options={
                projects
                  .find((p) => p.id == project?.value)
                  ?.annotationSets.map((s) => ({
                    label: s.name,
                    value: s.id,
                  })) || []
              }
              classNamePrefix="select"
              closeMenuOnSelect={false}
              styles={{
                valueContainer: (base) => ({
                  ...base,
                  overflowY: "auto",
                }),
              }}
            />
          </div>

          <div className="mt-3 overflow-x-auto">
            <MyTable
              tableHeadings={tableHeadings}
              tableData={tableData}
              emptyMessage={
                project && selectedSets && selectedSets.length > 0
                  ? "No stats found"
                  : "Select a survey and annotation sets to view stats"
              }
            />
          </div>
        </Card.Body>
        <Card.Footer className="d-flex justify-content-center">
          <button onClick={handleExportData} className="btn btn-primary">
            Export Raw Observation Data
          </button>
        </Card.Footer>
      </Card>
    </div>
  );
}
