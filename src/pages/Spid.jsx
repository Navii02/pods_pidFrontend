import React, { useContext, useEffect, useState } from "react";
import "../styles/spid.css";
import { useNavigate } from "react-router-dom";
import { fetchSvgFiles } from "../services/SpidApi";
import { updateProjectContext } from "../context/ContextShare";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";


const Spid = () => {
   const {updateProject} = useContext(updateProjectContext)
  
  const [files, setFiles] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const getSvgFiles = async () => {
      try {
           const projectString = sessionStorage.getItem("selectedProject");
      const project = projectString ? JSON.parse(projectString) : null;
      const projectId = project?.projectId;
      const type='iXB'
      const data ={projectId,type}
      //console.log(data);
      

        const response = await fetchSvgFiles(data);
        if(response.status ===200){
          console.log(response.data.files);
         setFiles(response.data.files) 
        }
      
      } catch {
        setFiles([]); 
      }
    };
    getSvgFiles();
  }, [updateProject]);

  const handleOpen = (fileId) => {
    navigate(`/canvas/${fileId}`);
  };

  const handleAddNew = () => {
    console.log("Add new SVG file functionality");
  };

  return (
<>
   <div style={{zIndex:'1',position:'absolute', width:'100%',height:'90vh',backgroundColor:'#33334c',color:'white'}}>    
     <div className="head" style={{display:'flex' , justifyContent:'space-between', alignItems:'center',padding:'7px'}}>
          <h3 style={{fontWeight:'bold',paddingLeft:'20px'}}>Smart P&IDs</h3>
          <FontAwesomeIcon icon={faPlus} style={{fontWeight:'bold'}}  onClick={handleAddNew}/>
          </div>       
          <hr style={{marginTop:'-10px'}}/>       

            <div className="pid-documents-grid">
              {files.length > 0 ? (
                files.map((file,index) => (
                  <div className="rounded-box"
                    key={file.id}
                    onClick={() => handleOpen(file.documentId)}
                    title={file.title}
                  >
                    {file.title}
                  </div>
                  
                ))
              ) : (
                <div className="pid-documents-empty-state">
                  <p>No documents available.</p>
                </div>
              )}
            </div>
          </div>
</>
  );
};

export default Spid;
