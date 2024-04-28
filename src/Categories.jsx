import React, { createContext, useState, useEffect, useContext } from "react";
import { useCategory } from "./useGqlCached";
import { UserContext } from "./UserContext";

export const CategoriesContext = createContext([]);

export default function Categories({ children }) {
  const { currentProject } = useContext(UserContext);
  const [currentCategory, setCurrentCategory] = useState(false);
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
      value={[categories, [currentCategory, setCurrentCategory]]}
    >
      {children}
    </CategoriesContext.Provider>
  );
}
