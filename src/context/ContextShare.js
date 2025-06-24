import { createContext, useState } from "react";

export const TreeresponseContext = createContext({});
export const updateProjectContext = createContext({});
export const iroamerContext = createContext({});
function ContextShare({ children }) {
  const [updateProject, setUpdateProject] = useState([]);
  const [updateTree, setUpdatetree] = useState([]);
   const [viewHideThree, setViewHideThree] = useState({});

    const [backgroundColorTag, setBackgroundColorTag] = useState({});
  const [highlightedTagKey, setHighlightedTagKey] = useState(null);
  const [tagsToRemove, setTagsToRemove ] = useState({})
    //console.log(modalData)
  return (
  
    
    <>
      <TreeresponseContext.Provider value={{ updateTree, setUpdatetree }}>
        <updateProjectContext.Provider value={{ updateProject, setUpdateProject }}>
          <iroamerContext.Provider value={{viewHideThree, setViewHideThree,highlightedTagKey, setHighlightedTagKey,backgroundColorTag, setBackgroundColorTag,tagsToRemove, setTagsToRemove }}>
            {children}
          </iroamerContext.Provider>
        </updateProjectContext.Provider>
      </TreeresponseContext.Provider>
    </>
  );
}
export default ContextShare;
