import MyTable from "./Table";
// import { onCreateCategory, onUpdateCategory, onDeleteCategory } from './graphql/subscriptions'
// import { listCategories } from './graphql/queries';
import { Row } from "react-bootstrap";
import { UserContext } from "./UserContext";
import { useContext, useEffect, useState } from "react";
import { annotationsByAnnotationSetId } from "./graphql/queries";
import humanizeDuration from "humanize-duration";
import { GraphQLResult } from "@aws-amplify/api";

interface UserStatsType {
  user: string;
  totalTime: number;
  totalJobs: number;
  tests: number;
  passes: number;
}

export default function UserStats() {
  const [stats, setStats] = useState<UserStatsType[]>([]);
  const { currentProject } = useContext(UserContext)!;

  const listObservations = `
  query MyQuery($nextToken: String) {
    listObservations(nextToken: $nextToken) {
      items {
        annotationSetId
        createdAt
        owner
      }
      nextToken
    }
  }`;

  const getUsersOnProject = `
  query MyQuery($projectId: String = "", $nextToken: String) {
    userProjectMembershipsByProjectId(projectId: $projectId, nextToken: $nextToken) {
      items {
        user {
          name
          id
        }
      }
      nextToken
    }
  }
  `;

  async function getObservations() {
    const observationsByUser = new Map<string, Array<{ annotationSetId: string; createdAt: number }>>();
    const numBySet = new Map<string, number>();
    const stats: UserStatsType[] = [];
    const users: string[] = [];

    let userNextToken: string | null = null;
    do {
      const response = await gqlClient.graphql(
        graphqlOperation(getUsersOnProject, {
          projectId: currentProject,
          nextToken: userNextToken,
        })
      ) as GraphQLResult<any>;
      const { data: { userProjectMembershipsByProjectId: { items, nextToken } } } = response;
      userNextToken = nextToken;
      for (const item of items) {
        users.push(item.user.id); 
      }
    } while (userNextToken);

    let observationNextToken: string | null = null;
    do {
      const response = await gqlClient.graphql(
        graphqlOperation(listObservations, { nextToken: observationNextToken })
      ) as GraphQLResult<any>;
      const { data: { listObservations: { items, nextToken } } } = response;
      observationNextToken = nextToken;
      for (const item of items) {
        if (!observationsByUser.has(item.owner)) {
          observationsByUser.set(item.owner, []);
        }
        observationsByUser.get(item.owner)!.push({
          annotationSetId: item.annotationSetId,
          createdAt: Date.parse(item.createdAt),
        });
        numBySet.set(item.annotationSetId, (numBySet.get(item.annotationSetId) || 0) + 1);
      }
    } while (observationNextToken);

    for (const user of users) {
      let prev = 0, totalTime = 0, tests = 0, passes = 0;
      const userObservations = observationsByUser.get(user) || [];
      for (const obs of userObservations.sort((a, b) => a.createdAt - b.createdAt)) {
        const delta = obs.createdAt - prev;
        if (delta < 60000) {
          totalTime += delta;
        }
        prev = obs.createdAt;
        if (numBySet.get(obs.annotationSetId) === 1) {
          // Test case detected
          tests += 1;
          const response = await gqlClient.graphql(
            graphqlOperation(annotationsByAnnotationSetId, {
              annotationSetId: obs.annotationSetId,
            })
          ) as GraphQLResult<any>;
          const { items } = response.data.annotationsByAnnotationSetId;
          if (items.length > 0) {
            passes += 1;
          }
        }
      }
      const userStats = {
        user,
        totalTime,
        totalJobs: observationsByUser.get(user)?.length || 0,
        tests,
        passes,
      };
      console.log(
        `Annotator ${user} spent ${totalTime / 1000}s to annotate ${userStats.totalJobs} images. (S)he was tested ${tests} times and passed ${passes} times`
      );
      console.log(
        `Speed ${user} ${totalTime / 1000 / userStats.totalJobs}s/image. Accuracy: ${passes / tests}`
      );
      stats.push(userStats);
    }
    setStats(stats);
  }

  useEffect(() => {
    if (currentProject) {
      getObservations().then((x) => console.log(x));
    }
  }, [currentProject]);

  const tableData = stats?.map((stats) => {
    return {
      id: crypto.randomUUID(),
      rowData: [
        stats.user,
        humanizeDuration(stats.totalTime, {
          units: ["d", "h", "m"],
          round: true,
          largest: 2,
        }),
        stats.totalJobs,
        `${(stats.totalTime / stats.totalJobs / 1000).toFixed(1)}s`,
        stats.tests,
        stats.passes,
        stats.tests
          ? ((stats.passes / stats.tests) * 100).toFixed(2) + "%"
          : "N/A",
      ],
    };
  });

  const tableHeadings = [
    { content: "Username", style: undefined },
    { content: "Time spent", style: undefined },
    { content: `Jobs completed`, style: undefined },
    { content: "Average time (s/job)", style: undefined },
    { content: "Tests", style: undefined },
    { content: "Passes", style: undefined },
    { content: "Accuracy", style: undefined },
  ];
  return (
    <>
      <Row className="justify-content-center mt-3">
        <div>
          <MyTable
            key="hannes"
            tableHeadings={tableHeadings}
            tableData={tableData}
          />
        </div>
      </Row>
    </>
  );
}
