import React from "react";
import Table from "react-bootstrap/Table";

export default function MyTable({tableData,tableHeadings})
{
  return <Table bordered hover>
  {<thead>
    <tr>
      {tableHeadings.map(({content,style},index)=><th style={style} key={`heading${index}`}>{content}</th>)}
    </tr>
  </thead>}
  <tbody>
    {tableData?.map((row)=>
    <tr key={row.id} className="align-middle"> 
      {row.rowData.map((content,index)=>
      <td key={`column${index}`}>{content}</td>)}
    </tr>)
    }
  </tbody> 
  </Table>
}

