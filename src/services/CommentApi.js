import { commonApi } from "./apiStructure";
import { url } from "./Url";

export const getStatustableData = async (projectId) => {
  try {
    const response = await commonApi(
      "GET",
      `${url}/api/comment/get-comments/${projectId} `
    );
    return response;
  } catch (error) {
    throw error;
  }
};

 export const addStatus = async(statusData)=>{
    try {
       const response = await commonApi('POST',`${url}/api/comment/add-comment`,statusData) 
       return response 
    } catch (error) {
        throw error
    }

 }
  export const deleteStatus = async(statusId)=>{
    try {
         const response = await commonApi('DELETE',`${url}/api/comment/delete-comment/${statusId}`)
           return response
        
    } catch (error) {
        throw error
    }

  }