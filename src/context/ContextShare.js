import { createContext, useState } from "react";

export const TreeresponseContext = createContext({});
export const updateProjectContext = createContext({});
export const fileshowContext = createContext({});
function ContextShare({ children }) {
  const [updateProject, setUpdateProject] = useState([]);
  const [updateTree, setUpdatetree] = useState([]);
  const [modalData, setmodalData] = useState([]);
    //console.log(modalData)
  return (
  
    
    <>
      <TreeresponseContext.Provider value={{ updateTree, setUpdatetree }}>
        <updateProjectContext.Provider value={{ updateProject, setUpdateProject }}>
          <fileshowContext.Provider value={{ modalData, setmodalData }}>
            {children}
          </fileshowContext.Provider>
        </updateProjectContext.Provider>
      </TreeresponseContext.Provider>
    </>
  );
}
export default ContextShare;
