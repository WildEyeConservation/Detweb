import { useContext, useState, useEffect } from 'react';
import { GlobalContext, UserContext } from '../Context';
import { list } from 'aws-amplify/storage';
import { fetchAllPaginatedResults } from '../utils';

interface Project {
  projectId: string;
  isAdmin: boolean;
}

export default function UploadIntegrityChecker() {
  const { client } = useContext(GlobalContext)!;
  const { myMembershipHook } = useContext(UserContext)!;
  const projects =
    (myMembershipHook.data as Project[])?.filter((p) => p.isAdmin) ?? [];
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [missingEntries, setMissingEntries] = useState<string[]>([]);
  const [s3Count, setS3Count] = useState<number>(0);
  const [dbCount, setDbCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [projectNames, setProjectNames] = useState<[string, string][]>([]);
  const [count, setCount] = useState<number>(0);

  const handleCheck = async () => {
    if (!selectedProjectId) {
      alert('Please select a project');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Fetch image set for the project
      const imageSetResult: any =
        await client.models.ImageSet.imageSetsByProjectId({
          projectId: selectedProjectId,
        });
      const imageSet = imageSetResult.data[0];
      // Fetch files from S3
      const { items } = await list({
        path: `images/${imageSet.name}/`,
        options: { bucket: 'inputs', listAll: true },
      });
      const s3Paths = Array.from(
        new Set(items.map((item: any) => item.path.substring('images/'.length)))
      );
      setS3Count(s3Paths.length);
      console.log(s3Paths);

      // Fetch DB entries
      const dbRaw = (await fetchAllPaginatedResults(
        client.models.Image.imagesByProjectId,
        { projectId: selectedProjectId, selectionSet: ['originalPath'] }
      )) as any[];
      const dbPaths = dbRaw.map((i) => i.originalPath);
      setDbCount(dbPaths.length);

      // Compare
      const dbSet = new Set(dbPaths);
      console.log(dbSet);
      const missing = s3Paths.filter((path) => !dbSet.has(path));
      console.log(missing);
      setMissingEntries(missing);
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function getProjectNames() {
      if (projects.length > 0 && count === 0) {
        const projectNames = [];
        for (const project of projects) {
          const projectResult: any = await client.models.Project.get({
            id: project.projectId,
          });
          projectNames.push([project.projectId, projectResult.data.name]);
        }
        setProjectNames(projectNames);
        setCount(1);
      }
    }
    getProjectNames();
  }, [projects]);

  return (
    <div>
      <h2>Upload Integrity Checker</h2>
      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor='project-select' style={{ marginRight: '0.5rem' }}>
          Select project:
        </label>
        <select
          id='project-select'
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
        >
          <option value=''>-- Select project --</option>
          {projects.map((project) => (
            <option key={project.projectId} value={project.projectId}>
              {projectNames.find(
                (name) => name[0] === project.projectId
              )?.[1] || project.projectId}
            </option>
          ))}
        </select>
        <button
          onClick={handleCheck}
          disabled={loading || !selectedProjectId}
          style={{ marginLeft: '1rem' }}
        >
          {loading ? 'Checking...' : 'Check Integrity'}
        </button>
      </div>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {!loading && selectedProjectId && (
        <div>
          {missingEntries.length === 0 ? (
            <p>
              All {s3Count} S3 images have DB entries ({dbCount} entries).
            </p>
          ) : (
            <div>
              <p>Found {missingEntries.length} S3 images without DB entries:</p>
              <ul>
                {missingEntries.map((path) => (
                  <li key={path}>{path}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
