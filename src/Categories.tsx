import React, { createContext, useState, useEffect, useContext, ReactNode } from "react";
import type {CategoryType} from './schemaTypes'
import { useCategory } from "./useGqlCached";
import { UserContext } from "./UserContext";

//export const CategoriesContext = createContext([]
interface CategoriesContextType {
  categories: CategoryType[] | undefined;
  currentCategoryState: [string | boolean, React.Dispatch<React.SetStateAction<string | boolean>>];
}
export const CategoriesContext = createContext<CategoriesContextType | undefined>(undefined);

interface CategoriesProps {
  children: ReactNode;
}

export default function Categories({ children }: CategoriesProps) {
  const { currentProject } = useContext(UserContext)!;
  const [currentCategory, setCurrentCategory] = useState<string | boolean>(false);
  const { categories } = useCategory(currentProject);

  useEffect(() => {
    if (currentProject) {
      if (!currentCategory) {
        if (categories?.[0]?.id) {
          setCurrentCategory(categories[0].id);
        }
      }
    }
  }, [categories, currentCategory]);

  return (
    <CategoriesContext.Provider
    value={{
      categories,
      currentCategoryState: [currentCategory, setCurrentCategory],
    }}
    >
      {children}
    </CategoriesContext.Provider>
  );
}
