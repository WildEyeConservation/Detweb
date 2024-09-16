import { ReactNode } from "react";
import { useContext } from "react";
import { UserContext, ProjectContext } from "./Context";


export function Project({children }: { children: ReactNode }) {
  const { currentProject: project } = useContext(UserContext)!
  

  return <ProjectContext.Provider value={{ project }}>
      {project && children}
    </ProjectContext.Provider>
  }