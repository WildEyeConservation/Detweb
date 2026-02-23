import TileConfiguration from './TileConfiguration';
import type { TiledLaunchRequest } from './types/LaunchTask';

interface CreateTaskProps {
  labels?: any[];
  name: string;
  projectId: string;
  setHandleCreateTask?: React.Dispatch<
    React.SetStateAction<(() => Promise<TiledLaunchRequest>) | null>
  >;
  setLaunchDisabled: React.Dispatch<React.SetStateAction<boolean>>;
  disabled?: boolean;
}

function CreateTask({
  name,
  projectId,
  labels: _labels,
  setHandleCreateTask,
  setLaunchDisabled,
  disabled = false,
}: CreateTaskProps) {
  return (
    <TileConfiguration
      name={name}
      projectId={projectId}
      setHandleCreateTask={setHandleCreateTask}
      setLaunchDisabled={setLaunchDisabled}
      disabled={disabled}
    />
  );
}

export default CreateTask;
