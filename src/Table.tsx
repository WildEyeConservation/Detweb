import Table from 'react-bootstrap/Table';
import type { CSSProperties } from 'react';
import { useState, useEffect } from 'react';
import Button from 'react-bootstrap/esm/Button';
import { MoveUp, MoveDown } from 'lucide-react';

interface TableObject {
  tableData: { id: any; rowData: React.ReactNode[] }[];
  tableHeadings?: { content: string; style?: CSSProperties; sort?: boolean }[];
  pagination?: boolean;
  itemsPerPage?: number;
  emptyMessage?: string;
}

type SortDirection = 'asc' | 'desc';

export default function MyTable(input: TableObject) {
  const {
    tableData,
    tableHeadings,
    pagination = false,
    itemsPerPage = 10,
    emptyMessage = 'No data',
  } = input;
  const [sortedData, setSortedData] = useState(tableData);
  const [sortConfig, setSortConfig] = useState<{
    index: number;
    direction: SortDirection;
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  const handleSort = (index: number) => {
    let direction: SortDirection = 'asc';
    if (
      sortConfig &&
      sortConfig.index === index &&
      sortConfig.direction === 'asc'
    ) {
      direction = 'desc';
    }

    const sorted = [...sortedData].sort((a, b) => {
      const aValue = a.rowData[index];
      const bValue = b.rowData[index];

      const isNumeric = (value: string) => /^-?\d+(\.\d+)?$/.test(value);
      
      if (isNumeric(aValue as string) && isNumeric(bValue as string)) {
        const aNum = parseFloat(aValue as string);
        const bNum = parseFloat(bValue as string);
        if (aNum < bNum) return direction === 'asc' ? -1 : 1;
        if (aNum > bNum) return direction === 'asc' ? 1 : -1;
        return 0;
      }

      // Fallback to string comparison
      const aStr = typeof aValue === 'string' ? aValue : JSON.stringify(aValue);
      const bStr = typeof bValue === 'string' ? bValue : JSON.stringify(bValue);

      if (aStr < bStr) return direction === 'asc' ? -1 : 1;
      if (aStr > bStr) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    setSortedData(sorted);
    setSortConfig({ index, direction });
    setCurrentPage(0);
  };

  const renderSortIndicator = (index: number) => {
    if (!sortConfig || sortConfig.index !== index) return null;
    return sortConfig.direction === 'asc' ? <MoveUp size={16}/> : <MoveDown size={16}/>;
  };

  const totalPages = pagination
    ? Math.ceil(sortedData.length / itemsPerPage)
    : 1;
  const paginatedData = pagination
    ? sortedData.slice(
        currentPage * itemsPerPage,
        (currentPage + 1) * itemsPerPage
      )
    : sortedData;

  useEffect(() => {
    setSortedData(tableData);
  }, [tableData]);

  return (
    tableData.length > 0 ? (
    <div>
      <Table bordered hover>
        {tableHeadings && (
          <thead>
            <tr>
              {tableHeadings.map(({ content, style, sort }, index) => (
                <th
                  key={`heading${index}`}
                  onClick={sort ? () => handleSort(index) : undefined}
                  style={{ cursor: sort ? 'pointer' : 'default', ...style }}
                >
                  <div className="d-flex align-items-center justify-content-between">
                    {content}
                    {sort && renderSortIndicator(index)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {paginatedData?.map((row) => (
            <tr key={row.id} className="align-middle">
              {row.rowData.map((content, index) => (
                <td key={`column${index}`}>{content}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
      {pagination && (
        <div className="text-end d-flex justify-content-between align-items-center">
          <p className="d-inline mb-0">
            Page {currentPage + 1} of {totalPages}
          </p>
          <div>
            <Button
              variant="primary"
              onClick={() => {setCurrentPage((c) => c - 1)}}
              disabled={currentPage === 0}
            >
              &lt;
            </Button>
            <Button
              variant="primary"
              onClick={() => setCurrentPage((c) => c + 1)}
              disabled={currentPage === Math.ceil(sortedData.length / itemsPerPage) - 1}
            >
              &gt;
            </Button>
          </div>
        </div>
        )}
      </div>
    ) : (
      <div className="text-center">
        <h5>{emptyMessage}</h5>
      </div>
    )
  );
}
