import { createContext, useState } from "react";

export const TreeresponseContext = createContext({});
export const updateProjectContext = createContext({});

function ContextShare({ children }) {
  const [updateProject, setUpdateProject] = useState([]);
  const [updateTree, setUpdatetree] = useState([]);
  return (
    <>
      <TreeresponseContext.Provider value={{ updateTree, setUpdatetree }}>
        <updateProjectContext.Provider value={{ updateProject, setUpdateProject }}>
          {children}
        </updateProjectContext.Provider>
      </TreeresponseContext.Provider>
    </>
  );
}
export default ContextShare;
