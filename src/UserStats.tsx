import MyTable from "./Table";
import { useContext, useEffect, useState } from "react";
import humanizeDuration from "humanize-duration";
import { GlobalContext, ManagementContext, ProjectContext } from "./Context";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import type { UserStatsType } from "./schemaTypes";

export default function UserStats() {
  const { project } = useContext(ProjectContext)!;
  const {client} = useContext(GlobalContext)!;
  const { allUsers } = useContext(ManagementContext)!;
  const [stats, setStats] = useState<Record<string,{observationCount: number, annotationCount: number, activeTime: number}>>({});
  const [startDate, setStartDate] = useState<String | null>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [endDate, setEndDate] = useState<Date | null>(new Date());
  const [userStats, setUserStats] = useState<UserStatsType[]>([]);

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
    const startString = startDate ? `${startDate?.getFullYear()}-${String(startDate?.getMonth() + 1).padStart(2, '0')}-${String(startDate?.getDate()).padStart(2, '0')}` : null
    const endString = endDate ? `${endDate?.getFullYear()}-${String(endDate?.getMonth() + 1).padStart(2, '0')}-${String(endDate?.getDate()).padStart(2, '0')}` : null

    if (project) {
      userStats.forEach(s => {
        if (!startString || (s.date >= startString) && (!endString || (s.date <= endString))) {
          setStats(prev => {
            if (!prev[s.userId]) {
              prev[s.userId]={observationCount: 0, annotationCount: 0, activeTime: 0};
            }
            prev[s.userId].observationCount += s.observationCount;
            prev[s.userId].annotationCount += s.annotationCount;
            prev[s.userId].activeTime += s.activeTime;
            return prev;
          })
        }
      })
    }
  }, [project, startDate, endDate, userStats]);

  const tableData = Object.keys(stats).map(userId => ({
    id: userId,
    rowData: [allUsers.find(u => u.id == userId)?.name,
      humanizeDuration(stats[userId].activeTime*1000, { units: ["h", "m", "s"], round: true, largest: 2 }),
      stats[userId].observationCount,
      (stats[userId].activeTime / stats[userId].observationCount || 0).toFixed(1),
      stats[userId].annotationCount]
  }))  
  
  const tableHeadings = [
    { content: "Username", style: undefined },
    { content: "Time spent", style: undefined },
    { content: `Jobs completed`, style: undefined },
    { content: "Average time (s/job)", style: undefined },
    { content: "Total Annotations", style: undefined },
  ];
  return (
    <div className="h-100">
      <div className="mt-2">
        <div className="d-flex gap-3 align-items-center">
          <div className="d-flex align-items-center gap-2">
            <label htmlFor="start-date" className="mb-0">From:</label>
            <DatePicker
              id="start-date"
              selected={startDate}
              onChange={(date) => setStartDate(date)}
              selectsStart
              timeZone="UTC"
              startDate={startDate}
              endDate={endDate}
              placeholderText="Start Date"
              className="form-control"
              isClearable
              placeholderText="No start date"
            />
          </div>
          <div className="d-flex align-items-center gap-2">
            <label htmlFor="end-date" className="mb-0">To:</label>
            <DatePicker
              id="end-date"
              selected={endDate}
              onChange={(date) => setEndDate(date)}
              selectsEnd
              timeZone="UTC"
              startDate={startDate}
              endDate={endDate}
              placeholderText="End Date"
              className="form-control"
              isClearable
              placeholderText="No end date"
            />
          </div>
        </div>
        <div className="mt-3">
          <MyTable
            tableHeadings={tableHeadings}
            tableData={tableData}
          />
        </div>
      </div>
    </div>
  );
}
