import useOptimisticUpdates from "./useOptimisticUpdates";

export const useProjects = () => {
  const { data, create, update, delete: remove } = useOptimisticUpdates("Project");
  return {
    projects: data,
    createProject: create,
    updateProject: update,
    deleteProject: remove,
  };
};

export const useProjectMemberships = () => {
  const { data, create, update, delete: remove } = useOptimisticUpdates("UserProjectMembership");
  return {
    projectMemberships: data,
    createProjectMembership: create,
    updateProjectMembership: update,
    deleteProjectMembership: remove,
  };
};

export const useCategories = () => {
  const { data, create, update, delete: remove } = useOptimisticUpdates("Category");
  return {
    categories: data,
    createCategory: create,
    updateCategory: update,
    deleteCategory: remove,
  };
};



