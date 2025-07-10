import { commonApi } from "./apiStructure"
import { url } from "./Url"

export const SaveOrginalMesh = async(data)=>{
try {
   const response = await commonApi(`POST`,`${url}/api/save-orignalmesh`,data) 
   //console.log(response);
   
    return response
} catch (error) {
    throw error
}
}

export const saveOctree = async(data)=>{
try {
    console.log(data);
    
   const response = await commonApi(`POST`,`${url}/api/save-octree`,data) 
   console.log(response);
   
    return response
} catch (error) {
    throw error
}
}
export const SaveMergedMesh = async(data)=>{
try {
   const response = await commonApi(`POST`,`${url}/api/save-mergedmesh`,data) 
   console.log(response);
   
    return response
} catch (error) {
    throw error
}
}
export const clearGlobalModal = async(projectId)=>{
try {
   const response = await commonApi(`DELETE`,`${url}/api/delete-global-modal/${projectId}`) 
   console.log(response);
   
    return response
} catch (error) {
    throw error
}
}

export const getOctreeData = async(projectId)=>{
try {
   const response = await commonApi(`GET`,`${url}/api/get-octree/${projectId}`) 
   console.log(response);
   
    return response
} catch (error) {
    throw error
}
}

