import { createContext, useState } from "react";

export const TreeresponseContext = createContext({});

function ContextShare({ children }) {
  const [updateTree, setUpdatetree] = useState([]);
  return (
    <>
      <TreeresponseContext.Provider value={{ updateTree, setUpdatetree }}>
        {children}
      </TreeresponseContext.Provider>
    </>
  );
}
export default ContextShare;
