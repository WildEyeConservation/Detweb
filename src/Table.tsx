import Table from "react-bootstrap/Table";
import type { CSSProperties } from "react";

interface TableObject {
  tableData: { id: any; rowData: React.ReactNode[] }[];
  tableHeadings: { content: string; style: CSSProperties | undefined }[];
}

export default function MyTable(input:TableObject) {
  const {tableData,tableHeadings}=input;
  return (
    <Table bordered hover>
      {
        <thead>
          <tr>
            {tableHeadings.map(({ content, style }, index) => (
              <th style={style} key={`heading${index}`}>
                {content}
              </th>
            ))}
          </tr>
        </thead>
      }
      <tbody>
        {tableData?.map((row) => (
          <tr key={row.id} className="align-middle">
            {row.rowData.map((content, index) => (
              <td key={`column${index}`}>{content}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
