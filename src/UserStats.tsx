import MyTable from "./Table";
import { Row } from "react-bootstrap";
import { useContext, useEffect, useState } from "react";
import humanizeDuration from "humanize-duration";
import type { UserObservationStatsType } from "./schemaTypes";
import { fetchAllPaginatedResults } from "./utils";
import { GlobalContext, ManagementContext, ProjectContext } from "./Context";


export default function UserStats() {
  const { project } = useContext(ProjectContext)!;
  const {client} = useContext(GlobalContext)!;
  const { allUsers } = useContext(ManagementContext)!;
  const [stats, setStats] = useState<UserObservationStatsType[]>([]);

  useEffect(() => {
    if (project) {
      fetchAllPaginatedResults(client.models.UserObservationStats.list, {}).then(x => {
        setStats(x.filter(s => s.projectId == project.id))
      })
    }
  }, [project]);

  const tableData = stats.map(s => ({
    id: crypto.randomUUID(),
    rowData: [allUsers.find(u => u.id == s.userId)?.name,
      humanizeDuration(s.activeTime*1000, { units: ["h", "m", "s"], round: true, largest: 2 }),
      s.count,
      (s.activeTime / s.count).toFixed(1)]
  }))  
  
  const tableHeadings = [
    { content: "Username", style: undefined },
    { content: "Time spent", style: undefined },
    { content: `Jobs completed`, style: undefined },
    { content: "Average time (s/job)", style: undefined }
  ];
  return (
    <>
      <Row className="justify-content-center mt-3">
        <div>
          <MyTable
            tableHeadings={tableHeadings}
            tableData={tableData}
          />
        </div>
      </Row>
    </>
  );
}
