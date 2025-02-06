import { Button, Modal } from "react-bootstrap";
import { useContext, useState, useEffect } from "react";
import { GlobalContext, ProjectContext, ManagementContext } from "./Context";
import { fetchAllPaginatedResults } from "./utils";
import MyTable from "./Table";
import { BarChart } from '@mui/x-charts/BarChart';
import Tabs from 'react-bootstrap/Tabs';
import Tab from 'react-bootstrap/Tab';
import exportFromJSON from 'export-from-json';
import { useUpdateProgress } from "./useUpdateProgress";

//TODO: get from schema
type Result = {
    testPreset: {
        name: string;
    };
    testAnimals: number;
    totalMissedAnimals: number;
    passed: boolean;
    categoryCounts: {
        categoryId: string;
        userCount: number;
        testCount: number;
        category: {
            name: string;
        };
    }[];
    readonly id: string;
    readonly createdAt: string;
    readonly updatedAt: string;
}

export default function UserTestResultsModal({show, onClose, userId}: {show: boolean, onClose: () => void, userId: string}) {
    const { client } = useContext(GlobalContext)!;
    const { allUsers } = useContext(ManagementContext)!;
    const [results, setResults] = useState<Result[]>([]);
    const [username, setUsername] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const [setCompilingFiles, setTotalFilesCompiled] = useUpdateProgress({
        taskId: `Compiling files`,
        indeterminateTaskName: `Compiling files`,
        determinateTaskName: "Compiling files",
        stepFormatter: (count)=>`${count} files`,
    });

    useEffect(() => {
        const user = allUsers.find((user) => user.id === userId);
        if (user) setUsername(user.name);
    }, [allUsers, userId]);
    

    useEffect(() => {
        async function setup() {
            setIsLoading(true);
            
            const results = await fetchAllPaginatedResults(client.models.TestResult.testResultsByUserId, {
                userId: userId,
                selectionSet: ['id', 'testPreset.name', 'testAnimals', 'totalMissedAnimals', 'passed', 'createdAt', 'categoryCounts.categoryId', 'categoryCounts.userCount', 'categoryCounts.testCount', 'categoryCounts.category.name']
            });

            setResults(results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));

            setIsLoading(false);
        }
        if (show) setup();
    }, [show]);

    const headings = [
        {content: "Date", style: {width: "20%"}, sort: true},
        {content: "Preset", style: {width: "20%"}, sort: true},
        {content: "Test Animals", style: {width: "20%"}, sort: true},
        {content: "Missed Animals", style: {width: "20%"}, sort: true},
        {content: "Passed", style: {width: "20%"}, sort: true},

    ]

    const tableData = results.map((result) => {
        const date = new Date(result.createdAt).toISOString().split('T');
        return {
            id: result.id,
            rowData: [`${date[0].replace(/-/g, '/')} - ${date[1].substring(0, 8)}`, result.testPreset.name, result.testAnimals, result.totalMissedAnimals, result.passed ? "Yes" : "No"]
        }

    })

    const passed = results.filter((result) => result.passed).length;
    const failed = results.length - passed;
    const totalAnimals = results.reduce((acc, result) => acc + result.testAnimals, 0);

    // Calculate Undercounted and Overcounted Animals
    const undercountedAnimals = results.reduce((acc, result) => acc + (result.totalMissedAnimals > 0 ? result.totalMissedAnimals : 0), 0);
    const overcountedAnimals = results.reduce((acc, result) => acc + (result.totalMissedAnimals < 0 ? Math.abs(result.totalMissedAnimals) : 0), 0);

    // Adjusted Total Animals for Accuracy Calculation
    const adjustedTotalAnimals = totalAnimals + overcountedAnimals;

    // Calculate Annotation Accuracy
    const annotationAccuracy = adjustedTotalAnimals > 0 
        ? (((totalAnimals - undercountedAnimals) / adjustedTotalAnimals) * 100).toFixed(2)
        : "0.00";

    const countsByCategory = results.flatMap((result) => result.categoryCounts).reduce((acc, category) => {
        if (!acc[category.categoryId]) {
            acc[category.categoryId] = {
                userCount: 0,
                testCount: 0,
                name: category.category.name
            };
        }
        acc[category.categoryId].userCount += category.userCount;
        acc[category.categoryId].testCount += category.testCount;
        return acc;


    }, {} as Record<string, {userCount: number, testCount: number, name: string}>);

    const accuracyByCategory = Object.entries(countsByCategory).map(([categoryId, counts]) => {
        const accuracy = counts.userCount / counts.testCount;
        const countPercentage = accuracy > 1
            ? parseFloat(((accuracy - 1) * 100).toFixed(2))
            : parseFloat(((1 - accuracy) * 100).toFixed(2)) * -1;
        return {
            categoryId,
            name: counts.name,
            countPercentage: countPercentage / 100
        }

    }).sort((a, b) => a.name.localeCompare(b.name));

    const summaryCards = [
        {
            content: [
                `Undercounted animals: ${undercountedAnimals}`,
                `Overcounted animals: ${overcountedAnimals}`
            ]
        },
        {
            content: [`Tests passed: ${passed}`, `Tests failed: ${failed}`]
        },
        {
            content: [
                `Annotation accuracy: ${annotationAccuracy}%`,
                `Test success rate: ${((passed / results.length) * 100).toFixed(2)}%`
            ]
        }
    ]

    function exportResults() {
        setCompilingFiles(0);
        setTotalFilesCompiled(2);

        exportFromJSON({
            data: results.map((result) => ({
                date: result.createdAt,
                preset: result.testPreset.name,
                testAnimals: result.testAnimals,
                missedAnimals: result.totalMissedAnimals,
                passed: result.passed
            })),
            fileName: `${username}-test-results`,
            exportType: 'csv',
        })

        setCompilingFiles(1);

        exportFromJSON({
            data: accuracyByCategory.map((category) => ({
                category: category.name,
                overUnderPercentage: category.countPercentage.toFixed(4)
            })),
            fileName: `${username}-category-accuracy`,
            exportType: 'csv',

        })

        setCompilingFiles(2);
    }

    return (
        <Modal show={show} onHide={onClose} size="xl">
            <Modal.Header closeButton>
                <Modal.Title>Test results for {username}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {results.length === 0 ? (
                    <p className="mt-2">{isLoading ? "Loading..." : "No test results found for " + username}</p>
                ) : (
                    <Tabs defaultActiveKey="results" id="uncontrolled-tab-example" className="mb-3">
                        <Tab eventKey="results" title="All Results">

                            <p className="mb-2">Summary</p>
                            <div className="d-flex gap-3 mb-3">
                                {summaryCards.map((card, index) => (
                                    <SummaryCard key={index} content={card.content} />
                                ))}
                            </div>
                            <p className="mb-2">All Results</p>
                            <MyTable 
                                tableHeadings={headings} 
                                tableData={tableData} 

                                pagination={true}
                            />
                        </Tab>
                        <Tab eventKey="ca" title="Category Accuracy" className="text-white">
                            <p className="text-center mb-0" style={{fontSize: "1.5rem"}}>Over/Under Count Percentage By Category</p>
                            <BarChart
                                dataset={accuracyByCategory}
                                margin={{bottom: 80}}

                                sx={
                                    {
                                        "& .MuiChartsAxis-bottom .MuiChartsAxis-line":{
                                            stroke:"#FFFFFF",
                                            strokeWidth:1
                                        },
                                        "& .MuiChartsAxis-left .MuiChartsAxis-line":{
                                            stroke:"#FFFFFF",
                                            strokeWidth:1
                                        },
                                        "& .MuiChartsAxis-tickContainer .MuiChartsAxis-tickLabel":{
                                            fill:"#FFFFFF",
                                            fontSize:12,
                                        },
                                        "& .MuiChartsAxis-tick":{
                                            stroke:"#FFFFFF",
                                            strokeWidth:1
                                        },
                                    }
                                }
                                xAxis={[
                                    { 
                                        scaleType: 'band', 
                                        dataKey: 'name',
                                    },
                                ]}
                                yAxis={[{
                                    colorMap: {
                                        type: 'piecewise',
                                        thresholds: [0],
                                        colors: ['red', 'cyan'],
                                    },
                                }]}

                                bottomAxis={
                                    {
                                        tickLabelStyle: {
                                        angle: 45,
                                        textAnchor: 'start',
                                        fontSize: 12,
                                        },
                                    }
                                }
                                series={[
                                    {
                                        dataKey: "countPercentage",
                                    }
                                ]}
                                height={400}
                                borderRadius={4}
                            />
                        </Tab>
                    </Tabs>
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onClose}>
                    Close
                </Button>
                { results.length > 0 && (
                    <Button variant="primary" onClick={exportResults}>
                        Export Results
                    </Button>
                )}
            </Modal.Footer>
        </Modal>
    )
}

function SummaryCard({content}: {content: (string | JSX.Element)[]}) {
    return (
        <div className="rounded-3 p-3 bg-dark text-white d-flex flex-column gap-1 shadow-sm border border-primary" >
            {content.map((item, index) => (
                <p key={index} className="mb-0">{item}</p>
            ))}
        </div>
    )

}