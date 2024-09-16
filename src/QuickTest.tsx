import { useState, useContext } from 'react';
import { useOptimisticUpdates } from "./useOptimisticUpdates";
import { GlobalContext,ProjectContext } from "./Context";


export default function QuickTest() {
    return (
      <div>
        <h1>QuickTest</h1>
        <CategoryList />
      </div>
    );
}

function CategoryList() {
    const { client } = useContext(GlobalContext)!;
     = useContext(ProjectContext)!;
    const { data, create, update, delete: remove } =
        useOptimisticUpdates("Category",
            () => client.models.Category.CategoriesByProject({ projectId: project.id }),
            { filter: { projectId: { eq:  project.id } } });

    const [newCategoryName, setNewCategoryName] = useState("");

    const handleCreate = () => {
        if (newCategoryName) {
            create({ name: newCategoryName, projectId: project.id});
            setNewCategoryName("");
        }
    };

    return (
        <div>
            <h2>Categories</h2>
            <input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="New Category name"
            />
            <button onClick={handleCreate}>Create Category</button>
            {data  ? (
                data.map((p: {id: string, name: string}) => (
                    <div key={p.name}>
                        {p.name}
                        <button onClick={() => update({id: p.id, name: p.name + " (updated)"})}>
                            Update
                        </button>
                        <button onClick={() => remove({id: p.id})}>Delete</button>
                    </div>
                ))
            ) : (
                "No data"
            )}
        </div>
    );
}


