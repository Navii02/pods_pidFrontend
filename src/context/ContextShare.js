import { createContext, useState } from "react";

export const TreeresponseContext = createContext({});
export const updateProjectContext = createContext({});
export const iroamerContext = createContext({});
function ContextShare({ children }) {
  const [updateProject, setUpdateProject] = useState([]);
   const [modalData,setModaldata]=useState([])
  const [updateTree, setUpdatetree] = useState([]);
   const [view,setview]=useState({})
  const [viewHideThree, setViewHideThree] = useState({});
  const [backgroundColorTag, setBackgroundColorTag] = useState({});
  const [highlightedTagKey, setHighlightedTagKey] = useState(null);
  const [highlightedTagKeyGlobal, setHighlightedTagKeyGlobal] = useState(null);
  const [tagsToRemove, setTagsToRemove] = useState([]);
  const [iroamerfieldEmpty, setIroamerfieldEmpty] = useState(false);
  //console.log(modalData)
  return (
    <>
      <TreeresponseContext.Provider value={{ updateTree, setUpdatetree }}>
        <updateProjectContext.Provider
          value={{ updateProject, setUpdateProject }}
        >
          <iroamerContext.Provider
            value={{
              viewHideThree,
              setViewHideThree,
              highlightedTagKey,
              setHighlightedTagKey,
              highlightedTagKeyGlobal,
              setHighlightedTagKeyGlobal,
              backgroundColorTag,
              setBackgroundColorTag,
              tagsToRemove,
              setTagsToRemove,
              iroamerfieldEmpty,
              setIroamerfieldEmpty,
              modalData,
              setModaldata,
              view,
              setview
            }}
          >
            {children}
          </iroamerContext.Provider>
        </updateProjectContext.Provider>
      </TreeresponseContext.Provider>
    </>
  );
}
export default ContextShare;
